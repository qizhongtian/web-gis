import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { ElLoading } from 'element-plus'
import * as Icons from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import { i18n, setLocale } from './i18n'
import { useAppStore } from './store/app'
import { permission } from './directives/permission'
import './permission'
import 'virtual:uno.css'
// Element Plus 组件由 unplugin-vue-components 按需自动引入，这里只保留全量样式
import 'element-plus/dist/index.css'
import './styles/index.css'

const app = createApp(App)

// 图标在模板中通过 <component :is="menu.icon" /> 动态使用，需全局注册
Object.entries(Icons).forEach(([name, comp]) => app.component(name, comp))

app.use(createPinia())
// i18n 默认 zh-CN，这里按上次持久化的语言恢复，保证刷新后语言与开机文案一致
setLocale(useAppStore().locale)
app.use(router)
app.use(i18n)
// Element Plus 按需引入后不再 app.use(ElementPlus)，单独注册常用指令
app.directive('loading', ElLoading.directive)
app.directive('permission', permission)

app.mount('#app')

/* ---------------- 首屏开机动画 ---------------- */
const bootEl = document.getElementById('boot-screen')
// 开机文案与 i18n 同源（index.html 内联脚本已按语言预置，这里再确认一次）
const bootTextEl = bootEl?.querySelector<HTMLElement>('.gis-load__text')
if (bootTextEl) bootTextEl.textContent = i18n.global.t('common.appName')
const bootDescEl = bootEl?.querySelector<HTMLElement>('.gis-load__desc')
if (bootDescEl) bootDescEl.textContent = i18n.global.t('common.booting')

const bootAt = performance.now()
let bootHidden = false

function hideBoot() {
  if (bootHidden || !bootEl) return
  bootHidden = true
  // 至少展示 650ms，避免一闪而过
  const wait = Math.max(0, 650 - (performance.now() - bootAt))
  window.setTimeout(() => {
    document.documentElement.classList.remove('is-booting')
    bootEl.classList.add('is-done')
    window.setTimeout(() => bootEl.remove(), 700)
  }, wait)
}

// 路由（含动态菜单注册）就绪后再淡出
router
  .isReady()
  .then(() => requestAnimationFrame(hideBoot))
  .catch(() => hideBoot())

// 兜底：任何异常都不应让遮罩常驻
window.setTimeout(hideBoot, 12000)
