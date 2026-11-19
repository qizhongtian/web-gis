<script setup lang="ts">
import { reactive, ref, shallowRef } from 'vue'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { onCesiumReady } from '@/composables/useCesium'

/**
 * 精灵线：PolylineGeometry + 自定义材质
 * 纹理沿线的 st.s 方向平铺，再用 czm_frameNumber 让采样偏移持续推进，形成"精灵"流动感
 * 必须放在 <CesiumViewer> 的插槽里，才能通过 provide/inject 拿到 viewer
 */
const state = reactive({
  color: '#22d3ee',
  width: 14,
  density: 14,
  speed: 0.08,
  showBase: true,
})

const viewerRef = shallowRef<any>()
const libRef = shallowRef<any>()
/** 当前创建的 primitive 集合，参数变化时整体重建 */
let primitives: any[] = []
const spriteTexture = ref('')

/** 用 canvas 画一张"箭头 + 光晕"的精灵贴图，避免额外静态资源 */
function createSpriteTexture() {
  if (spriteTexture.value) return spriteTexture.value
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.clearRect(0, 0, size, size)
  // 横向流光带：覆盖率足够高，远处被 mipmap 平均后依然可见
  const grad = ctx.createLinearGradient(0, 0, size, 0)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.85)')
  grad.addColorStop(0.7, 'rgba(255,255,255,1)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, size * 0.18, size, size * 0.64)
  // 箭头尖：让流光看起来有方向
  ctx.beginPath()
  ctx.moveTo(size * 0.66, size * 0.08)
  ctx.lineTo(size * 0.92, size * 0.5)
  ctx.lineTo(size * 0.66, size * 0.92)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255,255,255,1)'
  ctx.fill()
  spriteTexture.value = canvas.toDataURL('image/png')
  return spriteTexture.value
}

/** 起点到终点的弧线：经纬度线性插值 + 抬高高度做拱形 */
function buildPositions(C: any) {
  const [lon0, lat0] = [114.05, 22.29]
  const [lon1, lat1] = [114.24, 22.35]
  const points: any[] = []
  for (let i = 0; i <= 120; i++) {
    const t = i / 120
    const lon = lon0 + (lon1 - lon0) * t
    const lat = lat0 + (lat1 - lat0) * t + Math.sin(Math.PI * t) * 0.008
    const height = Math.sin(Math.PI * t) * 2200 + 60
    points.push(C.Cartesian3.fromDegrees(lon, lat, height))
  }
  return points
}

/** 自定义流动材质：st.s 沿线循环采样精灵贴图 */
function createTrailMaterial(C: any, image: string) {
  return new C.Material({
    fabric: {
      uniforms: {
        image,
        color: C.Color.fromCssColorString(state.color),
        density: state.density,
        speed: state.speed,
        opacity: 1,
      },
      source: `
        czm_material czm_getMaterial(czm_materialInput materialInput) {
          czm_material material = czm_getDefaultMaterial(materialInput);
          vec2 st = materialInput.st;
          // 让采样偏移随时间推进，形成沿路径流动的效果
          float offset = fract(czm_frameNumber * speed);
          // Cesium 1.140 起只支持 WebGL2 / GLSL 300 es，采样函数要用 texture()
          vec4 tex = texture(image, vec2(fract(st.s * density - offset), st.t));
          material.diffuse = color.rgb * tex.rgb;
          material.emission = color.rgb * tex.a * 0.8;
          material.alpha = tex.a * color.a * opacity;
          return material;
        }
      `,
    },
    translucent: true,
  })
}

function clear() {
  const v = viewerRef.value
  if (!v || v.isDestroyed?.()) {
    primitives = []
    return
  }
  primitives.forEach((p) => v.scene.primitives.remove(p))
  primitives = []
}

function build() {
  const v = viewerRef.value
  const C = libRef.value
  if (!v || !C || v.isDestroyed?.()) return
  clear()

  const positions = buildPositions(C)
  const color = C.Color.fromCssColorString(state.color)

  // 底轨：细实线，保证线在精灵间隙里仍然连续
  if (state.showBase) {
    const base = v.scene.primitives.add(
      new C.Primitive({
        geometryInstances: new C.GeometryInstance({
          geometry: new C.PolylineGeometry({
            positions,
            width: Math.max(2, state.width * 0.32),
            vertexFormat: C.PolylineMaterialAppearance.VERTEX_FORMAT,
            arcType: C.ArcType.NONE,
          }),
        }),
        appearance: new C.PolylineMaterialAppearance({
          material: C.Material.fromType('Color', { color: color.withAlpha(0.35) }),
          translucent: true,
        }),
        asynchronous: false,
      }),
    )
    primitives.push(base)
  }

  // 精灵层：宽线 + 流动贴图
  const sprite = v.scene.primitives.add(
    new C.Primitive({
      geometryInstances: new C.GeometryInstance({
        geometry: new C.PolylineGeometry({
          positions,
          width: state.width,
          vertexFormat: C.PolylineMaterialAppearance.VERTEX_FORMAT,
          arcType: C.ArcType.NONE,
        }),
      }),
      appearance: new C.PolylineMaterialAppearance({
        material: createTrailMaterial(C, createSpriteTexture()),
        translucent: true,
      }),
      asynchronous: false,
    }),
  )
  primitives.push(sprite)
}

onCesiumReady((v, C) => {
  viewerRef.value = v
  libRef.value = C
  createSpriteTexture()
  build()
  // 斜视角度更能看出线的立体弧线
  v.camera.setView({
    destination: C.Cartesian3.fromDegrees(114.145, 22.285, 10500),
    orientation: {
      heading: 0,
      pitch: C.Math.toRadians(-40),
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
  <CesiumOverlay title="精灵线参数" class="absolute left-3 top-3 z-10" :width="278">
    <div class="row">
      <span>线条颜色</span>
      <el-color-picker v-model="state.color" size="small" @change="build" />
    </div>

    <div class="slider-row">
      <span>线宽</span>
      <el-slider v-model="state.width" :min="2" :max="40" :step="1" size="small" @change="build" />
      <b>{{ state.width }}px</b>
    </div>

    <div class="slider-row">
      <span>纹理密度</span>
      <el-slider v-model="state.density" :min="2" :max="40" :step="1" size="small" @change="build" />
      <b>{{ state.density }}</b>
    </div>

    <div class="slider-row">
      <span>流动速度</span>
      <el-slider v-model="state.speed" :min="0" :max="0.4" :step="0.01" size="small" @change="build" />
      <b>{{ state.speed.toFixed(2) }}</b>
    </div>

    <div class="row">
      <span>显示底轨</span>
      <el-switch v-model="state.showBase" size="small" @change="build" />
    </div>

    <p class="tip">纹理沿线的 st.s 循环采样，偏移量由 czm_frameNumber 推进，CPU 不参与逐帧计算。</p>
  </CesiumOverlay>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 12px;
  color: #6b7280;
}
.slider-row {
  display: grid;
  grid-template-columns: 62px 1fr 44px;
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
.tip {
  margin: 10px 0 0;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
  color: #9ca3af;
  font-size: 10px;
  line-height: 1.6;
}
</style>
