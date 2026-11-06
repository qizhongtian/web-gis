<script setup lang="ts">
import { computed, nextTick, reactive, ref, shallowRef, watch } from 'vue'
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

/** 正在编辑的已保存图层 id（空 = 新建） */
const editingId = ref('')
const isEditing = computed(() => Boolean(editingId.value))
/** 编辑前的快照，用于「取消编辑」回滚 */
let snapshot: VectorLayerPayload | null = null
/** 回填表单时跳过 watch，避免无意义的重建 */
let filling = false

const typeLabel = computed(() => {
  if (type.value === 'point') return t('vector.typePoint')
  if (type.value === 'line') return t('vector.typeLine')
  if (type.value === 'polygon') return t('vector.typePolygon')
  return ''
})

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

/** 组装当前表单对应的 payload */
function buildPayload(): VectorLayerPayload | null {
  if (!geo.value || !type.value) return null
  return {
    id: editingId.value || `vec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: form.name.trim() || fileName.value || t('vector.unnamed'),
    createTime: form.createTime || nowText(),
    enabled: form.enabled,
    type: type.value,
    data: geo.value,
    style: buildStyle(),
  }
}

/* ---------------- 实时预览 / 实时更新 ---------------- */

let applyTimer: ReturnType<typeof setTimeout> | undefined

/** 立即把当前参数应用到地图：编辑态更新正式图层，新建态更新预览层 */
function applyNow(fly = false) {
  const payload = buildPayload()
  if (!payload) return
  if (editingId.value) {
    store.update(editingId.value, payload)
  } else {
    store.preview(payload, fly)
  }
}

/** 参数变化防抖应用，实现「一边调参数一边看」 */
function scheduleApply() {
  if (filling) return
  if (!geo.value || !type.value) return
  clearTimeout(applyTimer)
  applyTimer = setTimeout(() => applyNow(false), 160)
}

watch(form, scheduleApply, { deep: true })

/* ---------------- 文件解析 ---------------- */

/** 读取 GeoJSON 并识别要素类型：解析成功后立即飞行定位并预览 */
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
      store.clearPreview()
      ElMessage.warning(t('vector.noFeatures'))
      return
    }
    // 上传新文件即开始新的编辑对象：名称 / 时间按新图层重置
    leaveEditing(false)
    geo.value = json
    type.value = detected
    fileName.value = file.name
    form.name = file.name.replace(/\.(geo)?json$/i, '')
    form.createTime = nowText()
    // 立即渲染 + 飞到数据范围
    await nextTick()
    applyNow(true)
  } catch {
    geo.value = null
    type.value = ''
    fileName.value = ''
    store.clearPreview()
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

/* ---------------- 新建 / 编辑 ---------------- */

function resetForm(keepStyle = true) {
  form.name = ''
  form.createTime = nowText()
  form.enabled = true
  if (!keepStyle) {
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
  }
  geo.value = null
  type.value = ''
  fileName.value = ''
  store.clearPreview()
}

/** 退出编辑态（可选清空表单） */
function leaveEditing(clearForm = true) {
  clearTimeout(applyTimer)
  editingId.value = ''
  snapshot = null
  store.clearSelection()
  if (clearForm) resetForm(true)
}

/** 编辑已有图层：把 payload 回填到表单 */
function enterEditing(payload: VectorLayerPayload) {
  filling = true
  clearTimeout(applyTimer)
  // 编辑已保存图层时，先清掉未保存的预览，避免两套图形叠在一起
  store.clearPreview()
  editingId.value = payload.id
  snapshot = { ...payload, style: JSON.parse(JSON.stringify(payload.style)) }
  form.name = payload.name
  form.createTime = payload.createTime
  form.enabled = payload.enabled !== false
  const style = payload.style as any
  if (payload.type === 'point') {
    form.image = style.image || DEFAULT_POINT_IMAGE
    form.scale = style.scale ?? 1
  } else if (payload.type === 'line') {
    form.lineColor = style.color || '#2563eb'
    form.lineWidth = style.width ?? 2
    form.dashed = Boolean(style.dashed)
  } else {
    form.outlineColor = style.outlineColor || '#1d4ed8'
    form.fillColor = style.fillColor || '#3b82f6'
    form.fillAlpha = style.fillAlpha ?? 0.35
    form.outlineDashed = Boolean(style.outlineDashed)
    form.outlineWidth = style.outlineWidth ?? 2
  }
  type.value = payload.type
  geo.value = payload.data
  fileName.value = payload.name
  nextTick(() => {
    filling = false
  })
}

// 图层列表点击名称 -> 选中并定位，同时进入编辑
watch(
  () => store.selectedId.value,
  (id) => {
    // 图层被删除 / 清空后退出编辑态
    if (!id) {
      if (editingId.value) leaveEditing()
      return
    }
    if (id === editingId.value) return
    const payload = store.getPayload(id)
    if (payload) enterEditing(payload)
  },
)

/** 新建：把预览固化成正式图层 */
function submit() {
  const payload = buildPayload()
  if (!payload) return ElMessage.warning(t('vector.needFile'))
  if (!form.name.trim()) return ElMessage.warning(t('vector.needName'))
  if (!form.createTime) return ElMessage.warning(t('vector.needTime'))
  if (type.value === 'point' && !form.image) return ElMessage.warning(t('vector.needImage'))

  const loaded = store.add(payload)
  if (!loaded) {
    ElMessage.error(store.error.value || t('vector.noFeatures'))
    return
  }
  store.clearPreview()
  ElMessage.success(t('vector.added', { count: loaded.count }))
  // 保留样式配置，方便连续添加同类图层
  resetForm(true)
}

/** 编辑：参数已实时生效，这里只做收尾 */
function finishEdit() {
  if (editingId.value) {
    const payload = buildPayload()
    if (payload) store.update(editingId.value, payload)
    ElMessage.success(t('vector.updated'))
  }
  leaveEditing()
}

/** 取消编辑：回滚到编辑前的参数 */
function cancelEdit() {
  if (editingId.value && snapshot) {
    store.update(editingId.value, snapshot)
  }
  leaveEditing()
}

/** 重置（新建态）：清空表单与预览 */
function reset() {
  leaveEditing(false)
  resetForm(false)
}

/* ---------------- 复制关键参数 ---------------- */

function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => ElMessage.success(t('vector.copied')),
      () => legacyCopy(text),
    )
    return
  }
  legacyCopy(text)
}

function legacyCopy(text: string) {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    ElMessage.success(t('vector.copied'))
  } catch {
    ElMessage.error(t('vector.copyFailed'))
  }
}

/** 复制关键参数：图片用占位标记，避免把超长 dataURL 复制出去 */
function copyParams() {
  if (!paramsText.value) return
  copyText(paramsText.value)
}

/* ---------------- 关键参数展示（随表单实时变化） ---------------- */

/** 默认收起，标题行直接显示一行参数摘要；展开看完整 JSON */
const paramsVisible = ref(false)

const paramSnapshot = computed(() => {
  if (!type.value) return null
  const style = { ...(buildStyle() as any) }
  if (type.value === 'point') {
    style.image =
      form.image === DEFAULT_POINT_IMAGE
        ? '<default-point-icon>'
        : form.image.startsWith('data:')
          ? `<image:${form.image.slice(5, form.image.indexOf(';') || 20)}>`
          : form.image
  }
  return {
    name: form.name.trim() || t('vector.unnamed'),
    createTime: form.createTime,
    enabled: form.enabled,
    type: type.value,
    style,
  }
})

/** 展示 / 复制的参数文本：与地图上当前预览的样式完全一致 */
const paramsText = computed(() =>
  paramSnapshot.value ? JSON.stringify(paramSnapshot.value, null, 2) : '',
)

/** 收起状态下的一行摘要：scale=1 · verticalOrigin=BOTTOM · image=<default-point-icon> */
const paramsBrief = computed(() => {
  const style = paramSnapshot.value?.style as Record<string, any> | undefined
  if (!style) return ''
  // image 可能是超长占位，放最后，关键数值优先展示
  const keys = Object.keys(style).sort(
    (a, b) => (a === 'image' ? 1 : 0) - (b === 'image' ? 1 : 0),
  )
  return keys.map((k) => `${k}=${style[k]}`).join(' · ')
})
</script>

<template>
  <CesiumOverlay :title="t('vector.title')" class="absolute left-3 top-3 z-10" :width="308">
    <p v-if="isEditing" class="edit-tip">{{ t('vector.editing') }}</p>

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
      <template v-if="isEditing">
        <el-button size="small" type="primary" @click="finishEdit">
          {{ t('vector.saveEdit') }}
        </el-button>
        <el-button size="small" plain @click="cancelEdit">{{ t('vector.cancelEdit') }}</el-button>
      </template>
      <template v-else>
        <el-button size="small" type="primary" :disabled="!type" @click="submit">
          {{ t('vector.add') }}
        </el-button>
        <el-button size="small" plain @click="reset">{{ t('vector.reset') }}</el-button>
      </template>
    </div>

    <!-- 关键参数：随表单实时变化，直接可见也可一键复制 -->
    <div v-if="type" class="params">
      <div class="params-head">
        <button
          type="button"
          class="params-toggle"
          :title="paramsBrief"
          @click="paramsVisible = !paramsVisible"
        >
          <el-icon class="params-arrow" :class="{ open: paramsVisible }">
            <component :is="'ArrowRight'" />
          </el-icon>
          <span class="params-title">{{ t('vector.params') }}</span>
          <span v-show="!paramsVisible" class="params-brief">{{ paramsBrief }}</span>
        </button>
        <el-button size="small" text @click="copyParams">{{ t('vector.copyParams') }}</el-button>
      </div>
      <pre v-show="paramsVisible" class="params-body">{{ paramsText }}</pre>
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
.edit-tip {
  margin: 0 0 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  font-size: 11px;
  color: #1d4ed8;
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
.params {
  margin-top: 8px;
  border: 1px solid #e6e8eb;
  border-radius: 8px;
  background: #f8fafc;
  overflow: hidden;
}
.params-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px 2px 8px;
}
.params-toggle {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 4px;
  padding: 2px 0;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  color: #4b5563;
}
.params-brief {
  flex: 1;
  min-width: 0;
  margin-left: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  color: #94a3b8;
  text-align: left;
}
.params-arrow {
  font-size: 10px;
  transition: transform 0.2s;
}
.params-arrow.open {
  transform: rotate(90deg);
}
.params-body {
  margin: 0;
  padding: 8px 10px;
  max-height: 132px;
  overflow: auto;
  border-top: 1px dashed #e6e8eb;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.5;
  color: #334155;
  background: #fff;
  white-space: pre;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
}
.actions :deep(.el-button + .el-button) {
  margin-left: 0;
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
