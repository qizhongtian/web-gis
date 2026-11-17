<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { onCesiumReady, useCesium } from '@/composables/useCesium'
import { ecefToGeodetic, formatNumber, geodeticToEcef } from '@/utils/gis/coord'
import { copyText } from '@/utils/tools/file'

const viewer = useCesium()

/** WGS84 大地坐标（度 / 米） */
const geo = reactive({ lon: 116.391, lat: 39.907, height: 100 })
/** ECEF 地心地固坐标（米），初始与地理坐标同点 */
const ecef = reactive({ x: 0, y: 0, z: 0 })

const pickMode = ref(false)

pushEcef(geodeticToEcef(geo.lon, geo.lat, geo.height))

/** 经纬度 -> ECEF，写回 X / Y / Z 输入 */
function pushEcef(p = geodeticToEcef(geo.lon, geo.lat, geo.height)) {
  ecef.x = Number(p.x.toFixed(3))
  ecef.y = Number(p.y.toFixed(3))
  ecef.z = Number(p.z.toFixed(3))
}

/** ECEF -> 经纬度，写回经纬度输入；地心等无效值返回 false */
function pushGeo() {
  const { x, y, z } = ecef
  if (![x, y, z].every((v) => Number.isFinite(v))) return false
  if (x === 0 && y === 0 && z === 0) return false
  const g = ecefToGeodetic(x, y, z)
  geo.lon = Number(g.lon.toFixed(6))
  geo.lat = Number(g.lat.toFixed(6))
  geo.height = Number(g.height.toFixed(2))
  return true
}

/** 编辑经纬度：同步换算 ECEF 输入 */
function setGeo(key: 'lon' | 'lat' | 'height', value: number | undefined) {
  if (value === undefined || value === null || Number.isNaN(value)) return
  geo[key] = value
  pushEcef()
}

/** 编辑 ECEF：同步换算经纬度输入 */
function setEcef(key: 'x' | 'y' | 'z', value: number | undefined) {
  if (value === undefined || value === null || Number.isNaN(value)) return
  ecef[key] = value
  if (!pushGeo()) ElMessage.warning('全零为地心点，无法换算经纬度')
}

const centerDistance = computed(() => Math.hypot(ecef.x, ecef.y, ecef.z))

const geoText = computed(
  () => `${geo.lon.toFixed(6)}, ${geo.lat.toFixed(6)}, ${geo.height.toFixed(2)}`,
)
const ecefText = computed(
  () => `${ecef.x.toFixed(3)}, ${ecef.y.toFixed(3)}, ${ecef.z.toFixed(3)}`,
)

let cesium: any = null
let marker: any = null

/** 地图红点始终跟随经纬度 */
function syncMarker() {
  const v = viewer.value
  if (!v || !cesium || v.isDestroyed?.()) return
  const position = cesium.Cartesian3.fromDegrees(geo.lon, geo.lat, geo.height)
  if (marker) {
    marker.position = position
    return
  }
  marker = v.entities.add({
    position,
    point: {
      pixelSize: 11,
      color: cesium.Color.fromCssColorString('#ef4444'),
      outlineColor: cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })
}

/** 飞向当前点 */
function locate() {
  const v = viewer.value
  if (!v || !cesium || v.isDestroyed?.()) return
  syncMarker()
  const target = cesium.Cartesian3.fromDegrees(geo.lon, geo.lat, geo.height)
  v.camera.flyToBoundingSphere(new cesium.BoundingSphere(target, 1), {
    offset: new cesium.HeadingPitchRange(
      0,
      cesium.Math.toRadians(-45),
      Math.max(1500, Math.abs(geo.height) + 1200),
    ),
    duration: 1.2,
  })
}

async function copy(text: string, label: string) {
  if (!text) return
  if (await copyText(text)) ElMessage.success(`${label} 已复制`)
  else ElMessage.error('复制失败：当前浏览器限制了剪贴板权限')
}

function reset() {
  geo.lon = 116.391
  geo.lat = 39.907
  geo.height = 100
  pushEcef()
  syncMarker()
}

watch(() => [geo.lon, geo.lat, geo.height], syncMarker)

onCesiumReady((v, C) => {
  cesium = C
  syncMarker()

  const handler = new C.ScreenSpaceEventHandler(v.scene.canvas)
  handler.setInputAction((movement: any) => {
    if (!pickMode.value) return
    const ray = v.camera.getPickRay(movement.position)
    const cartesian = ray ? v.scene.globe.pick(ray, v.scene) : null
    if (!cartesian) return
    const carto = C.Cartographic.fromCartesian(cartesian)
    geo.lon = Number(C.Math.toDegrees(carto.longitude).toFixed(6))
    geo.lat = Number(C.Math.toDegrees(carto.latitude).toFixed(6))
    geo.height = Number((carto.height || 0).toFixed(2))
    pushEcef()
    syncMarker()
  }, C.ScreenSpaceEventType.LEFT_CLICK)

  return () => {
    handler.destroy()
    if (marker && !v.isDestroyed?.()) v.entities.remove(marker)
    marker = null
    cesium = null
  }
})
</script>

<template>
  <CesiumOverlay title="WGS84 ↔ 笛卡尔" class="absolute left-3 top-3 z-10" :width="318">
    <div class="section">
      <div class="section-head">
        <span>经纬度（WGS84）</span>
        <el-button size="small" text type="primary" @click="copy(geoText, '经纬度')">复制</el-button>
      </div>
      <div class="form">
        <span>经度</span>
        <el-input-number
          :model-value="geo.lon"
          :precision="6"
          :step="0.001"
          :min="-180"
          :max="180"
          size="small"
          controls-position="right"
          @update:model-value="(v) => setGeo('lon', v)"
        />
        <span>纬度</span>
        <el-input-number
          :model-value="geo.lat"
          :precision="6"
          :step="0.001"
          :min="-90"
          :max="90"
          size="small"
          controls-position="right"
          @update:model-value="(v) => setGeo('lat', v)"
        />
        <span>高度</span>
        <el-input-number
          :model-value="geo.height"
          :precision="2"
          :step="10"
          size="small"
          controls-position="right"
          @update:model-value="(v) => setGeo('height', v)"
        />
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <span>笛卡尔 · ECEF（米）</span>
        <el-button size="small" text type="primary" @click="copy(ecefText, 'ECEF 坐标')">复制</el-button>
      </div>
      <div class="form">
        <span>X</span>
        <el-input-number
          :model-value="ecef.x"
          :precision="3"
          :controls="false"
          size="small"
          @update:model-value="(v) => setEcef('x', v)"
        />
        <span>Y</span>
        <el-input-number
          :model-value="ecef.y"
          :precision="3"
          :controls="false"
          size="small"
          @update:model-value="(v) => setEcef('y', v)"
        />
        <span>Z</span>
        <el-input-number
          :model-value="ecef.z"
          :precision="3"
          :controls="false"
          size="small"
          @update:model-value="(v) => setEcef('z', v)"
        />
      </div>
    </div>

    <div class="btns">
      <el-button size="small" type="primary" plain @click="locate">定位到该点</el-button>
      <el-button size="small" plain @click="reset">重置示例点</el-button>
    </div>

    <div class="pick">
      <span>地图点选拾取经纬度</span>
      <el-switch v-model="pickMode" size="small" />
    </div>

    <p class="meta">距地心 {{ formatNumber(centerDistance / 1000, 3) }} km · 两边输入实时互算</p>
    <p class="hint">
      采用 WGS84 椭球（a=6378137, 1/f=298.257223563），与 Cesium 一致；高度单位为米。
    </p>
  </CesiumOverlay>
</template>

<style scoped>
.section {
  padding: 2px 0 8px;
  border-bottom: 1px dashed #e6e8eb;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 3px;
  font-size: 12px;
  font-weight: 500;
  color: #1f2328;
}
.form {
  display: grid;
  grid-template-columns: 32px 1fr;
  align-items: center;
  gap: 4px 8px;
  font-size: 12px;
  color: #6b7280;
}
.form :deep(.el-input-number) {
  width: 100%;
}
.form :deep(.el-input__inner) {
  text-align: left;
  font-variant-numeric: tabular-nums;
}
.btns {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.pick {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: #6b7280;
}
.meta {
  margin: 6px 0 0;
  font-size: 11px;
  color: #9ca3af;
}
.hint {
  margin: 4px 0 0;
  font-size: 10px;
  line-height: 1.5;
  color: #9ca3af;
}
</style>
