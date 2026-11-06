<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import { useAppStore } from '@/store/app'

const { locale } = useI18n()
const appStore = useAppStore()

locale.value = appStore.locale
document.documentElement.lang = appStore.locale

/** 语言状态唯一来源：store；任何地方切换都会即时生效 */
watch(
  () => appStore.locale,
  (v) => {
    locale.value = v
    document.documentElement.lang = v
  },
  { immediate: true },
)

const elementLocale = computed(() => (appStore.locale === 'zh-CN' ? zhCn : en))
</script>

<template>
  <ElConfigProvider :locale="elementLocale">
    <router-view />
  </ElConfigProvider>
</template>
