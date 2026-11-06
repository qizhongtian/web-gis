<script setup lang="ts">
import { computed, reactive, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useVectorLayersStore } from '@/composables/useCesiumVectorLayers'
import {
  detectVectorType,
  type LineStyle,
  type PointStyle,
  type PolygonStyle,
  type VectorLayerPayload,
  type VectorType,
} from '@/utils/gis/vectorLayerLoader'

const { t } = useI18n()
const store = useVectorLayersStore()

/** 默认点位图标（内联 SVG，避免依赖外部图片资源） */
const DEFAULT_POINT_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
     <path d="M16 39C16 39 31 22.8 31 15A15 15 0 1 0 1 15C1 22.8 16 39 16 39Z" fill="#2563eb" stroke="#ffffff" stroke-width="2"/>
     <circle cx="16" cy="15" r="5.4" fill="#ffffff"/>
   </svg>`,
)}`

function nowText() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 公共字段 + 三类样式字段 */
const form = reactive({
  name: '',
  createTime: nowText(),
  enabled: true,
  // 点
  image: DEFAULT_POINT_IMAGE,
  scale: 1,
  // 线
  lineColor: '#2563eb',
  lineWidth: 2,
  dashed: false,
  // 面
  outlineColor: '#1d4ed8',
  fillColor: '#3b82f6',
  fillAlpha: 0.35,
  outlineDashed: false,
  outlineWidth: 2,
})

const fileInput = ref<HTMLInputElement>()
const imageInput = ref<HTMLInputElement>()
const fileName = ref('')
/** 已解析的 GeoJSON */
const geo = shallowRef<any>(null)
const type = ref<VectorType | ''>('')

const typeLabel = computed(() => {
  if (type.value === 'point') return t('vector.typePoint')
  if (type.value === 'line') return t('vector.typeLine')
  if (type.value === 'polygon') return t('vector.typePolygon')
  return ''
})

/** 读取 GeoJSON 并识别要素类型 */
async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const json = JSON.parse(await file.text())
    const detected = detectVectorType(json)
    if (!detected) {
      geo.value = null
      type.value = ''
      fileName.value = ''
      ElMessage.warning(t('vector.noFeatures'))
      return
    }
    geo.value = json
    type.value = detected
    fileName.value = file.name
    if (!form.name) form.name = file.name.replace(/\.(geo)?json$/i, '')
  } catch {
    geo.value = null
    type.value = ''
    fileName.value = ''
    ElMessage.error(t('vector.parseError'))
  }
}

/** 点位图片：读为 dataURL 直接给 billboard 使用 */
function onImage(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    form.image = String(reader.result || '')
  }
  reader.readAsDataURL(file)
}

function buildStyle(): PointStyle | LineStyle | PolygonStyle {
  if (type.value === 'point') {
    return { image: form.image, scale: form.scale, verticalOrigin: 'BOTTOM' }
  }
  if (type.value === 'line') {
    return { color: form.lineColor, width: form.lineWidth, dashed: form.dashed }
  }
  return {
    outlineColor: form.outlineColor,
    fillColor: form.fillColor,
    fillAlpha: form.fillAlpha,
    outlineDashed: form.outlineDashed,
    outlineWidth: form.outlineWidth,
  }
}

function reset() {
  form.name = ''
  form.createTime = nowText()
  form.enabled = true
  form.image = DEFAULT_POINT_IMAGE
  form.scale = 1
  form.lineColor = '#2563eb'
  form.lineWidth = 2
  form.dashed = false
  form.outlineColor = '#1d4ed8'
  form.fillColor = '#3b82f6'
  form.fillAlpha = 0.35
  form.outlineDashed = false
  form.outlineWidth = 2
  geo.value = null
  type.value = ''
  fileName.value = ''
}

/** 提交：组装 payload 交给图层管理器（等价于后端接口返回结构） */
function submit() {
  if (!geo.value || !type.value) return ElMessage.warning(t('vector.needFile'))
  if (!form.name.trim()) return ElMessage.warning(t('vector.needName'))
  if (!form.createTime) return ElMessage.warning(t('vector.needTime'))
  if (type.value === 'point' && !form.image) return ElMessage.warning(t('vector.needImage'))

  const payload: VectorLayerPayload = {
    id: `vec-${Date.now()}`,
    name: form.name.trim(),
    createTime: form.createTime,
    enabled: form.enabled,
    type: type.value,
    data: geo.value,
    style: buildStyle(),
  }

  const loaded = store.add(payload)
  if (!loaded) {
    ElMessage.error(store.error.value || t('vector.noFeatures'))
    return
  }
  ElMessage.success(t('vector.added', { count: loaded.count }))
  // 保留样式配置，方便连续添加同类图层
  geo.value = null
  type.value = ''
  fileName.value = ''
  form.name = ''
  form.createTime = nowText()
}

</script>

<template>
  <CesiumOverlay :title="t('vector.title')" class="absolute left-3 top-3 z-10" :width="308">
    <el-form label-width="78px" label-position="left" size="small" class="vec-form">
      <el-form-item :label="t('vector.name')">
        <el-input v-model="form.name" :placeholder="t('vector.namePlaceholder')" clearable />
      </el-form-item>

      <el-form-item :label="t('vector.createTime')">
        <el-date-picker
          v-model="form.createTime"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm"
          format="YYYY-MM-DD HH:mm"
          :clearable="false"
          class="w-full"
        />
      </el-form-item>

      <el-form-item :label="t('vector.enabled')">
        <el-switch v-model="form.enabled" />
      </el-form-item>

      <el-form-item :label="t('vector.file')">
        <div class="file-row">
          <el-button size="small" @click="fileInput?.click()">{{ t('vector.chooseFile') }}</el-button>
          <input
            ref="fileInput"
            type="file"
            accept=".json,.geojson,application/json"
            hidden
            @change="onFile"
          />
          <span class="file-name">{{ fileName || t('vector.noFile') }}</span>
        </div>
      </el-form-item>

      <el-form-item v-if="type" :label="t('vector.type')">
        <el-tag size="small" effect="light" type="primary">{{ typeLabel }}</el-tag>
      </el-form-item>

      <!-- 点：图片点位 + 大小，不显示 label -->
      <template v-if="type === 'point'">
        <el-form-item :label="t('vector.pointImage')">
          <div class="img-row">
            <img :src="form.image" class="img-preview" alt="" />
            <el-button size="small" @click="imageInput?.click()">{{ t('vector.chooseFile') }}</el-button>
            <input ref="imageInput" type="file" accept="image/*" hidden @change="onImage" />
          </div>
        </el-form-item>
        <el-form-item :label="t('vector.pointScale')">
          <div class="slider-row">
            <el-slider v-model="form.scale" :min="0.2" :max="4" :step="0.1" />
            <span class="val">{{ form.scale.toFixed(1) }}</span>
          </div>
        </el-form-item>
      </template>

      <!-- 线：颜色 / 粗细 / 虚实线 -->
      <template v-else-if="type === 'line'">
        <el-form-item :label="t('vector.lineColor')">
          <el-color-picker v-model="form.lineColor" size="small" />
        </el-form-item>
        <el-form-item :label="t('vector.lineWidth')">
          <div class="slider-row">
            <el-slider v-model="form.lineWidth" :min="1" :max="12" :step="1" />
            <span class="val">{{ form.lineWidth }}px</span>
          </div>
        </el-form-item>
        <el-form-item :label="t('vector.dashed')">
          <el-switch v-model="form.dashed" />
        </el-form-item>
      </template>

      <!-- 面：填充色 / 透明度 / 轮廓色 / 轮廓虚实线 -->
      <template v-else-if="type === 'polygon'">
        <el-form-item :label="t('vector.fillColor')">
          <el-color-picker v-model="form.fillColor" size="small" />
        </el-form-item>
        <el-form-item :label="t('vector.fillAlpha')">
          <div class="slider-row">
            <el-slider v-model="form.fillAlpha" :min="0" :max="1" :step="0.05" />
            <span class="val">{{ Math.round(form.fillAlpha * 100) }}%</span>
          </div>
        </el-form-item>
        <el-form-item :label="t('vector.outlineColor')">
          <el-color-picker v-model="form.outlineColor" size="small" />
        </el-form-item>
        <el-form-item :label="t('vector.outlineWidth')">
          <div class="slider-row">
            <el-slider v-model="form.outlineWidth" :min="1" :max="10" :step="1" />
            <span class="val">{{ form.outlineWidth }}px</span>
          </div>
        </el-form-item>
        <el-form-item :label="t('vector.outlineDashed')">
          <el-switch v-model="form.outlineDashed" />
        </el-form-item>
      </template>

      <!-- 未选文件时的引导 -->
      <p v-else class="empty-type">{{ t('vector.emptyTip') }}</p>
    </el-form>

    <div class="actions">
      <el-button size="small" type="primary" :disabled="!type" @click="submit">
        {{ t('vector.add') }}
      </el-button>
      <el-button size="small" plain @click="reset">{{ t('vector.reset') }}</el-button>
    </div>

    <p v-if="store.error.value" class="err">{{ store.error.value }}</p>
  </CesiumOverlay>
</template>

<style scoped>
.vec-form :deep(.el-form-item) {
  margin-bottom: 10px;
}
.vec-form :deep(.el-form-item__label) {
  font-size: 12px;
  color: #6b7280;
}
.file-row,
.img-row,
.slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: #9ca3af;
}
.img-preview {
  width: 30px;
  height: 36px;
  object-fit: contain;
  border-radius: 6px;
  border: 1px solid #e6e8eb;
  background: #f8fafc;
}
.slider-row :deep(.el-slider) {
  flex: 1;
}
.val {
  width: 34px;
  text-align: right;
  font-size: 11px;
  color: #6b7280;
}
.actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
}
.empty-type {
  margin: 0 0 8px;
  padding: 10px;
  border-radius: 8px;
  background: #f8fafc;
  font-size: 11px;
  color: #9ca3af;
  text-align: center;
}
.err {
  margin: 8px 0 0;
  font-size: 11px;
  color: #ef4444;
}

</style>
