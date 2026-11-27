<script setup lang="ts">
import { computed } from 'vue'
import CesiumOverlay from '@/components/CesiumOverlay.vue'

/**
 * HK Traffic Intelligence 控制面板
 * —— 纯 UI：通过 props 接收当前状态，emit 事件给父组件处理。
 */

export interface LayerToggles {
  mtr: boolean
  lightRail: boolean
  centerlines: boolean
  ferryPiers: boolean
  evChargers: boolean
  citybus: boolean
  kmb: boolean
  nlb: boolean
  gmb: boolean
  lwb: boolean
  roadPoints: boolean
}

const props = defineProps<{
  layers: LayerToggles
  lastUpdated: string
  loading: boolean
  ready: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle', key: keyof LayerToggles, value: boolean): void
  (e: 'refresh'): void
}>()

const transitItems = computed(() => [
  { key: 'mtr' as const,      label: '港铁路网 / MTR',          hint: '线路 + 车站' },
  { key: 'lightRail' as const, label: '轻铁 / Light Rail',       hint: '新界西北' },
])
const busItems = computed(() => [
  { key: 'citybus' as const, label: '城巴 / Citybus', hint: '#EA580C' },
  { key: 'kmb' as const,     label: '九巴 / KMB',     hint: '#DC2626' },
  { key: 'nlb' as const,     label: '新大屿山 / NLB', hint: '#7C3AED' },
  { key: 'gmb' as const,     label: '专线小巴 / GMB', hint: '#059669' },
  { key: 'lwb' as const,     label: '龙运机场 / LWB', hint: '仅线路 A30…A35' },
])
const facilityItems = computed(() => [
  { key: 'centerlines' as const, label: '策略性干道 / Centerlines', hint: '道路中心线' },
  { key: 'roadPoints' as const,  label: '道路点位 / Road Points',   hint: '分类集合' },
  { key: 'ferryPiers' as const,  label: '渡轮码头 / Ferry Piers',  hint: '全港码头' },
  { key: 'evChargers' as const,  label: '充电桩 / EV Chargers',    hint: '分类型上色' },
])
</script>

<template>
  <div class="absolute top-3 left-3 z-20 flex flex-col gap-2 pointer-events-none">
    <CesiumOverlay title="香港交通情报" :width="260" fill>
      <div class="panel-content">
        <!-- 状态 -->
        <div class="status-row">
          <span class="status-dot" :class="{ ok: props.ready, loading: props.loading }" />
          <span class="status-text">{{ props.loading ? '加载中…' : props.ready ? '已就绪' : '待加载' }}</span>
          <el-button size="small" link type="primary" :disabled="props.loading" @click="emit('refresh')">刷新</el-button>
        </div>

        <!-- 港铁 / 轻铁 -->
        <div class="section-title">铁路 / Rail</div>
        <div class="layer-list">
          <label v-for="it in transitItems" :key="it.key" class="layer-item">
            <input type="checkbox" :checked="props.layers[it.key]" class="layer-check" @change="emit('toggle', it.key, ($event.target as HTMLInputElement).checked)" />
            <div class="layer-meta">
              <div class="layer-label">{{ it.label }}</div>
              <div class="layer-hint">{{ it.hint }}</div>
            </div>
          </label>
        </div>

        <!-- 巴士 -->
        <div class="section-title">巴士 / Bus</div>
        <div class="layer-list">
          <label v-for="it in busItems" :key="it.key" class="layer-item">
            <input type="checkbox" :checked="props.layers[it.key]" class="layer-check" @change="emit('toggle', it.key, ($event.target as HTMLInputElement).checked)" />
            <div class="layer-meta">
              <div class="layer-label">{{ it.label }}</div>
              <div class="layer-hint">{{ it.hint }}</div>
            </div>
          </label>
        </div>

        <!-- 设施 -->
        <div class="section-title">设施 / Facilities</div>
        <div class="layer-list">
          <label v-for="it in facilityItems" :key="it.key" class="layer-item">
            <input type="checkbox" :checked="props.layers[it.key]" class="layer-check" @change="emit('toggle', it.key, ($event.target as HTMLInputElement).checked)" />
            <div class="layer-meta">
              <div class="layer-label">{{ it.label }}</div>
              <div class="layer-hint">{{ it.hint }}</div>
            </div>
          </label>
        </div>

        <div class="footer-time">更新：{{ props.lastUpdated || '—' }}</div>
      </div>
    </CesiumOverlay>
  </div>
</template>

<style scoped>
.panel-content { padding: 14px; display: flex; flex-direction: column; gap: 10px; pointer-events: auto; max-height: 78vh; overflow-y: auto; }
.status-row { display: flex; align-items: center; gap: 8px; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; }
.status-dot.ok { background: #16a34a; box-shadow: 0 0 0 3px rgba(22,163,74,.15); }
.status-dot.loading { background: #f59e0b; animation: pulse 1.2s infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
.status-text { flex: 1; font-size: 12px; color: #475569; }
.section-title { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: .04em; padding-top: 6px; }
.layer-list { display: flex; flex-direction: column; gap: 2px; }
.layer-item { display: flex; align-items: center; gap: 10px; padding: 4px 8px; border-radius: 8px; cursor: pointer; user-select: none; transition: background .15s; }
.layer-item:hover { background: rgba(37,99,235,.06); }
.layer-check { width: 14px; height: 14px; accent-color: #2563eb; cursor: pointer; }
.layer-meta { flex: 1; }
.layer-label { font-size: 12px; font-weight: 500; color: #1e293b; }
.layer-hint { font-size: 11px; color: #94a3b8; margin-top: 1px; }
.footer-time { margin-top: 4px; font-size: 11px; color: #94a3b8; border-top: 1px solid rgba(226,232,240,.7); padding-top: 10px; }
</style>
