import { createI18n } from 'vue-i18n'
import zhCN from './zh-CN'
import en from './en'
import { useAppStore } from '@/store/app'

export const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en',
  messages: {
    'zh-CN': zhCN,
    en,
  },
})

export type AppLocale = 'zh-CN' | 'en'

/** 切换语言：i18n + 持久化 + html lang 同步（无需刷新，Element Plus 由 ConfigProvider 响应） */
export function setLocale(locale: AppLocale) {
  ;(i18n.global.locale as any).value = locale
  useAppStore().locale = locale
  document.documentElement.lang = locale
}
