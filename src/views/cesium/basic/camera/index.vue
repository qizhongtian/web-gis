<script setup lang="ts">
import { reactive, ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadCesium } from '@/utils/gis/cesiumLoader'
import { createViewer } from '@/utils/gis/cesiumInit'

type CameraKey = 'lon' | 'lat' | 'height' | 'heading' | 'pitch' | 'roll'

/**
 * 相机参数全部放开：
 * 位置 = 相机自身所在的经纬度 / 高度（不是注视点），姿态 = heading / pitch / roll
 * 对应 Camera.setView / flyTo 的 destination + orientation
 */
const cam = reactive<Record<CameraKey, number>>({
  lon: 116.407,
  lat: 39.904,
  height: 2_000_000,
  heading: 0,
  pitch: -90,
  roll: 0,
})

/** 飞行动画时长（秒），0 等于直接 setView */
const duration = ref(2)
/** 鼠标操作地球后，把真实相机参数反向同步回滑块 */
const autoSync = ref(true)

const sliders: Array<{
  key: CameraKey
  label: string
  unit: string
  min: number
  max: number
  step: number
  precision: number
}> = [
  { key: 'lon', label: '经度', unit: '°', min: -180, max: 180, step: 0.0001, precision: 5 },
  { key: 'lat', label: '纬度', unit: '°', min: -90, max: 90, step: 0.0001, precision: 5 },
  { key: 'height', label: '高度', unit: 'm', min: 100, max: 5_000_000, step: 100, precision: 0 },
  { key: 'heading', label: 'heading', unit: '°', min: -180, max: 180, step: 1, precision: 2 },
  { key: 'pitch', label: 'pitch', unit: '°', min: -90, max: 90, step: 1, precision: 2 },
  { key: 'roll', label: 'roll', unit: '°', min: -180, max: 180, step: 1, precision: 2 },
]

const cities = [
  { name: '北京', lon: 116.407, lat: 39.904, height: 120000, pitch: -45 },
  { name: '上海', lon: 121.473, lat: 31.23, height: 120000, pitch: -45 },
  { name: '深圳', lon: 114.057, lat: 22.543, height: 90000, pitch: -40 },
  { name: '纽约', lon: -74.006, lat: 40.712, height: 120000, pitch: -45 },
]

let C: any = null
let viewer: any = null
let cameraOff: (() => void) | null = null
let rafId = 0
/** 飞行动画进行中不回写参数，避免滑块跟着动画来回抖 */
let syncBlockUntil = 0

/** 按当前参数驱动相机；animated=false 立即 setView，滑块拖动时用它才能实时看效果 */
function apply(animated = true) {
  const v = viewer
  if (!v || !C || v.isDestroyed?.()) return
  const destination = C.Cartesian3.fromDegrees(cam.lon, cam.lat, cam.height)
  const orientation = {
    heading: C.Math.toRadians(cam.heading),
    pitch: C.Math.toRadians(cam.pitch),
    roll: C.Math.toRadians(cam.roll),
  }
  if (animated && duration.value > 0) {
    syncBlockUntil = performance.now() + duration.value * 1000 + 250
    v.camera.flyTo({ destination, orientation, duration: duration.value })
  } else {
    syncBlockUntil = 0
    v.camera.setView({ destination, orientation })
  }
}

/** 归一化到 [-180, 180)：Cesium 的 roll 可能回读成 360 */
function normalizeDeg(deg: number) {
  return ((((deg + 180) % 360) + 360) % 360) - 180
}

/** 相机 -> 参数（鼠标拖动 / 缩放后反向同步） */
function readCamera(v: any, force = false) {
  if (!v || !C || v.isDestroyed?.()) return
  if (!force && (!autoSync.value || performance.now() < syncBlockUntil)) return
  const carto = v.camera.positionCartographic
  const pitchDeg = C.Math.toDegrees(v.camera.pitch)
  cam.lon = C.Math.toDegrees(carto.longitude)
  cam.lat = C.Math.toDegrees(carto.latitude)
  cam.height = carto.height
  cam.pitch = pitchDeg
  // 俯视接近 ±90° 时 heading / roll 存在万向节锁（回读会翻转 180°），此时保留原值
  if (Math.abs(pitchDeg) < 89.5) {
    cam.heading = normalizeDeg(C.Math.toDegrees(v.camera.heading))
    cam.roll = normalizeDeg(C.Math.toDegrees(v.camera.roll))
  }
}

function bindCameraSync(v: any) {
  v.camera.percentageChanged = 0.002
  const handler = () => {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      rafId = 0
      readCamera(v)
    })
  }
  v.camera.changed.addEventListener(handler)
  return () => {
    if (!v.isDestroyed?.()) v.camera.changed.removeEventListener(handler)
  }
}

/** 滑块 / 数字框调整参数：立即生效，不打断拖动 */
function onNumber(key: CameraKey, value: number) {
  if (!Number.isFinite(value)) return
  cam[key] = value
  apply(false)
}

/** 滑块气泡按精度显示，避免出现 53.88539999999999 这种浮点尾巴 */
function formatValue(value: number, precision: number) {
  return Number(value).toFixed(precision)
}

function readFromCamera() {
  if (!viewer) return
  syncBlockUntil = 0
  readCamera(viewer, true)
}

function flyToCity(city: (typeof cities)[number]) {
  cam.lon = city.lon
  cam.lat = city.lat
  cam.height = city.height
  cam.heading = 0
  cam.pitch = city.pitch
  cam.roll = 0
  apply(true)
}

function init(Cesium: any, el: HTMLElement) {
  C = Cesium
  const v = createViewer(Cesium, el)
  viewer = v
  apply(false)
  cameraOff = bindCameraSync(v)
  return () => {
    cameraOff?.()
    cameraOff = null
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
    if (!v.isDestroyed?.()) v.destroy()
    viewer = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      相机控制：位置（经度 / 纬度 / 高度）与姿态（heading / pitch / roll）全部放开，拖滑块即可实时看到视角变化；飞行动画时长可调，鼠标操作地球后参数会反向同步
    </p>

    <div class="ctrl">
      <div class="ctrl-grid">
        <div v-for="s in sliders" :key="s.key" class="ctrl-row">
          <span class="ctrl-label">{{ s.label }}</span>
          <el-input-number
            :model-value="cam[s.key]"
            size="small"
            :controls="false"
            :precision="s.precision"
            :step="s.step"
            class="ctrl-num"
            @change="(val) => onNumber(s.key, Number(val))"
          />
          <el-slider
            :model-value="cam[s.key]"
            :min="s.min"
            :max="s.max"
            :step="s.step"
            size="small"
            class="ctrl-slider"
            :format-tooltip="(val) => formatValue(val, s.precision)"
            @update:model-value="(val) => onNumber(s.key, Number(Array.isArray(val) ? val[0] : val))"
          />
          <span class="ctrl-unit">{{ s.unit }}</span>
        </div>
      </div>

      <div class="ctrl-actions">
        <div class="ctrl-cities">
          <el-button v-for="city in cities" :key="city.name" size="small" @click="flyToCity(city)">
            {{ city.name }}
          </el-button>
        </div>

        <span class="ctrl-label">动画 {{ duration }}s</span>
        <el-slider v-model="duration" :min="0" :max="5" :step="0.5" size="small" class="ctrl-duration" />

        <el-button size="small" type="primary" @click="apply(true)">飞行</el-button>
        <el-button size="small" @click="apply(false)">立即应用</el-button>
        <el-button size="small" plain @click="readFromCamera">读取当前相机</el-button>

        <span class="ctrl-sync">
          <el-switch v-model="autoSync" size="small" />
          <span>反向同步</span>
        </span>
      </div>
    </div>

    <DemoBox class="flex-1" :loader="loadCesium" :init="init" status />
  </div>
</template>

<style scoped>
.ctrl {
  flex: none;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #e6e8eb;
  background: #fff;
}
.ctrl-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2px 18px;
}
.ctrl-row {
  display: grid;
  grid-template-columns: 52px 82px minmax(60px, 1fr) 14px;
  align-items: center;
  gap: 6px;
}
.ctrl-label {
  font-size: 11px;
  color: #6b7280;
}
.ctrl-unit {
  font-size: 10px;
  color: #9ca3af;
}
.ctrl-num :deep(.el-input__inner) {
  padding: 0 4px;
  text-align: left;
}
.ctrl-slider {
  margin: 0;
}
.ctrl-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #eef0f3;
}
.ctrl-cities {
  display: flex;
  gap: 6px;
}
.ctrl-cities :deep(.el-button) {
  margin-left: 0;
}
.ctrl-actions :deep(.el-button) {
  margin-left: 0;
}
.ctrl-duration {
  width: 120px;
  margin: 0;
}
.ctrl-sync {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #6b7280;
}

@media (max-width: 1280px) {
  .ctrl-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 820px) {
  .ctrl-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
