import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export interface NavigationItem {
  id: string
  label: string
  to?: string
  icon?: any
  children?: NavigationItem[]
  requiresAuth?: boolean
  requiresAdmin?: boolean
}

export const useNavigation = () => {
  const route = useRoute()
  const router = useRouter()

  // Navigation state
  const isMobileMenuOpen = ref(false)
  const activeDropdowns = ref(new Set<string>())

  // User state (would typically come from auth store)
  const user = ref({
    isLoggedIn: false,
    isAdmin: false,
    name: 'John Doe',
    email: 'john@example.com',
    avatar: null
  })

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    isMobileMenuOpen.value = !isMobileMenuOpen.value
  }

  const closeMobileMenu = () => {
    isMobileMenuOpen.value = false
    activeDropdowns.value.clear()
  }

  // Dropdown management
  const toggleDropdown = (id: string) => {
    if (activeDropdowns.value.has(id)) {
      activeDropdowns.value.delete(id)
    } else {
      activeDropdowns.value.clear()
      activeDropdowns.value.add(id)
    }
  }

  const closeDropdown = (id: string) => {
    activeDropdowns.value.delete(id)
  }

  const closeAllDropdowns = () => {
    activeDropdowns.value.clear()
  }

  // Route helpers
  const isActiveRoute = (path: string) => {
    if (path === '/') {
      return route.path === '/'
    }
    return route.path.startsWith(path)
  }

  const isDropdownActive = (item: NavigationItem) => {
    if (item.to) {
      return isActiveRoute(item.to)
    }
    return item.children?.some(child => isActiveRoute(child.to || '')) || false
  }

  // Navigation helpers
  const navigateTo = (path: string) => {
    closeMobileMenu()
    closeAllDropdowns()
    router.push(path)
  }

  const canAccessRoute = (item: NavigationItem) => {
    if (item.requiresAuth && !user.value.isLoggedIn) {
      return false
    }
    if (item.requiresAdmin && !user.value.isAdmin) {
      return false
    }
    return true
  }

  // Filter navigation items based on permissions
  const filterNavigationItems = (items: NavigationItem[]): NavigationItem[] => {
    return items.filter(item => {
      if (!canAccessRoute(item)) {
        return false
      }
      
      if (item.children) {
        item.children = filterNavigationItems(item.children)
        return item.children.length > 0
      }
      
      return true
    })
  }

  // Page title helper
  const getPageTitle = (customTitle?: string) => {
    const baseTitle = 'OpenBadges'
    if (customTitle) {
      return `${customTitle} | ${baseTitle}`
    }
    return baseTitle
  }

  // Breadcrumb generation
  const generateBreadcrumbs = () => {
    const pathSegments = route.path.split('/').filter(Boolean)
    const breadcrumbs = []
    
    let currentPath = ''
    for (const segment of pathSegments) {
      currentPath += `/${segment}`
      
      // Generate label from segment
      const label = segment.replace(/[-_]/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase())
      
      breadcrumbs.push({
        label,
        to: currentPath,
        active: currentPath === route.path
      })
    }
    
    return breadcrumbs
  }

  // Return all navigation utilities
  return {
    // State
    isMobileMenuOpen,
    activeDropdowns,
    user,
    
    // Methods
    toggleMobileMenu,
    closeMobileMenu,
    toggleDropdown,
    closeDropdown,
    closeAllDropdowns,
    
    // Helpers
    isActiveRoute,
    isDropdownActive,
    navigateTo,
    canAccessRoute,
    filterNavigationItems,
    getPageTitle,
    generateBreadcrumbs
  }
}