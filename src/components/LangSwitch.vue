<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/store/app'
import { setLocale } from '@/i18n'

const appStore = useAppStore()

const isZh = computed(() => appStore.locale === 'zh-CN')
// 提示语显示“切换目标语言”
const tooltip = computed(() => (isZh.value ? 'English' : '中文'))

function toggle() {
  setLocale(isZh.value ? 'en' : 'zh-CN')
}
</script>

<template>
  <el-tooltip :content="tooltip" placement="bottom" :show-after="200">
    <button
      type="button"
      class="lang-icon"
      :aria-label="tooltip"
      @click="toggle"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linecap="round"
      >
        <circle cx="10" cy="10" r="7.25" />
        <path d="M2.75 10h14.5" />
        <path d="M10 2.75c1.9 2.05 2.9 4.5 2.9 7.25S11.9 15.2 10 17.25C8.1 15.2 7.1 12.75 7.1 10S8.1 4.8 10 2.75z" />
      </svg>
    </button>
  </el-tooltip>
</template>

<style scoped>
.lang-icon {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  color: #6b7280;
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.15s ease;
}
.lang-icon:hover {
  color: #1f2328;
}
</style>
