import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { WebAuthnUtils, WebAuthnError, type WebAuthnCredential } from '@/utils/webauthn'
import { openBadgesService } from '@/services/openbadges'

export interface User {
  id: string
  username: string
  email: string
  firstName: string
  lastName: string
  avatar?: string
  isAdmin: boolean
  createdAt: string
  credentials: WebAuthnCredential[]
}

export interface RegisterData {
  username: string
  email: string
  firstName: string
  lastName: string
}

export interface AuthResponse {
  success: boolean
  user?: User
  token?: string
  message?: string
}

export const useAuth = () => {
  const router = useRouter()

  // State
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('auth_token'))
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const isWebAuthnSupported = ref(WebAuthnUtils.isSupported())
  const isPlatformAuthAvailable = ref(false)

  // Computed
  const isAuthenticated = computed(() => !!user.value && !!token.value)
  const isAdmin = computed(() => user.value?.isAdmin || false)

  // Check platform authenticator availability
  const checkPlatformAuth = async () => {
    isPlatformAuthAvailable.value = await WebAuthnUtils.isPlatformAuthenticatorAvailable()
  }

  // Removed unused functions: getUsersFromStorage, saveUsersToStorage, apiCall

  // Basic API calls for user lookup/registration (uses basic auth)
  const basicApiCall = async (endpoint: string, options: RequestInit = {}) => {
    const response = await fetch(`/api/bs${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response) {
      throw new Error('Network error: No response received')
    }

    if (!response.ok) {
      let errorData = { message: 'Unknown error' }
      if (response.json && typeof response.json === 'function') {
        errorData = await response.json().catch(() => ({ message: 'Unknown error' }))
      }
      throw new Error(errorData.message || `API call failed: ${response.status}`)
    }

    if (response.json && typeof response.json === 'function') {
      return response.json()
    }
    
    // Fallback for test environment or if response.json is not available
    return response
  }

  // Register user in backend
  const registerUser = async (data: RegisterData): Promise<User> => {
    const userData = {
      username: data.username,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      isActive: true,
      roles: ['USER'],
    }

    const response = await basicApiCall('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    })

    return {
      id: response.id,
      username: response.username,
      email: response.email,
      firstName: response.firstName || '',
      lastName: response.lastName || '',
      avatar: response.avatar,
      isAdmin: response.roles?.includes('ADMIN') || false,
      createdAt: response.createdAt,
      credentials: [],
    }
  }

  // Find user by username/email
  const findUser = async (usernameOrEmail: string): Promise<User | null> => {
    try {
      // Try to get user by username first
      const users = await basicApiCall(`/users?username=${encodeURIComponent(usernameOrEmail)}`)

      if (users.length > 0) {
        const backendUser = users[0]
        return {
          id: backendUser.id,
          username: backendUser.username,
          email: backendUser.email,
          firstName: backendUser.firstName || '',
          lastName: backendUser.lastName || '',
          avatar: backendUser.avatar,
          isAdmin: backendUser.roles?.includes('ADMIN') || false,
          createdAt: backendUser.createdAt,
          credentials: backendUser.credentials || [],
        }
      }

      // If not found by username, try by email
      const usersByEmail = await basicApiCall(`/users?email=${encodeURIComponent(usernameOrEmail)}`)
      if (usersByEmail.length > 0) {
        const backendUser = usersByEmail[0]
        return {
          id: backendUser.id,
          username: backendUser.username,
          email: backendUser.email,
          firstName: backendUser.firstName || '',
          lastName: backendUser.lastName || '',
          avatar: backendUser.avatar,
          isAdmin: backendUser.roles?.includes('ADMIN') || false,
          createdAt: backendUser.createdAt,
          credentials: backendUser.credentials || [],
        }
      }

      return null
    } catch (error) {
      console.error('Error finding user:', error)
      return null
    }
  }

  // Store WebAuthn credential in backend
  const storeCredential = async (userId: string, credential: WebAuthnCredential): Promise<void> => {
    await basicApiCall(`/users/${userId}/credentials`, {
      method: 'POST',
      body: JSON.stringify(credential),
    })
  }

  // WebAuthn Registration
  const registerWithWebAuthn = async (data: RegisterData): Promise<boolean> => {
    isLoading.value = true
    error.value = null

    try {
      // Check if user already exists
      console.log('Checking for existing user:', data.username)
      const existingUser = await findUser(data.username)
      if (existingUser) {
        console.log('User already exists:', existingUser)
        error.value = 'Username already exists'
        return false
      }

      console.log('Checking for existing email:', data.email)
      const existingEmail = await findUser(data.email)
      if (existingEmail) {
        console.log('Email already exists:', existingEmail)
        error.value = 'Email already exists'
        return false
      }

      // Create user in backend first
      console.log('Creating new user in backend:', data)
      const newUser = await registerUser(data)
      console.log('New user created:', newUser)

      // Create WebAuthn registration options
      const registrationOptions = WebAuthnUtils.createRegistrationOptions(
        newUser.id,
        newUser.username,
        `${newUser.firstName} ${newUser.lastName}`,
        []
      )

      // Use WebAuthn to create credential
      const credentialData = await WebAuthnUtils.register(registrationOptions)

      // Create credential object
      const credential: WebAuthnCredential = {
        id: credentialData.id,
        publicKey: credentialData.publicKey,
        transports: credentialData.transports,
        counter: 0,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        name: WebAuthnUtils.getAuthenticatorName(
          credentialData.authenticatorAttachment,
          credentialData.transports
        ),
        type: credentialData.authenticatorAttachment === 'platform' ? 'platform' : 'cross-platform',
      }

      // Store credential in backend
      await storeCredential(newUser.id, credential)

      // Update user with credential
      newUser.credentials = [credential]

      // Set authentication state
      user.value = newUser
      token.value = 'backend-jwt-token-' + Date.now() // TODO: Get real JWT from backend
      localStorage.setItem('auth_token', token.value)
      localStorage.setItem('user_data', JSON.stringify(newUser))

      return true
    } catch (err) {
      if (err instanceof WebAuthnError) {
        error.value = err.userMessage
      } else {
        error.value = 'Registration failed. Please try again.'
      }
      return false
    } finally {
      isLoading.value = false
    }
  }

  // WebAuthn Authentication
  const authenticateWithWebAuthn = async (username: string): Promise<boolean> => {
    isLoading.value = true
    error.value = null

    try {
      // Find user in backend
      console.log('Looking for user:', username)
      const foundUser = await findUser(username)
      if (!foundUser) {
        error.value = 'User not found'
        return false
      }

      console.log('Found user:', foundUser)
      console.log('User credentials:', foundUser.credentials)

      // Check if user has credentials
      if (!foundUser.credentials || foundUser.credentials.length === 0) {
        error.value = 'No credentials found for this user. Please register first.'
        return false
      }

      // Create authentication options
      const authenticationOptions = WebAuthnUtils.createAuthenticationOptions(foundUser.credentials)

      // Use WebAuthn to authenticate
      const credentialData = await WebAuthnUtils.authenticate(authenticationOptions)

      // Verify credential exists
      const credential = foundUser.credentials.find(c => c.id === credentialData.id)
      if (!credential) {
        error.value = 'Invalid credential'
        return false
      }

      // Update credential last used time in backend
      await basicApiCall(`/users/${foundUser.id}/credentials/${credential.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ lastUsed: new Date().toISOString() }),
      })

      // Set authentication state
      user.value = foundUser
      token.value = 'backend-jwt-token-' + Date.now() // TODO: Get real JWT from backend
      localStorage.setItem('auth_token', token.value)
      localStorage.setItem('user_data', JSON.stringify(foundUser))

      return true
    } catch (err) {
      console.error('Authentication error:', err)
      if (err instanceof WebAuthnError) {
        error.value = err.userMessage
      } else {
        error.value =
          err instanceof Error ? err.message : 'Authentication failed. Please try again.'
      }
      return false
    } finally {
      isLoading.value = false
    }
  }

  // Legacy methods for compatibility
  const login = async (username: string): Promise<boolean> => {
    return await authenticateWithWebAuthn(username)
  }

  const register = async (data: RegisterData): Promise<boolean> => {
    return await registerWithWebAuthn(data)
  }

  // Logout function
  const logout = () => {
    user.value = null
    token.value = null
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_data')
    router.push('/auth/login')
  }

  // Initialize auth state from localStorage
  const initializeAuth = async () => {
    const storedToken = localStorage.getItem('auth_token')
    const storedUser = localStorage.getItem('user_data')

    if (storedToken && storedUser) {
      try {
        token.value = storedToken
        user.value = JSON.parse(storedUser)

        // TODO: Validate token with backend
        // For now, we trust localStorage
      } catch {
        // Clear invalid data
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user_data')
      }
    }

    // Check WebAuthn support
    await checkPlatformAuth()
  }

  // Clear error
  const clearError = () => {
    error.value = null
  }

  // Update user profile
  const updateProfile = async (updatedUser: Partial<User>) => {
    if (!user.value) return

    try {
      // Convert isAdmin to roles structure for backend
      const backendUpdate = { ...updatedUser }
      if ('isAdmin' in updatedUser) {
        backendUpdate.roles = updatedUser.isAdmin ? ['USER', 'ADMIN'] : ['USER']
        delete backendUpdate.isAdmin
      }

      // Update user in backend
      const response = await basicApiCall(`/users/${user.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(backendUpdate),
      })

      // Update local user state with backend response
      if (response && response.roles) {
        const updatedUserData = {
          ...user.value,
          ...updatedUser,
          isAdmin: response.roles.includes('ADMIN')
        }
        user.value = updatedUserData
        localStorage.setItem('user_data', JSON.stringify(user.value))
      } else {
        // Fallback to direct update if no response
        user.value = { ...user.value, ...updatedUser }
        localStorage.setItem('user_data', JSON.stringify(user.value))
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update profile'
    }
  }

  // Add a new credential to user's account
  const addCredential = async (credentialName: string): Promise<boolean> => {
    if (!user.value) return false

    isLoading.value = true
    error.value = null

    try {
      const registrationOptions = WebAuthnUtils.createRegistrationOptions(
        user.value.id,
        user.value.username,
        `${user.value.firstName} ${user.value.lastName}`,
        user.value.credentials
      )

      const credentialData = await WebAuthnUtils.register(registrationOptions)

      const newCredential: WebAuthnCredential = {
        id: credentialData.id,
        publicKey: credentialData.publicKey,
        transports: credentialData.transports,
        counter: 0,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        name:
          credentialName ||
          WebAuthnUtils.getAuthenticatorName(
            credentialData.authenticatorAttachment,
            credentialData.transports
          ),
        type: credentialData.authenticatorAttachment === 'platform' ? 'platform' : 'cross-platform',
      }

      // Store credential in backend
      await storeCredential(user.value.id, newCredential)

      // Update local user state
      user.value.credentials.push(newCredential)
      localStorage.setItem('user_data', JSON.stringify(user.value))

      return true
    } catch (err) {
      if (err instanceof WebAuthnError) {
        error.value = err.userMessage
      } else {
        error.value = 'Failed to add authenticator. Please try again.'
      }
      return false
    } finally {
      isLoading.value = false
    }
  }

  // Remove a credential from user's account
  const removeCredential = async (credentialId: string) => {
    if (!user.value) return

    try {
      // Remove credential from backend
      await basicApiCall(`/users/${user.value.id}/credentials/${credentialId}`, {
        method: 'DELETE',
      })

      // Update local user state
      user.value.credentials = user.value.credentials.filter(c => c.id !== credentialId)
      localStorage.setItem('user_data', JSON.stringify(user.value))
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to remove credential'
    }
  }

  // OpenBadges integration
  const getUserBackpack = async () => {
    if (!user.value) return null

    try {
      return await openBadgesService.getUserBackpack(user.value)
    } catch (err) {
      console.error('Failed to get user backpack:', err)
      return null
    }
  }

  const addBadgeToBackpack = async (
    badgeClassId: string,
    evidence?: string,
    narrative?: string
  ) => {
    if (!user.value) return false

    try {
      await openBadgesService.addBadgeToBackpack(user.value, badgeClassId, evidence, narrative)
      return true
    } catch (err) {
      console.error('Failed to add badge to backpack:', err)
      error.value = 'Failed to add badge to backpack'
      return false
    }
  }

  const removeBadgeFromBackpack = async (assertionId: string) => {
    if (!user.value) return false

    try {
      await openBadgesService.removeBadgeFromBackpack(user.value, assertionId)
      return true
    } catch (err) {
      console.error('Failed to remove badge from backpack:', err)
      error.value = 'Failed to remove badge from backpack'
      return false
    }
  }

  const getBadgeClasses = async () => {
    try {
      return await openBadgesService.getBadgeClasses()
    } catch (err) {
      console.error('Failed to get badge classes:', err)
      return []
    }
  }

  const createBadgeClass = async (badgeClass: Record<string, unknown>) => {
    if (!user.value) return null

    try {
      return await openBadgesService.createBadgeClass(user.value, badgeClass)
    } catch (err) {
      console.error('Failed to create badge class:', err)
      error.value = 'Failed to create badge class'
      return null
    }
  }

  const issueBadge = async (
    badgeClassId: string,
    recipientEmail: string,
    evidence?: string,
    narrative?: string
  ) => {
    if (!user.value) return null

    try {
      return await openBadgesService.issueBadge(
        user.value,
        badgeClassId,
        recipientEmail,
        evidence,
        narrative
      )
    } catch (err) {
      console.error('Failed to issue badge:', err)
      error.value = 'Failed to issue badge'
      return null
    }
  }

  // Initialize on first use
  initializeAuth()

  return {
    // State
    user,
    token,
    isLoading,
    error,
    isWebAuthnSupported,
    isPlatformAuthAvailable,

    // Computed
    isAuthenticated,
    isAdmin,

    // Actions
    login,
    register,
    authenticateWithWebAuthn,
    registerWithWebAuthn,
    logout,
    initializeAuth,
    clearError,
    updateProfile,
    addCredential,
    removeCredential,

    // OpenBadges integration
    getUserBackpack,
    addBadgeToBackpack,
    removeBadgeFromBackpack,
    getBadgeClasses,
    createBadgeClass,
    issueBadge,
  }
}
