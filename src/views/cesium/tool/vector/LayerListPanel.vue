<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useVectorLayersStore } from '@/composables/useCesiumVectorLayers'

const { t } = useI18n()
const store = useVectorLayersStore()
const { items } = store

const total = computed(() => items.value.length)

/** 类型图标（Element Plus 图标名） */
const iconMap: Record<string, string> = {
  point: 'LocationFilled',
  line: 'Share',
  polygon: 'FullScreen',
}

function onCheck(id: string, val: boolean | string | number) {
  store.setVisible(id, Boolean(val))
}

/** 样式值格式化：内联图片过长，用占位标记代替 */
function fmtVal(v: any) {
  if (typeof v === 'string' && v.startsWith('data:')) return '<inline-image>'
  return String(v)
}

/** 样式字段展示顺序：把最关键的数值放前面，图片占位放最后 */
const STYLE_KEYS = [
  'scale',
  'color',
  'width',
  'dashed',
  'fillColor',
  'fillAlpha',
  'outlineColor',
  'outlineWidth',
  'outlineDashed',
  'verticalOrigin',
  'image',
]

function sortByStyleOrder(entries: [string, any][]) {
  return entries.sort((a, b) => {
    const ia = STYLE_KEYS.indexOf(a[0])
    const ib = STYLE_KEYS.indexOf(b[0])
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
}

/** 图层关键参数摘要（名称下方直接可见，hover 展示完整内容） */
function styleSummary(id: string) {
  const p = store.getPayload(id)
  if (!p?.style) return ''
  const entries = Object.entries(p.style as Record<string, any>).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  )
  return sortByStyleOrder(entries)
    .map(([k, v]) => `${k}=${fmtVal(v)}`)
    .join(' · ')
}

function rowTitle(id: string, name: string) {
  const s = styleSummary(id)
  return s ? `${name}\n${s}\n${t('vector.locate')}` : `${name}\n${t('vector.locate')}`
}
</script>

<template>
  <CesiumOverlay :title="t('vector.layers')" class="absolute right-3 top-3 z-10" :width="292">
    <div class="head">
      <span class="count">{{ t('vector.total', { count: total }) }}</span>
      <el-button v-if="total" size="small" text type="danger" @click="store.clear()">
        {{ t('vector.clearAll') }}
      </el-button>
    </div>

    <p v-if="!total" class="empty">{{ t('vector.empty') }}</p>

    <ul v-else class="list">
      <li
        v-for="item in items"
        :key="item.id"
        class="row"
        :class="{ off: !item.enabled, active: store.selectedId.value === item.id }"
      >
        <el-checkbox
          :model-value="item.enabled"
          size="small"
          @change="(v: any) => onCheck(item.id, v)"
        />
        <el-icon class="type-icon">
          <component :is="iconMap[item.type]" />
        </el-icon>

        <div class="meta">
          <button
            type="button"
            class="name"
            :title="rowTitle(item.id, item.name)"
            @click="store.select(item.id)"
          >
            {{ item.name }}
          </button>
          <span class="time">
            {{ item.createTime }}
            <em v-if="item.clamped" class="clamp">{{ t('vector.clampedTip') }}</em>
          </span>
          <span class="style-text" :title="styleSummary(item.id)">
            {{ styleSummary(item.id) }}
          </span>
        </div>

        <el-button size="small" text type="danger" class="del" @click="store.remove(item.id)">
          ×
        </el-button>
      </li>
    </ul>
  </CesiumOverlay>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.count {
  font-size: 12px;
  color: #6b7280;
}
.empty {
  margin: 4px 0;
  padding: 12px 8px;
  border-radius: 8px;
  background: #f8fafc;
  font-size: 11px;
  color: #9ca3af;
  text-align: center;
  line-height: 1.6;
}
.list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 4px;
  border-radius: 8px;
  transition: background 0.15s ease;
}
.row:hover {
  background: #f5f8ff;
}
.row.active {
  background: #eef4ff;
  box-shadow: inset 0 0 0 1px #cdddff;
}
.row.off .type-icon,
.row.off .name {
  color: #b6bcc4;
}
.type-icon {
  flex: none;
  font-size: 14px;
  color: #2563eb;
}
.meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.name {
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 12px;
  line-height: 1.35;
  color: #1f2328;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.name:hover {
  color: #2563eb;
  text-decoration: underline;
}
.time {
  font-size: 10px;
  line-height: 1.3;
  color: #9ca3af;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.style-text {
  font-size: 10px;
  line-height: 1.3;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.clamp {
  margin-left: 4px;
  padding: 0 4px;
  border-radius: 3px;
  background: #f1f5f9;
  font-style: normal;
  color: #94a3b8;
}
.del {
  flex: none;
  min-width: 18px;
  padding: 0 2px;
  font-size: 14px;
  line-height: 1;
}
</style>
