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
                        <p v-if="modularServerStatus === 'Connected'">
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
                            <span class="ml-2">Successfully connected to OpenBadges Modular
                                Server.</span>
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
                        <BadgeDisplay :badge="mockBadge" />
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
import type { BadgeClassV2UI } from "openbadges-types";
import { BadgeDisplay } from "openbadges-ui"; // Corrected import

const loading = ref(true);
const serverStatus = ref(false);
const modularServerLoading = ref(true);
const modularServerStatus = ref<string | null>(null);

const mockBadge = ref<BadgeClassV2UI>({
    // @ts-ignore - type: 'BadgeClass' is technically a subset of the full type definition, but valid for usage.
    type: "BadgeClass",
    id: "urn:uuid:demobadge123-monolith-master",
    name: "Monolith Master Badge",
    description:
        "This badge is awarded for successfully setting up the demonstration monolith application and displaying this badge.",
    image: "https://via.placeholder.com/150/007bff/ffffff?Text=Monolith%20Badge", // Placeholder image
    criteria: {
        narrative:
            "Successfully integrate Bun, Hono, Vue, Vite, and display a badge from openbadges-ui using mock data.",
    },
    issuer: {
        // @ts-ignore - type: 'Issuer' is technically a subset of the full type definition, but valid for usage.
        type: "Issuer",
        id: "urn:uuid:issuer-demo-project",
        name: "OpenBadges Demo Project Issuer",
        url: "https://example.com/issuer/demoproject",
    },
});

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
                if (bsData && bsData.success === true) {
                    modularServerStatus.value = "Connected";
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

    await Promise.all([monolithHealthCheck(), modularServerHealthCheck()]);

    loading.value = false;
    modularServerLoading.value = false;
});
</script>
