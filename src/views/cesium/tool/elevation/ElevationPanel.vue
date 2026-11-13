<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useCesiumSurfaceElevation, type TiltMode } from '@/composables/useCesiumSurfaceElevation'
import { defaultMeshTilesetUrl, defaultTerrainServiceUrl } from '@/utils/gis/cesiumConfig'
import { parseGeoJsonPoints, rowsToPoints, type TablePoint } from '@/utils/gis/pointTable'
import { buildXlsxBlob, parseCsv, readXlsxRows, type XlsxRow } from '@/utils/gis/xlsx'

const { t } = useI18n()

/**
 * 默认地形服务：全球高程（ArcGIS，免密钥、可直接跨域），
 * 也可在输入框换成其它 Cesium 地形地址，或用 VITE_HK_TERRAIN_URL 指定自建服务
 */
const DEFAULT_TERRAIN_URL = defaultTerrainServiceUrl

const {
  terrainLoaded,
  terrainLoading,
  terrainError,
  tiltLoaded,
  tiltLoading,
  tiltError,
  sampling,
  progress,
  processed,
  total,
  stage,
  sampleError,
  results,
  loadTerrain,
  unloadTerrain,
  loadTilt,
  unloadTilt,
  sample,
  cancel,
  clear,
  flyToPoint,
} = useCesiumSurfaceElevation()

const terrainUrl = ref(DEFAULT_TERRAIN_URL)
const tiltUrl = ref(defaultMeshTilesetUrl)
const useTerrain = ref(false)
const useTilt = ref(false)
/** 倾斜采样精度：fast 只取已加载瓦片（快），fine 走最精细遍历（慢） */
const tiltMode = ref<TiltMode>('fast')

const points = shallowRef<TablePoint[]>([])
const sourceName = ref('')
const maxPoints = ref(5000)

/** 表格最多渲染多少行：上千行 DOM 会拖死主线程，导出仍用完整结果 */
const TABLE_ROWS = 200
const tableRows = computed(() => results.value.slice(0, TABLE_ROWS))

const geoInput = ref<HTMLInputElement>()
const excelInput = ref<HTMLInputElement>()

/** 表面加载成功后自动勾选对应采样项 */
watch(terrainLoaded, (loaded) => {
  useTerrain.value = loaded
})
watch(tiltLoaded, (loaded) => {
  useTilt.value = loaded
})

/** 打开页面后默认加载地形 */
let booted = false
onCesiumReady(() => {
  if (booted) return
  booted = true
  void loadTerrain(terrainUrl.value)
})

const stageLabel = computed(() => {
  if (stage.value === 'terrain') return t('elevation.stageTerrain')
  if (stage.value === 'tilt') return t('elevation.stageTilt')
  return ''
})

const progressText = computed(() =>
  t('elevation.progress', {
    stage: stageLabel.value,
    current: processed.value,
    total: total.value,
  }),
)

const canDownload = computed(() => results.value.length > 0)

/* ---------------- 表面加载 ---------------- */

async function onLoadTerrain() {
  const ok = await loadTerrain(terrainUrl.value)
  if (ok) ElMessage.success(t('elevation.terrainReady'))
}

async function onLoadTilt() {
  const ok = await loadTilt(tiltUrl.value)
  if (ok) ElMessage.success(t('elevation.tiltReady'))
}

/* ---------------- 点数据 ---------------- */

async function handleFile(file: File) {
  const lower = file.name.toLowerCase()
  try {
    let list: TablePoint[]
    if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) {
      list = rowsToPoints(await readXlsxRows(file))
    } else if (lower.endsWith('.csv')) {
      list = rowsToPoints(parseCsv(await file.text()))
    } else if (lower.endsWith('.json') || lower.endsWith('.geojson')) {
      list = parseGeoJsonPoints(JSON.parse(await file.text()))
    } else if (lower.endsWith('.xls')) {
      ElMessage.error(t('elevation.xlsNotSupported'))
      return
    } else {
      ElMessage.error(t('elevation.unsupportedFile'))
      return
    }

    if (!list.length) {
      ElMessage.warning(t('elevation.noValidPoints'))
      return
    }
    if (list.length > maxPoints.value) {
      ElMessage.warning(
        t('elevation.limitExceeded', { count: list.length, limit: maxPoints.value }),
      )
      list = list.slice(0, maxPoints.value)
    }
    clear()
    points.value = list
    sourceName.value = file.name
    ElMessage.success(t('elevation.pointsReady', { count: list.length }))
  } catch (e: any) {
    ElMessage.error(`${t('elevation.parseFailed')}${e?.message ? `：${e.message}` : ''}`)
  }
}

async function onGeoFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await handleFile(file)
}

async function onExcelFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await handleFile(file)
}

/* ---------------- 采样 / 结果 ---------------- */

async function startSampling() {
  if (!points.value.length) {
    ElMessage.warning(t('elevation.needPointsFirst'))
    return
  }
  if (!useTerrain.value && !useTilt.value) {
    ElMessage.warning(t('elevation.needSurface'))
    return
  }
  await sample(points.value, {
    terrain: useTerrain.value,
    tilt: useTilt.value,
    tiltMode: tiltMode.value,
  })
  if (sampleError.value) ElMessage.error(sampleError.value)
  else ElMessage.success(t('elevation.done', { count: results.value.length }))
}

function clearResults() {
  clear()
}

function formatHeight(value: number | null): string {
  return value === null ? '—' : value.toFixed(2)
}

function formatCoord(value: number): string {
  return value.toFixed(6)
}

/* ---------------- 下载 ---------------- */

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes(),
  )}`
}

function downloadGeoJsonTemplate() {
  const template = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { ID: 1 },
        geometry: { type: 'Point', coordinates: [114.1694, 22.3193] },
      },
      {
        type: 'Feature',
        properties: { ID: 2 },
        geometry: { type: 'Point', coordinates: [114.1589, 22.2817] },
      },
    ],
  }
  saveBlob(
    new Blob([JSON.stringify(template, null, 2)], { type: 'application/geo+json;charset=utf-8' }),
    'points-template.geojson',
  )
}

function downloadExcelTemplate() {
  const rows: XlsxRow[] = [
    ['ID', 'Longitude', 'Latitude'],
    [1, 114.1694, 22.3193],
    [2, 114.1589, 22.2817],
  ]
  saveBlob(buildXlsxBlob(rows, 'Points'), 'points-template.xlsx')
}

function downloadGeoJson() {
  if (!canDownload.value) return
  const features = results.value.map((item) => ({
    type: 'Feature',
    properties: {
      ID: item.id,
      Longitude: item.lon,
      Latitude: item.lat,
      TerrainHeight: item.terrainHeight,
      MeshHeight: item.meshHeight,
      Altitude: item.altitude,
      Source: item.source,
    },
    geometry: {
      type: 'Point',
      coordinates:
        item.altitude === null ? [item.lon, item.lat] : [item.lon, item.lat, item.altitude],
    },
  }))
  const geojson = { type: 'FeatureCollection', features }
  saveBlob(
    new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json;charset=utf-8' }),
    `surface-elevation-${stamp()}.geojson`,
  )
}

function downloadExcel() {
  if (!canDownload.value) return
  const rows: XlsxRow[] = [
    ['ID', 'Longitude', 'Latitude', '地形高程(m)', '倾斜表面高程(m)', 'Altitude(m)'],
    ...results.value.map((item) => [
      item.id,
      item.lon,
      item.lat,
      item.terrainHeight ?? '',
      item.meshHeight ?? '',
      item.altitude ?? '',
    ]),
  ]
  saveBlob(buildXlsxBlob(rows, 'Elevation'), `surface-elevation-${stamp()}.xlsx`)
}
</script>

<template>
  <div class="absolute left-3 top-3 bottom-3 z-10 flex items-start">
    <CesiumOverlay :title="t('elevation.title')" :width="520" fill class="min-h-0">
    <!-- 地形 -->
    <div class="block">
      <div class="block-head">
        <span class="block-title">{{ t('elevation.terrain') }}</span>
        <el-tag v-if="terrainLoaded" size="small" type="success" effect="light">
          {{ t('elevation.loaded') }}
        </el-tag>
        <el-tag v-else size="small" type="info" effect="plain">
          {{ t('elevation.notLoaded') }}
        </el-tag>
      </div>
      <el-input v-model="terrainUrl" size="small" :placeholder="t('elevation.terrainUrl')" />
      <div class="row">
        <el-button size="small" type="primary" :loading="terrainLoading" @click="onLoadTerrain">
          {{ t('elevation.load') }}
        </el-button>
        <el-button size="small" plain :disabled="!terrainLoaded" @click="unloadTerrain">
          {{ t('elevation.unload') }}
        </el-button>
      </div>
      <p v-if="terrainError" class="err">{{ terrainError }}</p>
    </div>

    <!-- 倾斜模型 -->
    <div class="block">
      <div class="block-head">
        <span class="block-title">{{ t('elevation.tilt') }}</span>
        <el-tag v-if="tiltLoaded" size="small" type="success" effect="light">
          {{ t('elevation.loaded') }}
        </el-tag>
        <el-tag v-else size="small" type="info" effect="plain">
          {{ t('elevation.notLoaded') }}
        </el-tag>
      </div>
      <el-input v-model="tiltUrl" size="small" :placeholder="t('elevation.tiltUrl')" />
      <div class="row">
        <el-button size="small" type="primary" :loading="tiltLoading" @click="onLoadTilt">
          {{ t('elevation.load') }}
        </el-button>
        <el-button size="small" plain :disabled="!tiltLoaded" @click="unloadTilt">
          {{ t('elevation.unload') }}
        </el-button>
      </div>
      <p v-if="tiltError" class="err">{{ tiltError }}</p>
    </div>

    <!-- 点数据 -->
    <div class="block">
      <div class="block-head">
        <span class="block-title">{{ t('elevation.points') }}</span>
        <span class="meta">{{ t('elevation.parsed', { count: points.length }) }}</span>
      </div>
      <div class="row">
        <el-button size="small" @click="geoInput?.click()">{{ t('elevation.uploadGeoJson') }}</el-button>
        <el-button size="small" @click="excelInput?.click()">{{ t('elevation.uploadExcel') }}</el-button>
        <input
          ref="geoInput"
          type="file"
          accept=".json,.geojson,application/json"
          hidden
          @change="onGeoFile"
        />
        <input
          ref="excelInput"
          type="file"
          accept=".xlsx,.xlsm,.csv"
          hidden
          @change="onExcelFile"
        />
      </div>
      <div class="row">
        <el-button size="small" text @click="downloadGeoJsonTemplate">
          {{ t('elevation.templateGeoJson') }}
        </el-button>
        <el-button size="small" text @click="downloadExcelTemplate">
          {{ t('elevation.templateExcel') }}
        </el-button>
        <span class="limit">
          {{ t('elevation.maxPoints') }}
          <el-input-number v-model="maxPoints" size="small" :min="10" :max="5000" :step="500" />
        </span>
      </div>
      <p v-if="sourceName" class="file-name">{{ sourceName }}</p>
    </div>

    <!-- 采样 -->
    <div class="block">
      <div class="block-head">
        <span class="block-title">{{ t('elevation.surfaces') }}</span>
      </div>
      <div class="row">
        <el-checkbox v-model="useTerrain" size="small">{{ t('elevation.sampleTerrain') }}</el-checkbox>
        <el-checkbox v-model="useTilt" size="small">{{ t('elevation.sampleTilt') }}</el-checkbox>
      </div>
      <div v-if="useTilt" class="row">
        <span class="meta">{{ t('elevation.tiltMode') }}</span>
        <el-radio-group v-model="tiltMode" size="small">
          <el-radio-button value="fast">{{ t('elevation.tiltModeFast') }}</el-radio-button>
          <el-radio-button value="fine">{{ t('elevation.tiltModeFine') }}</el-radio-button>
        </el-radio-group>
      </div>
      <p v-if="useTilt && tiltMode === 'fast'" class="tip-line">{{ t('elevation.tiltModeFastTip') }}</p>
      <div class="row">
        <el-button
          size="small"
          type="primary"
          :loading="sampling"
          :disabled="!points.length || sampling"
          @click="startSampling"
        >
          {{ t('elevation.start') }}
        </el-button>
        <el-button size="small" plain :disabled="!sampling" @click="cancel">
          {{ t('elevation.stop') }}
        </el-button>
        <el-button size="small" text :disabled="!results.length" @click="clearResults">
          {{ t('elevation.clear') }}
        </el-button>
      </div>
      <template v-if="sampling">
        <el-progress :percentage="progress" :stroke-width="6" :show-text="false" />
        <p class="progress-text">{{ progressText }}</p>
      </template>
      <p v-if="sampleError" class="err">{{ sampleError }}</p>
    </div>

    <!-- 结果 -->
    <div class="block result-block">
      <div class="block-head">
        <span class="block-title">{{ t('elevation.result') }}</span>
        <span class="meta">{{ results.length }} / {{ points.length }}</span>
      </div>
      <div class="result-table-wrap">
        <el-table :data="tableRows" size="small" height="100%" class="result-table" border>
          <el-table-column prop="id" :label="t('elevation.colId')" width="44" />
          <el-table-column :label="t('elevation.colLon')" width="92">
            <template #default="{ row }">{{ formatCoord(row.lon) }}</template>
          </el-table-column>
          <el-table-column :label="t('elevation.colLat')" width="84">
            <template #default="{ row }">{{ formatCoord(row.lat) }}</template>
          </el-table-column>
          <el-table-column :label="t('elevation.colTerrain')" width="74" align="right">
            <template #default="{ row }">{{ formatHeight(row.terrainHeight) }}</template>
          </el-table-column>
          <el-table-column :label="t('elevation.colTilt')" width="68" align="right">
            <template #default="{ row }">{{ formatHeight(row.meshHeight) }}</template>
          </el-table-column>
          <el-table-column :label="t('elevation.colAltitude')" width="70" align="right">
            <template #default="{ row }">
              <span class="alt">{{ formatHeight(row.altitude) }}</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('elevation.colView')" width="58" align="center">
            <template #default="{ row }">
              <el-button
                link
                type="primary"
                size="small"
                @click="flyToPoint(row.lon, row.lat, row.altitude)"
              >
                {{ t('elevation.view') }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <p v-if="results.length > TABLE_ROWS" class="meta table-more">
        {{ t('elevation.tableLimit', { count: results.length, limit: TABLE_ROWS }) }}
      </p>
      <div class="row download">
        <el-button size="small" plain :disabled="!canDownload" @click="downloadGeoJson">
          {{ t('elevation.downloadGeoJson') }}
        </el-button>
        <el-button size="small" plain :disabled="!canDownload" @click="downloadExcel">
          {{ t('elevation.downloadExcel') }}
        </el-button>
      </div>
    </div>
    </CesiumOverlay>
  </div>
</template>

<style scoped>
.block {
  flex: none;
  padding-bottom: 10px;
  margin-bottom: 10px;
  border-bottom: 1px dashed #e6e8eb;
}
.block:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.block-title {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}
.meta {
  font-size: 11px;
  color: #94a3b8;
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.row :deep(.el-button + .el-button) {
  margin-left: 0;
}
.limit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #94a3b8;
}
.limit :deep(.el-input-number) {
  width: 96px;
}
.file-name {
  margin: 6px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: #9ca3af;
}
.progress-text {
  margin: 6px 0 0;
  font-size: 11px;
  color: #64748b;
}
.tip-line {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.5;
  color: #94a3b8;
}
.err {
  margin: 6px 0 0;
  font-size: 11px;
  color: #ef4444;
}
.result-block {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.result-block > .block-head,
.result-block > .download {
  flex: none;
}
.result-table-wrap {
  flex: 1;
  min-height: 0;
}
.result-table {
  width: 100%;
  font-size: 11px;
}
.result-table :deep(.el-table__cell) {
  padding: 3px 0;
}
.alt {
  font-weight: 600;
  color: #2563eb;
}
.download {
  margin-top: 8px;
}
.table-more {
  flex: none;
  margin: 4px 0 0;
  text-align: right;
}
</style>
