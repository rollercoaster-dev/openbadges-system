<template>
  <div class="min-h-screen flex flex-col bg-slate-50">
    <!-- Header -->
    <header class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex justify-between items-center">
          <div class="flex-shrink-0">
            <h1 class="text-xl font-bold text-slate-900">
              <router-link to="/" class="hover:text-primary-600 transition-colors">
                OpenBadges Demo
              </router-link>
            </h1>
          </div>
          <nav class="hidden md:flex space-x-8">
            <router-link
                         v-for="link in navLinks"
                         :key="link.to"
                         :to="link.to"
                         class="text-slate-700 hover:text-primary-600 px-3 py-2 text-sm font-medium rounded-md transition-colors"
                         active-class="text-primary-600">
              {{ link.text }}
            </router-link>
          </nav>
          <div class="md:hidden">
            <!-- Mobile menu button -->
            <button
                    @click="isMobileMenuOpen = !isMobileMenuOpen"
                    class="inline-flex items-center justify-center p-2 rounded-md text-slate-700 hover:text-primary-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
                    aria-expanded="false">
              <span class="sr-only">Open main menu</span>
              <svg
                   class="h-6 w-6"
                   xmlns="http://www.w3.org/2000/svg"
                   fill="none"
                   viewBox="0 0 24 24"
                   stroke="currentColor"
                   aria-hidden="true">
                <path
                      v-if="!isMobileMenuOpen"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 6h16M4 12h16M4 18h16" />
                <path
                      v-else
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile menu, show/hide based on menu state -->
      <div v-if="isMobileMenuOpen" class="md:hidden">
        <div class="pt-2 pb-3 space-y-1">
          <router-link
                       v-for="link in navLinks"
                       :key="`mobile-${link.to}`"
                       :to="link.to"
                       @click="isMobileMenuOpen = false"
                       class="block px-3 py-2 text-base font-medium text-slate-700 hover:text-primary-600 hover:bg-slate-50 rounded-md"
                       active-class="text-primary-600 bg-slate-100">
            {{ link.text }}
          </router-link>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="flex-grow">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>

    <!-- Footer -->
    <footer class="bg-white border-t border-gray-200 mt-8">
      <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row justify-between items-center">
          <div class="text-center md:text-left mb-4 md:mb-0">
            <p class="text-sm text-slate-500">
              &copy; {{ new Date().getFullYear() }} OpenBadges Demo. All rights reserved.
            </p>
          </div>
          <div class="flex space-x-6">
            <a href="#" class="text-slate-400 hover:text-slate-500">
              <span class="sr-only">GitHub</span>
              <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fill-rule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      clip-rule="evenodd" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const isMobileMenuOpen = ref(false);

const navLinks = [
  { to: '/', text: 'Home' },
  { to: '/badges', text: 'Badges' },
  { to: '/issuers', text: 'Issuers' },
  { to: '/recipients', text: 'Recipients' },
];
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
