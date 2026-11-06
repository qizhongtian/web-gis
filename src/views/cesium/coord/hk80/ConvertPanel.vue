<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useCesium } from '@/composables/useCesium'
import { formatNumber, hk80ToWgs84, wgs84ToHk80 } from '@/utils/gis/coord'

const viewer = useCesium()

const lon = ref(114.1694)
const lat = ref(22.3193)
const easting = ref(836694.05)
const northing = ref(819069.8)
const pickMode = ref(false)

const hk80 = computed(() => wgs84ToHk80(lon.value, lat.value))
const wgs84 = computed(() => hk80ToWgs84(easting.value, northing.value))

let marker: any = null
let CesiumLib: any = null

function mark(lonValue: number, latValue: number) {
  const v = viewer.value
  if (!v || v.isDestroyed?.() || !CesiumLib) return
  if (marker) v.entities.remove(marker)
  marker = v.entities.add({
    position: CesiumLib.Cartesian3.fromDegrees(lonValue, latValue, 0),
    point: {
      pixelSize: 10,
      color: CesiumLib.Color.fromCssColorString('#ef4444'),
      outlineColor: CesiumLib.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.warning('当前环境不支持剪贴板')
  }
}

onCesiumReady((v, C) => {
  CesiumLib = C
  const handler = new C.ScreenSpaceEventHandler(v.scene.canvas)
  handler.setInputAction((movement: any) => {
    if (!pickMode.value) return
    const ray = v.camera.getPickRay(movement.position)
    const cartesian = ray ? v.scene.globe.pick(ray, v.scene) : null
    if (!cartesian) return
    const carto = C.Cartographic.fromCartesian(cartesian)
    lon.value = Number(C.Math.toDegrees(carto.longitude).toFixed(6))
    lat.value = Number(C.Math.toDegrees(carto.latitude).toFixed(6))
    mark(lon.value, lat.value)
  }, C.ScreenSpaceEventType.LEFT_CLICK)

  return () => {
    handler.destroy()
    if (marker && !v.isDestroyed?.()) v.entities.remove(marker)
    marker = null
  }
})
</script>

<template>
  <CesiumOverlay title="HK80 坐标转换" class="absolute left-3 top-3 z-10" :width="314">
    <div class="section">
      <div class="section-head">
        <span>WGS84 → HK80</span>
        <el-button size="small" text type="primary" @click="copy(`${hk80[0]}, ${hk80[1]}`)">复制</el-button>
      </div>
      <div class="grid">
        <span>经度</span>
        <el-input-number v-model="lon" :precision="6" :step="0.001" size="small" controls-position="right" />
        <span>纬度</span>
        <el-input-number v-model="lat" :precision="6" :step="0.001" size="small" controls-position="right" />
        <span>E</span>
        <b>{{ formatNumber(hk80[0], 2) }}</b>
        <span>N</span>
        <b>{{ formatNumber(hk80[1], 2) }}</b>
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <span>HK80 → WGS84</span>
        <el-button size="small" text type="primary" @click="copy(`${wgs84[0]}, ${wgs84[1]}`)">复制</el-button>
      </div>
      <div class="grid">
        <span>E</span>
        <el-input-number v-model="easting" :precision="2" :step="10" size="small" controls-position="right" />
        <span>N</span>
        <el-input-number v-model="northing" :precision="2" :step="10" size="small" controls-position="right" />
        <span>经度</span>
        <b>{{ formatNumber(wgs84[0]) }}</b>
        <span>纬度</span>
        <b>{{ formatNumber(wgs84[1]) }}</b>
      </div>
    </div>

    <div class="pick">
      <span>地图拾取经纬度</span>
      <el-switch v-model="pickMode" size="small" />
    </div>

    <p class="hint">
      使用 <b>proj4</b> 定义 EPSG:2326（香港 1980 方格网），WGS84 与 HK80 双向转换，七参数与官方定义一致。
    </p>
  </CesiumOverlay>
</template>

<style scoped>
.section {
  padding: 6px 0 8px;
  border-bottom: 1px dashed #e6e8eb;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 12px;
  color: #1f2328;
}
.grid {
  display: grid;
  grid-template-columns: 36px 1fr;
  align-items: center;
  gap: 6px 8px;
  font-size: 12px;
  color: #6b7280;
}
.grid :deep(.el-input-number) {
  width: 100%;
}
.grid b {
  color: #2563eb;
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.pick {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  font-size: 12px;
  color: #6b7280;
}
.hint {
  margin: 8px 0 0;
  font-size: 10px;
  line-height: 1.5;
  color: #9ca3af;
}
.hint b {
  color: #6b7280;
}
</style>
