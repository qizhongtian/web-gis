/**
 * 顶部路由进度条（零依赖，nprogress 的轻量替代）
 * 跳转开始 -> 顶部出现细进度条并缓慢爬升；导航完成 -> 铺满 100% 后淡出。
 */

const BAR_ID = 'route-progress'
const STYLE_ID = 'route-progress-style'

const BAR_CSS = `
#${BAR_ID} {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 3000;
  width: 0;
  height: 2px;
  pointer-events: none;
  opacity: 0;
  border-radius: 0 2px 2px 0;
  background: var(--app-primary, #2563eb);
  box-shadow: 0 0 8px rgba(37, 99, 235, 0.45);
  transition: width 0.2s ease, opacity 0.25s ease;
}
#${BAR_ID}.is-active {
  opacity: 1;
}
#${BAR_ID}.is-fail {
  background: #dc2626;
  box-shadow: 0 0 8px rgba(220, 38, 38, 0.45);
}
`

/** 耗时少于该值的跳转不显示进度条，避免一闪而过 */
const SHOW_DELAY = 120
/** 爬升速度：每次向 90% 逼近的比例 */
const TRICKLE_STEP = 0.12
const TRICKLE_INTERVAL = 220

let bar: HTMLDivElement | null = null
let showTimer: number | undefined
let trickleTimer: number | undefined
let hideTimer: number | undefined
let value = 0
/** 计数令牌：避免上一次导航的延时回调影响新一次导航 */
let token = 0

function getBar(): HTMLDivElement {
  if (bar?.isConnected) return bar

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = BAR_CSS
    document.head.appendChild(style)
  }

  bar = document.createElement('div')
  bar.id = BAR_ID
  document.body.appendChild(bar)
  return bar
}

function setWidth(v: number, animate = true) {
  const el = getBar()
  if (animate) {
    el.style.transition = ''
  } else {
    el.style.transition = 'none'
    el.style.width = `${v}%`
    // 强制重排，保证下一次宽度变化能带上过渡动画
    void el.offsetWidth
    el.style.transition = ''
    return
  }
  el.style.width = `${v}%`
}

function clearTimers() {
  window.clearTimeout(showTimer)
  window.clearInterval(trickleTimer)
  window.clearTimeout(hideTimer)
}

/** 开始（页面跳转） */
export function startProgress() {
  if (typeof document === 'undefined') return

  const current = ++token
  clearTimers()

  const el = getBar()
  el.classList.remove('is-active', 'is-fail')
  setWidth(0, false)
  value = 8

  showTimer = window.setTimeout(() => {
    if (current !== token) return
    el.classList.add('is-active')
    setWidth(value)
    trickleTimer = window.setInterval(() => {
      value += (90 - value) * TRICKLE_STEP
      setWidth(value)
    }, TRICKLE_INTERVAL)
  }, SHOW_DELAY)
}

/** 完成（导航成功） */
export function doneProgress() {
  if (typeof document === 'undefined') return

  const current = ++token
  clearTimers()

  const el = getBar()
  el.classList.remove('is-fail')

  if (!el.classList.contains('is-active')) {
    // 尚未显示（快速跳转），直接归零即可
    setWidth(0, false)
    return
  }

  setWidth(100)
  hideTimer = window.setTimeout(() => {
    if (current !== token) return
    el.classList.remove('is-active')
    hideTimer = window.setTimeout(() => {
      if (current !== token) return
      setWidth(0, false)
    }, 260)
  }, 180)
}

/** 失败（导航出错 / 被中断） */
export function failProgress() {
  if (typeof document === 'undefined') return

  const current = ++token
  clearTimers()

  const el = getBar()
  el.classList.add('is-active', 'is-fail')
  setWidth(100)
  hideTimer = window.setTimeout(() => {
    if (current !== token) return
    el.classList.remove('is-active')
    hideTimer = window.setTimeout(() => {
      if (current !== token) return
      el.classList.remove('is-fail')
      setWidth(0, false)
    }, 260)
  }, 420)
}
