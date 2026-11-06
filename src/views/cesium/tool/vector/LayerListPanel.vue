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
      <li v-for="item in items" :key="item.id" class="row" :class="{ off: !item.enabled }">
        <el-checkbox
          :model-value="item.enabled"
          size="small"
          @change="(v: any) => onCheck(item.id, v)"
        />
        <el-icon class="type-icon">
          <component :is="iconMap[item.type]" />
        </el-icon>

        <div class="meta">
          <button type="button" class="name" :title="t('vector.locate')" @click="store.flyTo(item.id)">
            {{ item.name }}
          </button>
          <span class="time">
            {{ item.createTime }}
            <em v-if="item.clamped" class="clamp">{{ t('vector.clampedTip') }}</em>
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
