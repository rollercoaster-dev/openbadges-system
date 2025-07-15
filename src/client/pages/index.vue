<template>
    <div class="bg-white shadow rounded-lg p-6">
        <h2 class="text-2xl font-semibold text-slate-900 mb-4">
            Welcome to OpenBadges Demo
        </h2>

        <div class="prose max-w-none">
            <p class="text-slate-600 mb-4">
                This is a demonstration of the OpenBadges system using Bun,
                Hono, and Vue 3.
            </p>

            <div v-if="loading" class="text-center py-8">
                <div
                     class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                <p class="mt-2 text-slate-600">
                    Loading data from the server...
                </p>
            </div>

            <div v-else class="mt-6">
                <h3 class="text-lg font-medium text-slate-900 mb-2">
                    Server Status
                </h3>
                <div class="bg-slate-50 p-4 rounded-md">
                    <p v-if="serverStatus">
                        <span
                              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <svg
                                 class="-ml-0.5 mr-1.5 h-2 w-2 text-green-400"
                                 fill="currentColor"
                                 viewBox="0 0 8 8">
                                <circle cx="4" cy="4" r="3" />
                            </svg>
                            Connected
                        </span>
                        <span class="ml-2">Server is up and running</span>
                    </p>
                    <p v-else class="text-red-600">
                        Unable to connect to the server. Please make sure the
                        backend is running.
                    </p>
                </div>

                <div class="mt-6">
                    <h3 class="text-lg font-medium text-slate-900 mb-2">
                        OpenBadges Modular Server Status (via Proxy)
                    </h3>
                    <div v-if="modularServerLoading" class="text-center py-4">
                        <div
                             class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                        <p class="mt-2 text-sm text-slate-600">
                            Checking status...
                        </p>
                    </div>
                    <div v-else class="bg-slate-50 p-4 rounded-md">
                        <p v-if="modularServerStatus && modularServerStatus.startsWith('Connected')">
                            <span
                                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <svg
                                     class="-ml-0.5 mr-1.5 h-2 w-2 text-green-400"
                                     fill="currentColor"
                                     viewBox="0 0 8 8">
                                    <circle cx="4" cy="4" r="3" />
                                </svg>
                                Connected
                            </span>
                            <span class="ml-2">{{ modularServerStatus }}</span>
                        </p>
                        <p v-else class="text-red-600">
                            {{
                                modularServerStatus ||
                                "Failed to get status from OpenBadges Modular Server."
                            }}
                        </p>
                    </div>
                </div>

                <div class="mt-6">
                    <h3 class="text-lg font-medium text-slate-900 mb-2">
                        Featured Badge
                    </h3>
                    <div class="bg-slate-50 p-4 rounded-md">
                        <div v-if="featuredBadge">
                            <BadgeDisplay :badge="featuredBadge" />
                            <p v-if="badgeError" class="text-sm text-orange-600 mt-2">
                                Note: {{ badgeError }}. Showing fallback data.
                            </p>
                        </div>
                        <div v-else class="text-center py-4">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                            <p class="mt-2 text-sm text-slate-600">Loading badge data...</p>
                        </div>
                    </div>
                </div>

                <div class="mt-6">
                    <h3 class="text-lg font-medium text-slate-900 mb-2">
                        Next Steps
                    </h3>
                    <ul class="list-disc pl-5 space-y-2 text-slate-600">
                        <li>Explore the OpenBadges API</li>
                        <li>Create and issue badges</li>
                        <li>View and manage badge recipients</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { OB2 } from "openbadges-types";
import { BadgeDisplay } from "openbadges-ui";

const loading = ref(true);
const serverStatus = ref(false);
const modularServerLoading = ref(true);
const modularServerStatus = ref<string | null>(null);
const featuredBadge = ref<OB2.BadgeClass | null>(null);
const badgeError = ref<string | null>(null);

// Fallback mock badge for when no real badges are available
const mockBadge: OB2.BadgeClass = {
    type: "BadgeClass",
    id: "urn:uuid:demobadge123-monolith-master" as OB2.IRI,
    name: "Monolith Master Badge",
    description:
        "This badge is awarded for successfully setting up the demonstration monolith application and displaying this badge.",
    image: "https://via.placeholder.com/150/007bff/ffffff?Text=Monolith%20Badge" as OB2.IRI,
    criteria: {
        narrative:
            "Successfully integrate Bun, Hono, Vue, Vite, and display a badge from openbadges-ui using mock data.",
    },
    issuer: {
        type: "Profile",
        id: "urn:uuid:issuer-demo-project" as OB2.IRI,
        name: "OpenBadges Demo Project Issuer",
        url: "https://example.com/issuer/demoproject",
    },
};

// Check server status on component mount
onMounted(async () => {
    loading.value = true; // Set main loading true at the start
    modularServerLoading.value = true;

    const monolithHealthCheck = async () => {
        try {
            const response = await fetch("/api/health");
            if (response.ok) {
                const data = await response.json();
                serverStatus.value = data.status === "ok";
            } else {
                serverStatus.value = false;
                console.error(
                    "Monolith server status check failed:",
                    response.status,
                    response.statusText,
                );
            }
        } catch (error) {
            console.error("Error checking monolith server status:", error);
            serverStatus.value = false;
        }
    };

    const modularServerHealthCheck = async () => {
        try {
            const bsResponse = await fetch("/api/bs/health");
            if (bsResponse.ok) {
                const bsData = await bsResponse.json();
                // Check for valid health response structure
                if (bsData && bsData.status === "ok") {
                    const uptime = bsData.uptime ? Math.round(bsData.uptime) : 0;
                    const dbType = bsData.database?.type || "unknown";
                    modularServerStatus.value = `Connected (uptime: ${uptime}s, db: ${dbType})`;
                } else {
                    modularServerStatus.value = `Unexpected response: ${JSON.stringify(bsData).substring(0, 100)}`;
                }
            } else {
                modularServerStatus.value = `Error: ${bsResponse.status} ${bsResponse.statusText}`;
            }
        } catch (error) {
            console.error(
                "Error checking OpenBadges Modular Server status:",
                error,
            );
            modularServerStatus.value = "Connection attempt failed";
        }
    };

    const fetchFeaturedBadge = async () => {
        try {
            // Try to fetch badge classes from the modular server
            const response = await fetch("/api/bs/v2/badge-classes");
            if (response.ok) {
                const badgeClasses = await response.json();
                
                // Use the first badge class if available, otherwise fall back to mock
                if (Array.isArray(badgeClasses) && badgeClasses.length > 0) {
                    featuredBadge.value = badgeClasses[0] as OB2.BadgeClass;
                } else {
                    // No real badges available, use mock badge
                    featuredBadge.value = mockBadge;
                }
                badgeError.value = null;
            } else {
                console.warn("Failed to fetch badge classes, using mock badge");
                featuredBadge.value = mockBadge;
                badgeError.value = `Failed to fetch badges: ${response.status}`;
            }
        } catch (error) {
            console.error("Error fetching badge data:", error);
            featuredBadge.value = mockBadge;
            badgeError.value = "Connection error while fetching badges";
        }
    };

    await Promise.all([monolithHealthCheck(), modularServerHealthCheck(), fetchFeaturedBadge()]);

    loading.value = false;
    modularServerLoading.value = false;
});
</script>
