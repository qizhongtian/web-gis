<script setup lang="ts">
import type { WeatherKind } from '@/composables/useWeather'

withDefaults(
  defineProps<{
    kind: WeatherKind
    isDay?: boolean
    size?: number
  }>(),
  { isDay: true, size: 20 },
)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- 晴（白天） -->
    <template v-if="kind === 'clear' && isDay">
      <circle cx="12" cy="12" r="4.1" />
      <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6" />
    </template>

    <!-- 晴（夜间）：月亮 -->
    <template v-else-if="kind === 'clear'">
      <path d="M20.2 14.6A8.4 8.4 0 0 1 9.4 3.8a8.6 8.6 0 1 0 10.8 10.8Z" />
    </template>

    <!-- 多云：太阳/月亮 + 云 -->
    <template v-else-if="kind === 'partly'">
      <template v-if="isDay">
        <circle cx="8.4" cy="8" r="2.7" />
        <path d="M8.4 2.9v1.4M3.3 8h1.4M4.8 4.4l1 1M12 4.4l-1 1" />
      </template>
      <path v-else d="M12.6 7.6a4.3 4.3 0 0 1-5.1-5 4.4 4.4 0 0 0 5.4 5.4" />
      <path d="M7.6 18.6h9.1a3.2 3.2 0 0 0 .4-6.4 4.4 4.4 0 0 0-8.4 1.1 2.9 2.9 0 0 0-1.1 5.3Z" />
    </template>

    <!-- 阴 -->
    <template v-else-if="kind === 'cloudy'">
      <path d="M7.4 15.4h10a3 3 0 0 0 .4-6 4.6 4.6 0 0 0-8.8 1.1 2.8 2.8 0 0 0-1.6 4.9Z" />
      <path d="M6 18.8h9.2" />
    </template>

    <!-- 雾 -->
    <template v-else-if="kind === 'fog'">
      <path d="M7.4 12.4h9.9a3 3 0 0 0 .4-6 4.6 4.6 0 0 0-8.8 1.1 2.8 2.8 0 0 0-1.5 4.9Z" />
      <path d="M4.6 16h14.8M6.6 19.2h10.8" />
    </template>

    <!-- 毛毛雨 -->
    <template v-else-if="kind === 'drizzle'">
      <path d="M7.6 13.6h9.4a3 3 0 0 0 .4-5.9 4.5 4.5 0 0 0-8.6 1.1 2.7 2.7 0 0 0-1.2 4.8Z" />
      <path d="M9.4 16.4v1.4M13 16.4v1.4M16.6 16.4v1.4" />
    </template>

    <!-- 雨 -->
    <template v-else-if="kind === 'rain'">
      <path d="M7.6 13.4h9.4a3 3 0 0 0 .4-5.9 4.5 4.5 0 0 0-8.6 1.1 2.7 2.7 0 0 0-1.2 4.8Z" />
      <path d="M9.2 16.2 8.2 19M12.4 16.2 11.4 19M15.6 16.2 14.6 19" />
    </template>

    <!-- 雪 -->
    <template v-else-if="kind === 'snow'">
      <path d="M7.6 13h9.4a3 3 0 0 0 .4-5.9 4.5 4.5 0 0 0-8.6 1.1 2.7 2.7 0 0 0-1.2 4.8Z" />
      <path d="M9 16.6v2.6M7.9 17.2l2.2 1.4M10.1 17.2 7.9 18.6M15 16.6v2.6M13.9 17.2l2.2 1.4M16.1 17.2 13.9 18.6" />
    </template>

    <!-- 雷阵雨 -->
    <template v-else>
      <path d="M7.6 12.6h9.4a3 3 0 0 0 .4-5.9 4.5 4.5 0 0 0-8.6 1.1 2.7 2.7 0 0 0-1.2 4.8Z" />
      <path d="m12.8 15-2 3.4h2.6L11.6 22" />
    </template>
  </svg>
</template>
