<script setup lang="ts">
import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  provide,
  ref,
  shallowRef,
} from 'vue'
import { useI18n } from 'vue-i18n'
import CesiumStatusBar from './CesiumStatusBar.vue'
import { CESIUM_LIB_KEY, CESIUM_VIEWER_KEY } from '@/composables/useCesium'
import { loadCesium } from '@/utils/gis/cesiumLoader'
import { createViewer } from '@/utils/gis/cesiumInit'

/**
 * Cesium 公共容器组件
 * - 本地加载 Cesium（public/cesium，不走 CDN）
 * - 启动动画：库加载 + 场景瓦片加载两阶段，带进度条
 * - 通过 provide 向下暴露 viewer 与 Cesium 命名空间（子孙组件用 useCesium / useCesiumLib）
 * - 卸载时断开 ResizeObserver、移除事件、销毁 Viewer，避免 canvas / WebGL 上下文泄漏
 * - 内置自适应（容器尺寸变化，如菜单收起时调用 viewer.resize）
 */
const props = withDefaults(
  defineProps<{
    /** 覆盖默认 Viewer 配置 */
    options?: Record<string, any>
    /** 初始视角 [经度, 纬度, 高度(米)] */
    home?: [number, number, number]
    /** 是否显示底部状态栏 */
    statusBar?: boolean
    /** 是否显示加载遮罩 */
    showLoading?: boolean
    /** 自定义 XYZ 影像底图（替代默认 OSM），如香港影像服务 */
    imageryUrl?: string
    /** 自定义影像最大层级 */
    imageryMaxLevel?: number
  }>(),
  {
    statusBar: true,
    showLoading: true,
    imageryMaxLevel: 20,
  },
)

const emit = defineEmits<{
  ready: [viewer: any]
  destroyed: []
  error: [message: string]
}>()

const { t } = useI18n()

const el = ref<HTMLElement>()
const viewer = shallowRef<any>()
const cesium = shallowRef<any>()
/** 库加载中 */
const loading = ref(true)
/** 场景（地形 / 影像瓦片）加载中 */
const sceneLoading = ref(false)
const progress = ref<number | null>(null)
const error = ref('')

const overlayVisible = computed(() => props.showLoading && (loading.value || sceneLoading.value))
const overlayTitle = computed(() =>
  sceneLoading.value ? t('common.loadingScene') : t('common.loadingEngine'),
)
const overlayDesc = computed(() =>
  sceneLoading.value ? t('common.loadingSceneDesc') : t('common.loadingEngineDesc'),
)

provide(CESIUM_VIEWER_KEY, viewer)
provide(CESIUM_LIB_KEY, cesium)

let disposed = false
let resizeObserver: ResizeObserver | null = null
let resizeRaf = 0
/** 场景首屏瓦片监听清理函数 */
let stopSceneWatch: (() => void) | null = null

function observeResize(v: any) {
  if (!el.value || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(() => {
    if (resizeRaf) return
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0
      if (!v.isDestroyed?.()) v.resize()
    })
  })
  resizeObserver.observe(el.value)
}

/**
 * 等待首屏地形 / 影像瓦片加载完成
 * 通过 globe.tileLoadProgressEvent 计算进度，首帧 + tilesLoaded 立即结束，最长 9s 兜底
 */
function watchSceneReady(v: any) {
  const scene = v.scene
  const globe = scene?.globe
  if (!globe?.tileLoadProgressEvent) return

  sceneLoading.value = true
  progress.value = 8

  let maxQueued = 1
  let done = false
  let timer = 0

  const cleanup = () => {
    window.clearTimeout(timer)
    globe.tileLoadProgressEvent.removeEventListener(onProgress)
    scene.postRender.removeEventListener(onFirstRender)
    if (stopSceneWatch === cleanup) stopSceneWatch = null
  }

  const finish = () => {
    if (done) return
    done = true
    progress.value = 100
    cleanup()
    window.setTimeout(() => {
      sceneLoading.value = false
      progress.value = null
    }, 320)
  }

  function onProgress(queued: number) {
    maxQueued = Math.max(maxQueued, queued)
    if (queued <= 0) {
      finish()
      return
    }
    const ratio = (maxQueued - queued) / maxQueued
    progress.value = Math.min(94, 18 + ratio * 72)
  }

  function onFirstRender() {
    scene.postRender.removeEventListener(onFirstRender)
    if (globe.tilesLoaded) finish()
  }

  globe.tileLoadProgressEvent.addEventListener(onProgress)
  scene.postRender.addEventListener(onFirstRender)
  timer = window.setTimeout(finish, 9000)
  stopSceneWatch = cleanup
}

function destroyViewer() {
  // 先断开监听，再销毁，避免销毁过程中回调访问已释放对象
  if (resizeRaf) {
    cancelAnimationFrame(resizeRaf)
    resizeRaf = 0
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  stopSceneWatch?.()
  stopSceneWatch = null
  sceneLoading.value = false
  progress.value = null

  const v = viewer.value
  // 先清空引用，让子组件 watch 先收到 undefined 并解绑
  viewer.value = undefined
  cesium.value = undefined
  if (v && !v.isDestroyed?.()) {
    v.destroy()
    emit('destroyed')
  }
}

/** 合并自定义底图配置：传 imageryUrl 时替换默认 OSM 底图 */
function buildOptions(C: any) {
  if (!props.imageryUrl) return props.options
  return {
    ...props.options,
    baseLayer: new C.ImageryLayer(
      new C.UrlTemplateImageryProvider({
        url: props.imageryUrl,
        maximumLevel: props.imageryMaxLevel,
        credit: '',
      }),
    ),
  }
}

function applyHome(v: any, C: any) {
  if (!props.home) return
  const [lon, lat, height] = props.home
  v.camera.setView({ destination: C.Cartesian3.fromDegrees(lon, lat, height) })
}

async function boot() {
  if (!el.value) return
  error.value = ''
  loading.value = true
  try {
    const C = await loadCesium()
    // 加载是异步的，期间组件可能已卸载
    if (disposed || !el.value) return
    const v = createViewer(C, el.value, buildOptions(C))
    cesium.value = C
    viewer.value = v
    // 开发期调试入口（生产构建不会执行）
    if (import.meta.env.DEV) (window as any).__cesiumViewer = v
    applyHome(v, C)
    observeResize(v)
    // 保持遮罩：等首屏瓦片就绪
    watchSceneReady(v)
    emit('ready', v)
  } catch (e: any) {
    if (disposed) return
    error.value = e?.message || String(e)
    emit('error', error.value)
  } finally {
    if (!disposed) loading.value = false
  }
}

function reload() {
  destroyViewer()
  boot()
}

onMounted(boot)

// 被 keep-alive 缓存时暂停渲染循环，避免隐藏页面持续占用 GPU；回到页面再恢复
onDeactivated(() => {
  const v = viewer.value
  if (v && !v.isDestroyed?.()) v.useDefaultRenderLoop = false
})

onActivated(() => {
  const v = viewer.value
  if (!v || v.isDestroyed?.()) return
  v.useDefaultRenderLoop = true
  v.resize()
  v.scene?.requestRender?.()
})

// 用 onUnmounted 而非 onBeforeUnmount：确保子组件先完成解绑，再销毁 Viewer
onUnmounted(() => {
  disposed = true
  destroyViewer()
})

defineExpose({ viewer, cesium, reload })
</script>

<template>
  <div class="relative w-full h-full overflow-hidden bg-[#0a1a28]">
    <div ref="el" class="absolute inset-0" />

    <!-- 子孙组件（useCesium / useCesiumLib） -->
    <slot />

    <CesiumStatusBar v-if="statusBar && viewer" />

    <Transition name="gis-fade">
      <GisLoading
        v-if="overlayVisible"
        overlay
        tech
        :title="overlayTitle"
        :desc="overlayDesc"
        :progress="sceneLoading ? progress : null"
      />
    </Transition>

    <Transition name="gis-fade">
      <div
        v-if="!overlayVisible && error"
        class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-6 bg-white/95"
      >
        <el-icon class="text-2xl text-[#ef4444]"><CircleCloseFilled /></el-icon>
        <span class="text-[13px] text-[#6b7280]">{{ t('common.libError') }}</span>
        <span class="text-[11px] text-[#9ca3af] max-w-80 break-all text-center">{{ error }}</span>
        <el-button size="small" type="primary" @click="reload">{{ t('common.retry') }}</el-button>
      </div>
    </Transition>
  </div>
</template>
