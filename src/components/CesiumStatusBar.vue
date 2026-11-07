<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCesiumOptional } from '@/composables/useCesium'

/**
 * Cesium 底部状态栏（科技风）
 * - 自动获取父级 <CesiumViewer> 的 viewer（也可通过 viewer 属性手动传入）
 * - 3D / 2D 开关、地下模式开关、地下透明度滑块、相机坐标与姿态实时展示
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
  /** 地下模式地表透明度（%，越大越透明） */
  transparency: 55,
})

const DEG = 180 / Math.PI
const MERCATOR_R = 6378137
/** 地表最小不透明度，避免地球完全消失 */
const MIN_ALPHA = 0.1

let off: (() => void) | null = null
let cameraOff: (() => void) | null = null
let rafId = 0
/** morph 动画期间忽略场景模式回读，避免开关状态回跳 */
let morphing = false

function alphaOf(percent: number) {
  return Math.min(1, Math.max(MIN_ALPHA, 1 - percent / 100))
}

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
  if (!morphing) state.is2d = v.scene.mode === 2 || v.scene.mode === 1
  state.underground = v.scene.screenSpaceCameraController.enableCollisionDetection === false

  const tr = v.scene.globe?.translucency
  if (state.underground && tr?.enabled) {
    const percent = Math.round((1 - tr.frontFaceAlpha) * 100)
    if (Number.isFinite(percent)) state.transparency = Math.min(90, Math.max(0, percent))
  }
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
    morphing = false
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
  const to2d = !state.is2d
  state.is2d = to2d
  morphing = true
  if (to2d) v.scene.morphTo2D(0.6)
  else v.scene.morphTo3D(0.6)
}

/** 按当前开关状态与透明度同步场景 */
function applyUnderground() {
  const v = viewerRef.value
  if (!v || v.isDestroyed?.()) return
  const scene = v.scene
  const on = state.underground
  scene.screenSpaceCameraController.enableCollisionDetection = !on
  // 地下视角需要半透明地球，否则会被地表遮挡
  const tr = scene.globe?.translucency
  if (!tr) return
  tr.enabled = on
  if (on) {
    const alpha = alphaOf(state.transparency)
    tr.frontFaceAlpha = alpha
    tr.backFaceAlpha = Math.max(alpha - 0.2, MIN_ALPHA)
  } else {
    tr.frontFaceAlpha = 1
    tr.backFaceAlpha = 1
  }
}

function toggleUnderground() {
  state.underground = !state.underground
  applyUnderground()
}

function onTransparency(val: number | number[]) {
  state.transparency = Array.isArray(val) ? Number(val[0]) : val
  if (state.underground) applyUnderground()
}

function fmt(v: number, digits: number) {
  return Number.isFinite(v) ? v.toFixed(digits) : '-'
}
</script>

<template>
  <div class="cesium-status" :class="{ 'is-underground': state.underground }">
    <i class="br br--tl" />
    <i class="br br--tr" />
    <i class="br br--bl" />
    <i class="br br--br" />

    <div class="ctrl">
      <span class="ctrl-item">
        <span class="ctrl-label">{{ t('cesium.mode3d') }}</span>
        <el-switch
          class="tech-switch"
          size="small"
          :model-value="!state.is2d"
          :aria-label="state.is2d ? t('cesium.to3d') : t('cesium.to2d')"
          @change="toggleMode"
        />
      </span>

      <span class="ctrl-item">
        <span class="ctrl-label">{{ t('cesium.underground') }}</span>
        <el-switch
          class="tech-switch tech-switch--green"
          size="small"
          :model-value="state.underground"
          :aria-label="state.underground ? t('cesium.undergroundOff') : t('cesium.undergroundOn')"
          @change="toggleUnderground"
        />
      </span>

      <span v-if="state.underground" class="ctrl-item ctrl-item--alpha">
        <span class="ctrl-label">{{ t('cesium.transparency') }}</span>
        <el-slider
          class="tech-slider"
          size="small"
          :model-value="state.transparency"
          :min="0"
          :max="90"
          :step="1"
          :show-tooltip="false"
          @update:model-value="onTransparency"
        />
        <span class="ctrl-value">{{ Math.round(state.transparency) }}%</span>
      </span>
    </div>

    <i class="v-sep" />

    <div class="metrics">
      <span class="live"><i /></span>
      <span class="status-item">
        <em>{{ t('cesium.longitude') }}</em><b>{{ fmt(state.lon, 6) }}</b>
      </span>
      <span class="status-item">
        <em>{{ t('cesium.latitude') }}</em><b>{{ fmt(state.lat, 6) }}</b>
      </span>
      <span class="status-item">
        <em>{{ t('cesium.height') }}</em><b>{{ fmt(state.height, 2) }} m</b>
      </span>

      <i class="m-sep" />

      <span class="status-item">
        <em>HK_E</em><b>{{ fmt(state.east, 3) }} m</b>
      </span>
      <span class="status-item">
        <em>HK_N</em><b>{{ fmt(state.north, 3) }} m</b>
      </span>

      <i class="m-sep" />

      <span class="status-item">
        <em>X</em><b>{{ fmt(state.x, 3) }}</b>
      </span>
      <span class="status-item">
        <em>Y</em><b>{{ fmt(state.y, 3) }}</b>
      </span>
      <span class="status-item">
        <em>Z</em><b>{{ fmt(state.z, 3) }}</b>
      </span>

      <i class="m-sep" />

      <span class="status-item">
        <em>H</em><b>{{ fmt(state.heading, 6) }}</b>
      </span>
      <span class="status-item">
        <em>P</em><b>{{ fmt(state.pitch, 6) }}</b>
      </span>
      <span class="status-item">
        <em>R</em><b>{{ fmt(state.roll, 6) }}</b>
      </span>
    </div>
  </div>
</template>

<style scoped>
.cesium-status {
  --tech-accent: #22d3ee;
  --tech-accent-soft: rgba(34, 211, 238, 0.35);
  --tech-line: rgba(56, 189, 248, 0.22);
  --tech-label: #6d8bab;
  --tech-text: #d8ecff;
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100% - 24px);
  padding: 5px 10px;
  white-space: nowrap;
  border: 1px solid var(--tech-line);
  border-radius: 4px;
  background:
    linear-gradient(180deg, rgba(11, 24, 40, 0.94) 0%, rgba(6, 14, 26, 0.92) 100%);
  box-shadow:
    inset 0 1px 0 rgba(125, 211, 252, 0.12),
    0 8px 24px rgba(0, 0, 0, 0.5),
    0 0 20px rgba(14, 165, 233, 0.14);
  backdrop-filter: blur(10px) saturate(140%);
  color: var(--tech-text);
  font-size: 10px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
/* 顶部扫描光带 */
.cesium-status::before {
  content: '';
  position: absolute;
  top: -1px;
  left: 8%;
  right: 8%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.75), transparent);
  background-size: 200% 100%;
  animation: tech-scan 7s linear infinite;
  pointer-events: none;
}
@keyframes tech-scan {
  from {
    background-position: 150% 0;
  }
  to {
    background-position: -150% 0;
  }
}
/* 四角定位角标 */
.br {
  position: absolute;
  width: 7px;
  height: 7px;
  border: 1px solid var(--tech-accent);
  opacity: 0.6;
  pointer-events: none;
}
.br--tl {
  top: -1px;
  left: -1px;
  border-right: 0;
  border-bottom: 0;
}
.br--tr {
  top: -1px;
  right: -1px;
  border-left: 0;
  border-bottom: 0;
}
.br--bl {
  bottom: -1px;
  left: -1px;
  border-right: 0;
  border-top: 0;
}
.br--br {
  bottom: -1px;
  right: -1px;
  border-left: 0;
  border-top: 0;
}

.ctrl {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}
.ctrl-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.ctrl-item--alpha {
  padding-left: 4px;
  border-left: 1px solid var(--tech-line);
}
.ctrl-label {
  font-size: 9px;
  letter-spacing: 0.6px;
  color: var(--tech-label);
  text-transform: uppercase;
}
.ctrl-value {
  min-width: 24px;
  font-size: 9px;
  color: var(--tech-accent);
  text-shadow: 0 0 8px rgba(34, 211, 238, 0.5);
}

.v-sep {
  width: 1px;
  height: 12px;
  flex: none;
  background: linear-gradient(180deg, transparent, var(--tech-accent-soft), transparent);
}

.metrics {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.metrics::-webkit-scrollbar {
  display: none;
}
.m-sep {
  width: 1px;
  height: 9px;
  flex: none;
  background: rgba(56, 189, 248, 0.2);
}

.live {
  display: inline-flex;
  align-items: center;
  flex: none;
}
.live i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 6px rgba(52, 211, 153, 0.9);
  animation: tech-pulse 1.8s ease-in-out infinite;
}
@keyframes tech-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.35;
    transform: scale(0.7);
  }
}

/* 开关 */
.tech-switch {
  --el-switch-on-color: rgba(34, 211, 238, 0.9);
  --el-switch-off-color: rgba(71, 85, 105, 0.6);
  --el-switch-border-color: transparent;
}
.tech-switch :deep(.el-switch__core) {
  border-color: rgba(56, 189, 248, 0.28);
  box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.45);
}
.tech-switch.is-checked :deep(.el-switch__core) {
  box-shadow:
    inset 0 0 6px rgba(0, 0, 0, 0.3),
    0 0 8px rgba(34, 211, 238, 0.55);
}
.tech-switch--green {
  --el-switch-on-color: rgba(52, 211, 153, 0.9);
}
.tech-switch--green.is-checked :deep(.el-switch__core) {
  box-shadow:
    inset 0 0 6px rgba(0, 0, 0, 0.3),
    0 0 8px rgba(52, 211, 153, 0.55);
}

/* 透明度滑块 */
.tech-slider {
  /* 轨道 / 滑块尺寸用 Element Plus 变量控制，避免覆盖高度后圆点错位 */
  --el-slider-height: 2px;
  --el-slider-button-size: 8px;
  /* 圆点容器上偏移 = (轨道高 - 容器高) / 2，保证圆点与轨道垂直居中 */
  --el-slider-button-wrapper-offset: calc(
    (var(--el-slider-height) - var(--el-slider-button-wrapper-size)) / 2
  );
  width: 78px;
  height: 30px;
  margin: -10px 0;
  flex: none;
  display: flex;
  align-items: center;
}
.tech-slider :deep(.el-slider__runway) {
  margin: 0;
  border-radius: 1px;
  background: rgba(56, 189, 248, 0.16);
}
.tech-slider :deep(.el-slider__bar) {
  background: linear-gradient(90deg, #0e7490, #22d3ee);
  box-shadow: 0 0 8px rgba(34, 211, 238, 0.5);
}
.tech-slider :deep(.el-slider__button) {
  border: 1px solid #22d3ee;
  background: #061220;
  box-shadow: 0 0 8px rgba(34, 211, 238, 0.9);
}

.status-item {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  flex: none;
}
.status-item em {
  font-style: normal;
  font-size: 9px;
  letter-spacing: 0.3px;
  color: var(--tech-label);
}
.status-item b {
  font-weight: 400;
  font-size: 10.5px;
  letter-spacing: 0.2px;
  color: var(--tech-text);
  font-family: 'JetBrains Mono', 'Cascadia Mono', Consolas, 'Courier New', monospace;
}

/* 地下模式下整体色调偏青绿 */
.cesium-status.is-underground {
  border-color: rgba(52, 211, 153, 0.28);
  box-shadow:
    inset 0 1px 0 rgba(52, 211, 153, 0.14),
    0 8px 24px rgba(0, 0, 0, 0.5),
    0 0 20px rgba(16, 185, 129, 0.16);
}
.cesium-status.is-underground::before {
  background: linear-gradient(90deg, transparent, rgba(52, 211, 153, 0.7), transparent);
  background-size: 200% 100%;
}

@media (prefers-reduced-motion: reduce) {
  .cesium-status::before,
  .live i {
    animation: none;
  }
}
</style>
