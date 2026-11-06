<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{ size?: number }>(), { size: 76 })

const { t } = useI18n()
const heading = ref(0)
const pitch = ref(-90)

let viewer: any = null
let C: any = null
let off: (() => void) | null = null
let raf = 0

function read() {
  raf = 0
  if (!viewer || viewer.isDestroyed?.()) return
  heading.value = C.Math.toDegrees(viewer.camera.heading)
  pitch.value = C.Math.toDegrees(viewer.camera.pitch)
}

function schedule() {
  if (!raf) raf = requestAnimationFrame(read)
}

function bindCamera(v: any) {
  v.camera.percentageChanged = 0.01
  v.camera.changed.addEventListener(schedule)
  const onMorph = () => schedule()
  v.scene.morphComplete?.addEventListener(onMorph)
  return () => {
    if (!v.isDestroyed?.()) {
      v.camera.changed.removeEventListener(schedule)
      v.scene.morphComplete?.removeEventListener(onMorph)
    }
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }
}

function resetNorth() {
  if (!viewer || !C) return
  const camera = viewer.camera
  camera.flyTo({
    destination: camera.positionWC,
    orientation: { heading: 0, pitch: camera.pitch, roll: 0 },
    duration: 0.6,
  })
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
  }
})
</script>

<template>
  <el-tooltip :content="t('cesium.compassTip')" placement="left" :show-after="200">
    <button
      class="compass"
      type="button"
      :style="{ width: `${props.size}px`, height: `${props.size}px` }"
      :aria-label="t('cesium.compassTip')"
      @click="resetNorth"
    >
      <svg viewBox="0 0 100 100" class="dial">
        <circle cx="50" cy="50" r="47" class="ring" />
        <circle cx="50" cy="50" r="38" class="ring inner" />
        <g :transform="`rotate(${-heading} 50 50)`">
          <path d="M50 14 L57 50 L50 45 L43 50 Z" class="north" />
          <path d="M50 86 L43 50 L50 55 L57 50 Z" class="south" />
          <text x="50" y="11" class="mark">N</text>
          <text x="92" y="54" class="mark">E</text>
          <text x="50" y="98" class="mark">S</text>
          <text x="8" y="54" class="mark">W</text>
        </g>
        <path d="M50 3 L46 10 L54 10 Z" class="pointer" />
      </svg>
      <span class="pitch" :class="{ flat: pitch > -80 }">{{ Math.round(pitch) }}°</span>
    </button>
  </el-tooltip>
</template>

<style scoped>
.compass {
  position: relative;
  display: grid;
  place-items: center;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(6px);
  cursor: pointer;
  transition: transform 0.15s ease;
}
.compass:hover {
  transform: translateY(-1px);
}
.dial {
  width: 100%;
  height: 100%;
}
.ring {
  fill: rgba(255, 255, 255, 0.5);
  stroke: #cbd5e1;
  stroke-width: 1.2;
}
.ring.inner {
  fill: none;
  stroke: #e2e8f0;
  stroke-dasharray: 2 4;
}
.north {
  fill: #ef4444;
}
.south {
  fill: #94a3b8;
}
.pointer {
  fill: #2563eb;
}
.mark {
  font-size: 11px;
  font-weight: 600;
  fill: #475569;
  text-anchor: middle;
  dominant-baseline: middle;
}
.pitch {
  position: absolute;
  bottom: -7px;
  padding: 0 5px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.72);
  color: #e2e8f0;
  font-size: 10px;
  line-height: 15px;
  font-variant-numeric: tabular-nums;
}
.pitch.flat {
  background: rgba(37, 99, 235, 0.85);
}
</style>
