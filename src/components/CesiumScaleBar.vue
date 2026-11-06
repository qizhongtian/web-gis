<script setup lang="ts">
import { ref } from 'vue'

const label = ref('')
const width = ref(0)
const visible = ref(false)

let viewer: any = null
let C: any = null
let off: (() => void) | null = null
let raf = 0

/** 取 1 / 2 / 5 × 10^n 的整数值，保证比例尺刻度美观 */
function niceNumber(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0
  const exp = Math.floor(Math.log10(value))
  const base = 10 ** exp
  const n = value / base
  const step = n >= 5 ? 5 : n >= 2 ? 2 : 1
  return step * base
}

function formatDistance(meters: number) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`
  return `${Math.round(meters)} m`
}

function read() {
  raf = 0
  if (!viewer || viewer.isDestroyed?.()) return
  const scene = viewer.scene
  const canvas = scene.canvas
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (!w || !h) return

  const ellipsoid = scene.globe.ellipsoid
  const y = h - 64
  const left = viewer.camera.pickEllipsoid(new C.Cartesian2(w / 2 - 60, y), ellipsoid)
  const right = viewer.camera.pickEllipsoid(new C.Cartesian2(w / 2 + 60, y), ellipsoid)

  if (!left || !right) {
    visible.value = false
    return
  }

  const metersPerPixel = C.Cartesian3.distance(left, right) / 120
  const target = metersPerPixel * 96
  const nice = niceNumber(target)
  if (!nice) {
    visible.value = false
    return
  }

  width.value = Math.max(40, Math.min(180, nice / metersPerPixel))
  label.value = formatDistance(nice)
  visible.value = true
}

function schedule() {
  if (!raf) raf = requestAnimationFrame(read)
}

function bindCamera(v: any) {
  v.camera.percentageChanged = 0.01
  v.camera.changed.addEventListener(schedule)
  const onMorph = () => schedule()
  v.scene.morphComplete?.addEventListener(onMorph)
  const onResize = () => schedule()
  window.addEventListener('resize', onResize)

  return () => {
    if (!v.isDestroyed?.()) {
      v.camera.changed.removeEventListener(schedule)
      v.scene.morphComplete?.removeEventListener(onMorph)
    }
    window.removeEventListener('resize', onResize)
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }
}

onCesiumReady((v, lib) => {
  viewer = v
  C = lib
  off = bindCamera(v)
  read()
  return () => {
    off?.()
    off = null
    viewer = null
    C = null
    visible.value = false
  }
})
</script>

<template>
  <div v-show="visible" class="scale-bar">
    <div class="labels">
      <span>0</span>
      <span>{{ label }}</span>
    </div>
    <div class="bar" :style="{ width: `${width}px` }">
      <i class="tick left" />
      <i class="tick mid" />
      <i class="tick right" />
    </div>
  </div>
</template>

<style scoped>
.scale-bar {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 8px 5px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(6px);
  color: #e2e8f0;
  pointer-events: none;
  user-select: none;
}
.labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  line-height: 12px;
  font-variant-numeric: tabular-nums;
}
.bar {
  position: relative;
  height: 5px;
  border: 1px solid #e2e8f0;
  border-top: none;
  box-sizing: content-box;
  transition: width 0.12s linear;
}
.tick {
  position: absolute;
  top: 0;
  width: 1px;
  height: 100%;
  background: #e2e8f0;
}
.tick.left {
  left: 0;
}
.tick.mid {
  left: 50%;
}
.tick.right {
  right: 0;
}
</style>
