<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 28 })
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 32 32" fill="none" aria-label="WebGIS">
    <rect width="32" height="32" rx="9" fill="#2563eb" />
    <path
      d="M16 7.2l7 4.05v9.5l-7 4.05-7-4.05v-9.5l7-4.05z"
      stroke="#fff"
      stroke-width="1.7"
      stroke-linejoin="round"
    />
    <path d="M9 11.25l7 4.05 7-4.05M16 15.3v9.4" stroke="#fff" stroke-width="1.7" stroke-linejoin="round" opacity="0.7" />
  </svg>
</template>
