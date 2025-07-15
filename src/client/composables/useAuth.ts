import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { WebAuthnUtils, WebAuthnError, type WebAuthnCredential, type RegistrationOptions, type AuthenticationOptions } from '@/utils/webauthn'

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
  registrationOptions?: RegistrationOptions
  authenticationOptions?: AuthenticationOptions
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

  // Mock database for demo
  const mockUsers: User[] = [
    {
      id: '1',
      username: 'admin',
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      avatar: null,
      isAdmin: true,
      createdAt: new Date().toISOString(),
      credentials: []
    },
    {
      id: '2',
      username: 'demo',
      email: 'demo@example.com',
      firstName: 'Demo',
      lastName: 'User',
      avatar: null,
      isAdmin: false,
      createdAt: new Date().toISOString(),
      credentials: []
    }
  ]

  // Mock API calls - replace with real API integration
  const mockGetRegistrationOptions = async (data: RegisterData): Promise<AuthResponse> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Check if username or email already exists
    const existingUser = mockUsers.find(u => u.username === data.username || u.email === data.email)
    if (existingUser) {
      return {
        success: false,
        message: existingUser.username === data.username ? 'Username already exists' : 'Email already exists'
      }
    }
    
    // Create temporary user ID for registration
    const tempUserId = 'temp-' + Date.now()
    
    const registrationOptions = WebAuthnUtils.createRegistrationOptions(
      tempUserId,
      data.username,
      `${data.firstName} ${data.lastName}`,
      [] // No existing credentials for new user
    )
    
    return {
      success: true,
      registrationOptions,
      message: 'Registration options generated'
    }
  }

  const mockCompleteRegistration = async (
    registrationData: RegisterData,
    credentialData: any
  ): Promise<AuthResponse> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Create new user with WebAuthn credential
    const newUser: User = {
      id: 'user-' + Date.now(),
      username: registrationData.username,
      email: registrationData.email,
      firstName: registrationData.firstName,
      lastName: registrationData.lastName,
      avatar: null,
      isAdmin: false,
      createdAt: new Date().toISOString(),
      credentials: [{
        id: credentialData.id,
        publicKey: credentialData.publicKey,
        transports: credentialData.transports,
        counter: 0,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        name: WebAuthnUtils.getAuthenticatorName(credentialData.authenticatorAttachment, credentialData.transports),
        type: credentialData.authenticatorAttachment === 'platform' ? 'platform' : 'cross-platform'
      }]
    }
    
    // Add to mock database
    mockUsers.push(newUser)
    
    return {
      success: true,
      user: newUser,
      token: 'mock-jwt-token-' + Date.now(),
      message: 'Registration successful'
    }
  }

  const mockGetAuthenticationOptions = async (username: string): Promise<AuthResponse> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Find user by username or email
    const foundUser = mockUsers.find(u => u.username === username || u.email === username)
    if (!foundUser) {
      return {
        success: false,
        message: 'User not found'
      }
    }

    const authenticationOptions = WebAuthnUtils.createAuthenticationOptions(foundUser.credentials)
    
    return {
      success: true,
      authenticationOptions,
      message: 'Authentication options generated'
    }
  }

  const mockCompleteAuthentication = async (
    username: string,
    credentialData: any
  ): Promise<AuthResponse> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Find user by username or email
    const foundUser = mockUsers.find(u => u.username === username || u.email === username)
    if (!foundUser) {
      return {
        success: false,
        message: 'User not found'
      }
    }

    // Find matching credential
    const credential = foundUser.credentials.find(c => c.id === credentialData.id)
    if (!credential) {
      return {
        success: false,
        message: 'Invalid credential'
      }
    }

    // Update last used timestamp
    credential.lastUsed = new Date().toISOString()
    
    return {
      success: true,
      user: foundUser,
      token: 'mock-jwt-token-' + Date.now(),
      message: 'Authentication successful'
    }
  }

  // WebAuthn Authentication
  const authenticateWithWebAuthn = async (username: string): Promise<boolean> => {
    isLoading.value = true
    error.value = null
    
    try {
      // Step 1: Get authentication options from server
      const optionsResponse = await mockGetAuthenticationOptions(username)
      
      if (!optionsResponse.success || !optionsResponse.authenticationOptions) {
        error.value = optionsResponse.message || 'Failed to get authentication options'
        return false
      }

      // Step 2: Use WebAuthn to authenticate
      const credentialData = await WebAuthnUtils.authenticate(optionsResponse.authenticationOptions)
      
      // Step 3: Complete authentication with server
      const authResponse = await mockCompleteAuthentication(username, credentialData)
      
      if (authResponse.success && authResponse.user && authResponse.token) {
        user.value = authResponse.user
        token.value = authResponse.token
        localStorage.setItem('auth_token', authResponse.token)
        localStorage.setItem('user_data', JSON.stringify(authResponse.user))
        return true
      } else {
        error.value = authResponse.message || 'Authentication failed'
        return false
      }
    } catch (err) {
      if (err instanceof WebAuthnError) {
        error.value = err.userMessage
      } else {
        error.value = 'Authentication failed. Please try again.'
      }
      return false
    } finally {
      isLoading.value = false
    }
  }

  // WebAuthn Registration
  const registerWithWebAuthn = async (data: RegisterData): Promise<boolean> => {
    isLoading.value = true
    error.value = null
    
    try {
      // Step 1: Get registration options from server
      const optionsResponse = await mockGetRegistrationOptions(data)
      
      if (!optionsResponse.success || !optionsResponse.registrationOptions) {
        error.value = optionsResponse.message || 'Failed to get registration options'
        return false
      }

      // Step 2: Use WebAuthn to create credential
      const credentialData = await WebAuthnUtils.register(optionsResponse.registrationOptions)
      
      // Step 3: Complete registration with server
      const registerResponse = await mockCompleteRegistration(data, credentialData)
      
      if (registerResponse.success && registerResponse.user && registerResponse.token) {
        user.value = registerResponse.user
        token.value = registerResponse.token
        localStorage.setItem('auth_token', registerResponse.token)
        localStorage.setItem('user_data', JSON.stringify(registerResponse.user))
        return true
      } else {
        error.value = registerResponse.message || 'Registration failed'
        return false
      }
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

  // Legacy password-based methods (for fallback)
  const login = async (username: string): Promise<boolean> => {
    // For now, redirect to WebAuthn authentication
    return await authenticateWithWebAuthn(username)
  }

  const register = async (data: RegisterData): Promise<boolean> => {
    // For now, redirect to WebAuthn registration
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
      } catch (err) {
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
  const updateProfile = (updatedUser: Partial<User>) => {
    if (user.value) {
      user.value = { ...user.value, ...updatedUser }
      localStorage.setItem('user_data', JSON.stringify(user.value))
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
        name: credentialName || WebAuthnUtils.getAuthenticatorName(credentialData.authenticatorAttachment, credentialData.transports),
        type: credentialData.authenticatorAttachment === 'platform' ? 'platform' : 'cross-platform'
      }
      
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
  const removeCredential = (credentialId: string) => {
    if (!user.value) return
    
    user.value.credentials = user.value.credentials.filter(c => c.id !== credentialId)
    localStorage.setItem('user_data', JSON.stringify(user.value))
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
    removeCredential
  }
}