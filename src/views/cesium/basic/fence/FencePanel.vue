<script setup lang="ts">
import { reactive, shallowRef } from 'vue'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { onCesiumReady } from '@/composables/useCesium'

/**
 * 电子围栏：WallGraphics 建半透明墙体 + 顶部发光线 + 地面虚线
 * 颜色与发光强度用 CallbackProperty 做呼吸；切换告警态时换色并加快闪烁
 * 必须放在 <CesiumViewer> 的插槽里，才能通过 provide/inject 拿到 viewer
 */
const CENTER: [number, number] = [114.06, 22.28]

const state = reactive({
  color: '#22d3ee',
  height: 120,
  breathe: true,
  alarm: false,
})

const viewerRef = shallowRef<any>()
const libRef = shallowRef<any>()
let entities: any[] = []
let wallTexture = ''

/** 竖向渐变 + 细竖条纹的墙体贴图（白色，最终颜色由 color 染色） */
function createWallTexture() {
  if (wallTexture) return wallTexture
  const w = 16
  const h = 128
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  // 底部透明 → 顶部不透明
  const grad = ctx.createLinearGradient(0, h, 0, 0)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.55, 'rgba(255,255,255,0.28)')
  grad.addColorStop(0.92, 'rgba(255,255,255,0.75)')
  grad.addColorStop(1, 'rgba(255,255,255,1)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  // 竖条纹，增强"电子围栏"的栅格感
  ctx.fillStyle = 'rgba(255,255,255,0.16)'
  for (let x = 0; x < w; x += 8) ctx.fillRect(x, 0, 2, h)
  wallTexture = canvas.toDataURL('image/png')
  return wallTexture
}

/** 围栏底面闭合环 */
function ring(C: any) {
  const [lon, lat] = CENTER
  return C.Cartesian3.fromDegreesArray([
    lon - 0.0085,
    lat - 0.0052,
    lon + 0.0085,
    lat - 0.0052,
    lon + 0.0085,
    lat + 0.0052,
    lon - 0.0085,
    lat + 0.0052,
    lon - 0.0085,
    lat - 0.0052,
  ])
}

function currentColor(C: any) {
  return C.Color.fromCssColorString(state.alarm ? '#ef4444' : state.color)
}

function clear() {
  const v = viewerRef.value
  if (!v || v.isDestroyed?.()) {
    entities = []
    return
  }
  entities.forEach((e) => v.entities.remove(e))
  entities = []
}

function build() {
  const v = viewerRef.value
  const C = libRef.value
  if (!v || !C || v.isDestroyed?.()) return
  clear()

  const positions = ring(C)
  const count = positions.length
  const topHeights = new Array(count).fill(state.height)
  const bottomHeights = new Array(count).fill(0)

  // 墙体：渐变贴图 + 呼吸
  const wallMaterial = new C.ImageMaterialProperty({
    image: createWallTexture(),
    transparent: true,
    repeat: new C.Cartesian2(22, 1),
    color: new C.CallbackProperty(() => {
      const color = currentColor(C)
      if (!state.breathe) return color.withAlpha(0.75)
      const pulse = 0.58 + 0.22 * Math.sin(performance.now() / 520)
      return color.withAlpha(pulse)
    }, false),
  })
  entities.push(
    v.entities.add({
      wall: {
        positions,
        maximumHeights: topHeights,
        minimumHeights: bottomHeights,
        material: wallMaterial,
      },
    }),
  )

  // 顶部发光线：跟随呼吸，告警时闪得更快
  const topPositions = positions.map((p: any, i: number) => {
    const carto = C.Cartographic.fromCartesian(p)
    return C.Cartesian3.fromDegrees(
      C.Math.toDegrees(carto.longitude),
      C.Math.toDegrees(carto.latitude),
      topHeights[i] ?? state.height,
    )
  })
  entities.push(
    v.entities.add({
      polyline: {
        positions: topPositions,
        width: 3,
        material: new C.PolylineGlowMaterialProperty({
          glowPower: 0.3,
          taperPower: 1,
          color: new C.CallbackProperty(() => {
            const color = currentColor(C)
            if (!state.breathe) return color
            const speed = state.alarm ? 9 : 2.2
            const pulse = 0.55 + 0.45 * Math.sin((performance.now() / 1000) * speed)
            return color.withAlpha(pulse)
          }, false),
        }),
      },
    }),
  )

  // 地面虚线：标出围栏范围
  entities.push(
    v.entities.add({
      polyline: {
        positions: ring(C),
        width: 2,
        clampToGround: true,
        material: new C.PolylineDashMaterialProperty({
          color: currentColor(C).withAlpha(0.9),
          dashLength: 18,
        }),
      },
    }),
  )
}

function flyTo() {
  const v = viewerRef.value
  const C = libRef.value
  if (!v || !C || v.isDestroyed?.()) return
  v.camera.flyTo({
    destination: C.Cartesian3.fromDegrees(CENTER[0], CENTER[1] - 0.008, 1900),
    orientation: {
      heading: C.Math.toRadians(352),
      pitch: C.Math.toRadians(-26),
      roll: 0,
    },
    duration: 1.2,
  })
}

onCesiumReady((v, C) => {
  viewerRef.value = v
  libRef.value = C
  createWallTexture()
  build()
  // 贴近围栏的斜视角度，才能看出墙体的高度
  v.camera.setView({
    destination: C.Cartesian3.fromDegrees(114.06, 22.2615, 2600),
    orientation: {
      heading: 0,
      pitch: C.Math.toRadians(-35),
      roll: 0,
    },
  })
  return () => {
    clear()
    viewerRef.value = undefined
    libRef.value = undefined
  }
})
</script>

<template>
  <CesiumOverlay title="电子围栏参数" class="absolute left-3 top-3 z-10" :width="282">
    <div class="row">
      <span>围栏颜色</span>
      <el-color-picker v-model="state.color" size="small" :disabled="state.alarm" @change="build" />
    </div>

    <div class="slider-row">
      <span>围栏高度</span>
      <el-slider v-model="state.height" :min="10" :max="300" :step="5" size="small" @change="build" />
      <b>{{ state.height }}m</b>
    </div>

    <div class="row">
      <span>呼吸动画</span>
      <el-switch v-model="state.breathe" size="small" />
    </div>

    <div class="row">
      <span>告警状态</span>
      <el-switch v-model="state.alarm" size="small" active-text="闯入" inactive-text="正常" />
    </div>

    <div class="actions">
      <el-button size="small" type="primary" plain @click="flyTo">定位围栏</el-button>
    </div>

    <p class="tip">告警态下墙体与顶线切到红色并加快闪烁；呼吸只改材质颜色，不重建实体。</p>
  </CesiumOverlay>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
  color: #6b7280;
}
.slider-row {
  display: grid;
  grid-template-columns: 62px 1fr 48px;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
  font-size: 12px;
  color: #6b7280;
}
.slider-row :deep(.el-slider) {
  margin: 0;
}
.slider-row b {
  color: #2563eb;
  font-size: 11px;
  font-weight: 500;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.actions {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e6e8eb;
}
.tip {
  margin: 8px 0 0;
  color: #9ca3af;
  font-size: 10px;
  line-height: 1.6;
}
</style>
