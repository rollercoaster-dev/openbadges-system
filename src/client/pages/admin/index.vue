<template>
  <div class="max-w-6xl mx-auto mt-8">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <!-- Quick stats placeholder -->
      <div class="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <h2 class="text-lg font-semibold mb-2">System Stats</h2>
        <p class="text-gray-500">Users, badges, issuers counts</p>
      </div>
      
      <div class="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <h2 class="text-lg font-semibold mb-2">Recent Activity</h2>
        <p class="text-gray-500">Latest registrations, badge issues</p>
      </div>
      
      <div class="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <h2 class="text-lg font-semibold mb-2">System Health</h2>
        <p class="text-gray-500">Server status, database health</p>
      </div>
    </div>
    
    <div class="space-y-6">
      <!-- Admin actions placeholder -->
      <div class="border-2 border-dashed border-gray-300 rounded-lg p-8">
        <h2 class="text-lg font-semibold mb-4">Quick Actions</h2>
        <p class="text-gray-500">Common admin tasks and shortcuts</p>
      </div>
      
      <!-- Recent activity placeholder -->
      <div class="border-2 border-dashed border-gray-300 rounded-lg p-8">
        <h2 class="text-lg font-semibold mb-4">Recent Activity Log</h2>
        <p class="text-gray-500">System activity, user actions, errors</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Admin dashboard logic will go here
</script>