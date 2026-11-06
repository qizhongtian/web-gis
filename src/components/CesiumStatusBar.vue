<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCesiumOptional } from '@/composables/useCesium'

/**
 * Cesium 底部状态栏
 * - 自动获取父级 <CesiumViewer> 的 viewer（也可通过 viewer 属性手动传入）
 * - 2D / 3D 切换、地下模式切换、相机坐标与姿态实时展示
 * - 事件监听与 rAF 在卸载 / viewer 销毁时自动清理
 */
const props = defineProps<{
  /** 手动传入 viewer；不传则自动注入上级 CesiumViewer 实例 */
  viewer?: any
}>()

const { t } = useI18n()
const injected = useCesiumOptional()
const viewerRef = computed<any>(() => props.viewer || injected?.value)

const state = reactive({
  lon: 0,
  lat: 0,
  height: 0,
  east: 0,
  north: 0,
  x: 0,
  y: 0,
  z: 0,
  heading: 0,
  pitch: 0,
  roll: 0,
  is2d: false,
  underground: false,
})

const DEG = 180 / Math.PI
const MERCATOR_R = 6378137

let off: (() => void) | null = null
let cameraOff: (() => void) | null = null
let rafId = 0

function read(v: any) {
  const cam = v.camera
  const carto = cam.positionCartographic
  const lon = carto.longitude * DEG
  const lat = carto.latitude * DEG

  state.lon = lon
  state.lat = lat
  state.height = carto.height
  // 墨卡托投影 E/N（米）
  state.east = lon * (MERCATOR_R * Math.PI) / 180
  state.north = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * MERCATOR_R
  // 相机 ECEF 笛卡尔坐标（米）
  const p = cam.positionWC
  state.x = p.x
  state.y = p.y
  state.z = p.z
  // 姿态（度）
  state.heading = cam.heading * DEG
  state.pitch = cam.pitch * DEG
  state.roll = cam.roll * DEG
  // 场景模式：2 = SCENE2D，1 = COLUMBUS_VIEW，3 = SCENE3D
  state.is2d = v.scene.mode === 2 || v.scene.mode === 1
  state.underground = v.scene.screenSpaceCameraController.enableCollisionDetection === false
}

function schedule(v: any) {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    if (!v || v.isDestroyed?.()) return
    read(v)
  })
}

function bindCamera(v: any) {
  const handler = () => schedule(v)
  v.camera.percentageChanged = 0.005
  v.camera.changed.addEventListener(handler)
  return () => {
    if (!v.isDestroyed?.()) v.camera.changed.removeEventListener(handler)
  }
}

function bind(v: any) {
  if (!v || v.isDestroyed?.()) return
  cameraOff = bindCamera(v)

  // 2D / 3D 切换过程中 Cesium 会重建相机，morph 完成后重新绑定
  const onMorph = () => {
    cameraOff?.()
    cameraOff = bindCamera(v)
    schedule(v)
  }
  v.scene.morphComplete?.addEventListener(onMorph)
  off = () => {
    if (!v.isDestroyed?.()) v.scene.morphComplete?.removeEventListener(onMorph)
    cameraOff?.()
    cameraOff = null
  }
  read(v)
}

function unbind() {
  off?.()
  off = null
  cameraOff?.()
  cameraOff = null
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
}

watch(
  viewerRef,
  (v) => {
    unbind()
    if (v) bind(v)
  },
  { immediate: true, flush: 'post' },
)

onBeforeUnmount(unbind)

function toggleMode() {
  const v = viewerRef.value
  if (!v || v.isDestroyed?.()) return
  if (state.is2d) v.scene.morphTo3D(0.6)
  else v.scene.morphTo2D(0.6)
}

function toggleUnderground() {
  const v = viewerRef.value
  if (!v || v.isDestroyed?.()) return
  const next = !state.underground
  const scene = v.scene
  scene.screenSpaceCameraController.enableCollisionDetection = !next
  // 地下视角需要半透明地球，否则会被地表遮挡
  if (scene.globe?.translucency) {
    scene.globe.translucency.enabled = next
    scene.globe.translucency.frontFaceAlpha = next ? 0.45 : 1.0
  }
  state.underground = next
}

function fmt(v: number, digits: number) {
  return Number.isFinite(v) ? v.toFixed(digits) : '-'
}
</script>

<template>
  <div class="cesium-status">
    <button
      type="button"
      class="status-chip"
      :title="state.is2d ? t('cesium.to3d') : t('cesium.to2d')"
      @click="toggleMode"
    >
      <span class="dot" :class="{ 'dot--on': !state.is2d }" />
      {{ state.is2d ? '2D' : '3D' }}
    </button>

    <span class="status-item">
      <em>{{ t('cesium.longitude') }}</em><b>{{ fmt(state.lon, 6) }}</b>
    </span>
    <span class="status-item">
      <em>{{ t('cesium.latitude') }}</em><b>{{ fmt(state.lat, 6) }}</b>
    </span>
    <span class="status-item">
      <em>{{ t('cesium.height') }}</em><b>{{ fmt(state.height, 2) }} m</b>
    </span>
    <span class="status-item">
      <em>HK_E</em><b>{{ fmt(state.east, 3) }} m</b>
    </span>
    <span class="status-item">
      <em>HK_N</em><b>{{ fmt(state.north, 3) }} m</b>
    </span>
    <span class="status-item">
      <em>X</em><b>{{ fmt(state.x, 3) }}</b>
    </span>
    <span class="status-item">
      <em>Y</em><b>{{ fmt(state.y, 3) }}</b>
    </span>
    <span class="status-item">
      <em>Z</em><b>{{ fmt(state.z, 3) }}</b>
    </span>
    <span class="status-item">
      <em>Heading</em><b>{{ fmt(state.heading, 6) }}</b>
    </span>
    <span class="status-item">
      <em>Pitch</em><b>{{ fmt(state.pitch, 6) }}</b>
    </span>
    <span class="status-item">
      <em>Roll</em><b>{{ fmt(state.roll, 6) }}</b>
    </span>

    <button
      type="button"
      class="status-chip"
      :title="state.underground ? t('cesium.undergroundOff') : t('cesium.undergroundOn')"
      @click="toggleUnderground"
    >
      <span class="dot dot--green" :class="{ 'dot--on': state.underground }" />
      {{ t('cesium.underground') }}
    </button>
  </div>
</template>

<style scoped>
.cesium-status {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: calc(100% - 24px);
  padding: 6px 14px;
  overflow-x: auto;
  white-space: nowrap;
  border-radius: 7px;
  border: 1px solid rgba(56, 132, 255, 0.45);
  background: rgba(8, 18, 32, 0.82);
  backdrop-filter: blur(8px);
  color: #e6edf7;
  font-size: 12px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  scrollbar-width: none;
}
.cesium-status::-webkit-scrollbar {
  display: none;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  padding: 2px 4px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: color 0.15s ease;
}
.status-chip:hover {
  color: #fff;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.75);
  background: transparent;
  transition: all 0.15s ease;
}
.dot--on {
  background: #fff;
  border-color: #fff;
}
.dot--green.dot--on {
  background: #34d399;
  border-color: #34d399;
}

.status-item {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  flex: none;
}
.status-item em {
  font-style: normal;
  color: #8fa7c4;
}
.status-item b {
  font-weight: 400;
  color: #e6edf7;
}
</style>
