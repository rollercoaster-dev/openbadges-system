<template>
  <div class="max-w-4xl mx-auto mt-8 bg-white shadow rounded-lg p-6">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Create New Badge Class</h1>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Badge Creation Form -->
      <div class="space-y-6">
        <!-- Badge creation form handled by BadgeIssuerForm component -->
        <div v-if="false" style="display: none" class="bg-gray-50 rounded-lg p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Badge Image</h3>

          <!-- Image Preview -->
          <div v-if="badgeData.image" class="mb-4">
            <img
              :src="badgeData.image"
              :alt="badgeData.name || 'Badge image preview'"
              class="w-32 h-32 object-cover rounded-lg border border-gray-300"
            />
            <button
              aria-label="Remove image"
              class="mt-2 text-sm text-red-600 hover:text-red-800"
              @click="badgeData.image = ''"
            >
              Remove image
            </button>
          </div>

          <!-- Upload Area -->
          <div
            class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
            :class="{ 'border-blue-400 bg-blue-50': isUploading }"
            @drop="handleImageDrop"
            @dragover="handleDragOver"
            @dragenter="handleDragOver"
          >
            <div v-if="isUploading" class="text-blue-600">
              <svg class="w-8 h-8 mx-auto mb-2 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p>Uploading image...</p>
            </div>
            <div v-else>
              <svg
                class="w-8 h-8 mx-auto mb-2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p class="text-gray-600 mb-2">Drop an image here or click to browse</p>
              <p class="text-sm text-gray-500">PNG, JPG, GIF, WebP up to 2MB</p>
            </div>
          </div>

          <!-- Hidden file input -->
          <input
            id="badge-image-upload"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            class="hidden"
            aria-label="Upload badge image"
            @change="handleImageUpload"
          />

          <!-- Upload button -->
          <label
            for="badge-image-upload"
            class="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
          >
            <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Choose Image
          </label>
        </div>

        <!-- Criteria Definition Section -->
        <div v-if="false" style="display: none" class="bg-gray-50 rounded-lg p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Badge Criteria</h3>

          <div class="space-y-4">
            <!-- Criteria Narrative -->
            <div>
              <label for="criteria-narrative" class="block text-sm font-medium text-gray-700 mb-2">
                Criteria Description *
              </label>
              <textarea
                id="criteria-narrative"
                :value="badgeData.criteria?.narrative"
                rows="4"
                class="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                :class="
                  getFieldError('criteria')
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300'
                "
                placeholder="Describe what someone needs to do to earn this badge..."
                aria-describedby="criteria-help criteria-error"
                required
                @input="handleFieldUpdate('criteria', ($event.target as HTMLTextAreaElement).value)"
                @blur="handleFieldBlur('criteria')"
              ></textarea>
              <p
                v-if="getFieldError('criteria')"
                id="criteria-error"
                class="mt-1 text-sm text-red-600"
              >
                {{ getFieldError('criteria') }}
              </p>
              <p id="criteria-help" class="mt-1 text-sm text-gray-500">
                Clearly describe the requirements, skills, or achievements needed to earn this
                badge.
              </p>
            </div>

            <!-- Criteria URL (optional) -->
            <div>
              <label for="criteria-url" class="block text-sm font-medium text-gray-700 mb-2">
                Criteria URL (optional)
              </label>
              <input
                id="criteria-url"
                :value="criteriaUrl"
                type="url"
                class="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                :class="
                  getFieldError('criteriaUrl')
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300'
                "
                placeholder="https://example.com/badge-criteria"
                aria-describedby="criteria-url-help criteria-url-error"
                @input="handleFieldUpdate('criteriaUrl', ($event.target as HTMLInputElement).value)"
                @blur="handleFieldBlur('criteriaUrl')"
              />
              <p
                v-if="getFieldError('criteriaUrl')"
                id="criteria-url-error"
                class="mt-1 text-sm text-red-600"
              >
                {{ getFieldError('criteriaUrl') }}
              </p>
              <p id="criteria-url-help" class="mt-1 text-sm text-gray-500">
                Optional link to detailed criteria documentation.
              </p>
            </div>

            <!-- Alignment Objects -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Educational Alignment (optional)
              </label>
              <div class="space-y-3">
                <div
                  v-for="(alignment, index) in badgeData.alignment"
                  :key="index"
                  class="flex gap-3 items-start"
                >
                  <div class="flex-1">
                    <input
                      v-model="alignment.targetName"
                      type="text"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Standard or skill name"
                      :aria-label="`Alignment ${index + 1} name`"
                      @input="clearMessages"
                    />
                  </div>
                  <div class="flex-1">
                    <input
                      v-model="alignment.targetUrl"
                      type="url"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="https://example.com/standard"
                      :aria-label="`Alignment ${index + 1} URL`"
                      @input="clearMessages"
                    />
                  </div>
                  <input
                    v-model="alignment.targetFramework"
                    type="text"
                    class="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Framework (optional)"
                    :aria-label="`Alignment ${index + 1} framework`"
                    @input="clearMessages"
                  />

                  <button
                    type="button"
                    class="p-2 text-red-600 hover:text-red-800"
                    :aria-label="`Remove alignment ${index + 1}`"
                    @click="removeAlignment(index)"
                  >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
                <button
                  type="button"
                  class="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  aria-label="Add new alignment"
                  @click="addAlignment"
                >
                  <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  Add Alignment
                </button>
              </div>
              <p class="mt-1 text-sm text-gray-500">
                Link this badge to educational standards or competency frameworks.
              </p>
            </div>
          </div>
        </div>

        <BadgeIssuerForm
          :badge="badgeData"
          :issuers="availableIssuers"
          :loading="isSubmitting"
          :accessible="true"
          @submit="handleSubmit"
          @cancel="handleCancel"
        />
      </div>

      <!-- Badge Preview -->
      <div class="space-y-6">
        <h2 class="text-lg font-semibold text-gray-900">Preview</h2>
        <div class="bg-gray-50 rounded-lg p-4">
          <BadgeDisplay
            v-if="badgeData.name || badgeData.description"
            :badge="previewBadge"
            :theme="'default'"
            :accessible="true"
            :show-details="true"
          />
          <div v-else class="text-center text-gray-500 py-8">
            <p>Badge preview will appear here as you fill out the form</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isSubmitting" class="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div class="flex items-center">
        <svg class="w-5 h-5 mr-3 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p class="text-blue-800">Creating badge...</p>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
      <div class="flex items-center">
        <svg
          class="w-5 h-5 mr-3 text-red-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <p class="text-red-800 font-medium">Error</p>
          <p class="text-red-700">
            {{ error }}
          </p>
        </div>
      </div>
    </div>

    <!-- Success Message -->
    <div
      v-if="successMessage"
      class="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg"
      role="alert"
    >
      <div class="flex items-center">
        <svg
          class="w-5 h-5 mr-3 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <p class="text-green-800 font-medium">Success</p>
          <p class="text-green-700">
            {{ successMessage }}
          </p>
        </div>
      </div>
    </div>

    <!-- Upload errors now handled by BadgeIssuerForm -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { BadgeIssuerForm, BadgeDisplay } from 'openbadges-ui'
import type { OB2 } from 'openbadges-types'
import { createIRI } from 'openbadges-types'
import { useAuth } from '@/composables/useAuth'
import { useBadges, type CreateBadgeData } from '@/composables/useBadges'
// Form validation and image upload now handled by BadgeIssuerForm

// Types now handled by BadgeIssuerForm

// Preview-specific interfaces to avoid type assertions
interface PreviewIssuer {
  id: string
  type: string | string[]
  name: string
  url?: string
  email?: string
  description?: string
}

interface PreviewBadgeData {
  id: string
  type: 'BadgeClass'
  name: string
  description: string
  image: string
  criteria: {
    narrative: string
    id?: string
  }
  issuer: PreviewIssuer
  tags: string[]
  alignment: any[]
}

const router = useRouter()
const { user } = useAuth()
const { createBadge } = useBadges()

// Component state
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const isSubmitting = ref(false)

// Badge form data - now managed by BadgeIssuerForm
const badgeData = ref<Partial<CreateBadgeData>>({
  name: '',
  description: '',
  image: '',
  criteria: {
    narrative: '',
  },
  tags: [],
  alignment: [],
})

// Available issuers (for now, just create a default issuer)
const availableIssuers = ref<OB2.Profile[]>([])

// Create preview badge for display
// Using PreviewBadgeData interface to avoid type assertions
const previewBadge = computed(
  (): PreviewBadgeData => ({
    id: '', // preview only - empty string for preview
    type: 'BadgeClass',
    name: badgeData.value.name || 'Badge Name',
    description: badgeData.value.description || 'Badge description will appear here',
    image: badgeData.value.image || '/placeholder-badge.png',
    criteria: {
      narrative: badgeData.value.criteria?.narrative || 'Badge criteria will appear here',
    },
    issuer: badgeData.value.issuer || {
      id: '', // preview only
      type: 'Profile',
      name: 'Default Issuer',
      url: window.location.origin,
      email: user.value?.email || 'admin@example.com',
    },
    tags: badgeData.value.tags || [],
    alignment: badgeData.value.alignment || [],
  })
)

// Initialize component
onMounted(async () => {
  // Create default issuer if user is available
  if (user.value) {
    const defaultIssuer: OB2.Profile = {
      id: createIRI(`${window.location.origin}/api/v1/profiles/${user.value.id}`),
      type: 'Profile',
      name: `${user.value.firstName} ${user.value.lastName}`,
      url: createIRI(window.location.origin),
      email: user.value.email,
      description: `Badge issuer profile for ${user.value.firstName} ${user.value.lastName}`,
    }

    availableIssuers.value = [defaultIssuer]

    // Set default issuer
    badgeData.value.issuer = defaultIssuer
  }
})

// Handle form submission
const handleSubmit = async (formData: CreateBadgeData) => {
  if (!user.value) {
    error.value = 'You must be logged in to create a badge'
    return
  }

  error.value = null
  successMessage.value = null
  isSubmitting.value = true

  try {
    // BadgeIssuerForm handles validation and OB2 compliance, so we can proceed directly
    const newBadge = await createBadge(user.value, formData)

    if (newBadge) {
      successMessage.value = 'Badge created successfully!'

      // Redirect to badge detail page after a short delay
      setTimeout(() => {
        router.push(`/badges/${newBadge.id}`)
      }, 2000)
    } else {
      error.value = 'Failed to create badge. Please try again.'
    }
  } catch (err) {
    console.error('Badge creation error:', err)

    if (err instanceof Error) {
      // Handle specific error types
      if (err.message.includes('network') || err.message.includes('fetch')) {
        error.value = 'Network error. Please check your connection and try again.'
      } else if (err.message.includes('unauthorized') || err.message.includes('auth')) {
        error.value = 'Authentication error. Please log in again.'
      } else if (err.message.includes('validation')) {
        error.value = 'Please check your input and try again.'
      } else {
        error.value = err.message
      }
    } else {
      error.value = 'An unexpected error occurred. Please try again.'
    }
  } finally {
    isSubmitting.value = false
  }
}

// Validation now handled by BadgeIssuerForm

// Add alignment object
const addAlignment = () => {
  badgeData.value.alignment = badgeData.value.alignment || []
  badgeData.value.alignment.push({
    targetName: '',
    targetUrl: createIRI(''),
    targetDescription: '',
  })
}

// Remove alignment object
const removeAlignment = (index: number) => {
  if (badgeData.value.alignment) {
    badgeData.value.alignment.splice(index, 1)
  }
}

// Handle cancel
const handleCancel = () => {
  router.push('/badges')
}

// Clear messages when user starts typing
const clearMessages = () => {
  error.value = null
  successMessage.value = null
}
</script>
