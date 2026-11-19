<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useAssetInspect } from '@/composables/useCesiumAssetInspect'
import { INSPECT_SNIPPETS, type AssetKind } from '@/utils/gis/assetInspect'

const { t } = useI18n()
const store = useAssetInspect()
const { kind, result, loadedToMap, pickedTitle, picked, runtime, modelNodes } = store

type TabKey = 'overview' | 'props' | 'raw' | 'usage'
const tab = ref<TabKey>('overview')
const copied = ref(false)
const RAW_LIMIT = 30000

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'inspect.tabOverview' },
  { key: 'props', label: 'inspect.tabProps' },
  { key: 'raw', label: 'inspect.tabRaw' },
  { key: 'usage', label: 'inspect.tabUsage' },
]

const capKeys = computed<Record<AssetKind, string[]>>(() => ({
  geojson: ['inspect.capGeoJson1', 'inspect.capGeoJson2', 'inspect.capGeoJson3'],
  tileset: ['inspect.capTileset1', 'inspect.capTileset2', 'inspect.capTileset3'],
  model: ['inspect.capModel1', 'inspect.capModel2', 'inspect.capModel3'],
}))

const keysTitle = computed(() =>
  kind.value === 'model' ? t('inspect.nodeNames') : t('inspect.fields'),
)

const usageTitle = computed(() => {
  if (kind.value === 'tileset') return t('inspect.usageTileset')
  if (kind.value === 'model') return t('inspect.usageModel')
  return t('inspect.usageGeoJson')
})

const code = computed(() => INSPECT_SNIPPETS[kind.value])

const rawText = computed(() => {
  try {
    return JSON.stringify(result.value?.raw ?? {}, null, 2)
  } catch {
    return ''
  }
})
const rawTruncated = computed(() => rawText.value.length > RAW_LIMIT)
const rawDisplay = computed(() =>
  rawTruncated.value ? rawText.value.slice(0, RAW_LIMIT) : rawText.value,
)

async function copyCode() {
  try {
    await navigator.clipboard.writeText(code.value)
    copied.value = true
    window.setTimeout(() => (copied.value = false), 1600)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <CesiumOverlay
    class="absolute right-3 top-3 bottom-3 z-10"
    :title="t('inspect.rightTitle')"
    :width="404"
    :collapsible="false"
    fill
  >
    <div v-if="!result" class="empty">
      <i class="empty-icon">i</i>
      <p>{{ t('inspect.empty') }}</p>
    </div>

    <div v-else class="flex h-full min-h-0 flex-col gap-3">
      <el-radio-group v-model="tab" size="small" class="w-full">
        <el-radio-button v-for="item in TABS" :key="item.key" :value="item.key">
          {{ t(item.label) }}
        </el-radio-button>
      </el-radio-group>

      <!-- 概览 -->
      <div v-if="tab === 'overview'" class="flex min-h-0 flex-1 flex-col gap-3 overflow-auto pr-0.5">
        <div class="summary-head">
          <b :title="result.name">{{ result.name }}</b>
          <span class="chip" :class="loadedToMap ? 'chip-ok' : 'chip-warn'">
            {{ loadedToMap ? t('inspect.onMap') : t('inspect.notOnMap') }}
          </span>
        </div>
        <p v-if="result.note" class="note">{{ result.note }}</p>

        <div>
          <div class="section-title">{{ t('inspect.metrics') }}</div>
          <div class="metric-grid">
            <div v-for="item in result.metrics" :key="item.key" class="metric">
              <span>{{ t(`inspect.metric.${item.key}`) }}</span>
              <b :title="item.value">{{ item.value }}</b>
            </div>
          </div>
        </div>

        <div>
          <div class="section-title">{{ t('inspect.capabilities') }}</div>
          <ul class="caps">
            <li v-for="key in capKeys[kind]" :key="key">{{ t(key) }}</li>
          </ul>
        </div>

        <p class="hint">{{ t('inspect.pickTip') }}</p>
      </div>

      <!-- 属性 -->
      <div v-else-if="tab === 'props'" class="flex min-h-0 flex-1 flex-col gap-3 overflow-auto pr-0.5">
        <div class="section">
          <div class="section-head">
            <span class="section-title">{{ t('inspect.picked') }}</span>
            <span v-if="pickedTitle" class="chip">{{ pickedTitle }}</span>
          </div>
          <div v-if="picked.length" class="kv-list">
            <div v-for="item in picked" :key="item.name" class="kv-row">
              <span class="kv-key">{{ item.name }}</span>
              <span class="kv-value" :title="item.value">{{ item.value }}</span>
            </div>
          </div>
          <p v-else class="muted">
            {{ pickedTitle ? t('inspect.noFeatureProps') : t('inspect.noPicked') }}
          </p>
        </div>

        <div class="section">
          <div class="section-title">{{ t('inspect.runtime') }}</div>
          <div v-if="runtime.length" class="kv-list">
            <div v-for="item in runtime" :key="item.name" class="kv-row">
              <span class="kv-key">{{ item.name }}</span>
              <span class="kv-value" :title="item.value">{{ item.value }}</span>
            </div>
          </div>
          <p v-else class="muted">{{ t('inspect.noFields') }}</p>
        </div>

        <div class="section">
          <div class="section-title">{{ keysTitle }}</div>
          <div v-if="result.keys.length" class="chips">
            <span v-for="key in result.keys" :key="key" class="chip">{{ key }}</span>
          </div>
          <p v-else class="muted">{{ t('inspect.noFields') }}</p>
        </div>

        <div v-if="result.sample.length" class="section">
          <div class="section-title">{{ t('inspect.sample') }}</div>
          <div class="kv-list">
            <div v-for="item in result.sample" :key="item.name" class="kv-row">
              <span class="kv-key">{{ item.name }}</span>
              <span class="kv-value" :title="item.value">{{ item.value }}</span>
            </div>
          </div>
        </div>

        <div v-if="kind === 'model' && modelNodes.length" class="section">
          <div class="section-title">{{ t('inspect.nodesTitle') }}</div>
          <div class="kv-list scroll-list">
            <div v-for="item in modelNodes" :key="item.name" class="kv-row">
              <span class="kv-key">{{ item.name }}</span>
              <span class="kv-value">{{ item.value }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 结构 -->
      <div v-else-if="tab === 'raw'" class="flex min-h-0 flex-1 flex-col gap-2">
        <p class="hint">{{ t('inspect.rawTip') }}</p>
        <pre class="code-block flex-1">{{ rawDisplay }}</pre>
        <p v-if="rawTruncated" class="hint">
          {{ t('inspect.truncated', { n: RAW_LIMIT }) }}
        </p>
      </div>

      <!-- 用法 -->
      <div v-else class="flex min-h-0 flex-1 flex-col gap-2">
        <div class="flex items-center gap-2">
          <span class="section-title flex-1">{{ usageTitle }}</span>
          <el-button size="small" text @click="copyCode">
            {{ copied ? t('inspect.copied') : t('inspect.copy') }}
          </el-button>
        </div>
        <pre class="code-block flex-1">{{ code }}</pre>
      </div>
    </div>
  </CesiumOverlay>
</template>

<style scoped>
.empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px;
  text-align: center;
  color: #6b7280;
  font-size: 12.5px;
  line-height: 1.7;
}
.empty-icon {
  display: inline-flex;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #eff6ff;
  color: #2563eb;
  font-style: normal;
  font-weight: 600;
}
.summary-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.summary-head b {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #111827;
}
.note {
  margin: 0;
  font-size: 11.5px;
  color: #6b7280;
}
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}
.section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.section-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 6px;
}
.metric {
  border: 1px solid #eef0f3;
  border-radius: 8px;
  background: #fafbfc;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.metric span {
  font-size: 11px;
  color: #6b7280;
}
.metric b {
  font-size: 12px;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.caps {
  margin: 6px 0 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: #4b5563;
}
.hint {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: #6b7280;
}
.muted {
  margin: 0;
  font-size: 12px;
  color: #9ca3af;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  border-radius: 5px;
  background: #f3f4f6;
  padding: 2px 6px;
  font-size: 11px;
  color: #4b5563;
  word-break: break-all;
}
.chip-ok {
  background: #ecfdf5;
  color: #059669;
}
.chip-warn {
  background: #fffbeb;
  color: #b45309;
}
.kv-list {
  border: 1px solid #eef0f3;
  border-radius: 8px;
  overflow: hidden;
}
.scroll-list {
  max-height: 220px;
  overflow: auto;
}
.kv-row {
  display: flex;
  gap: 8px;
  padding: 5px 8px;
  font-size: 12px;
  line-height: 1.5;
}
.kv-row + .kv-row {
  border-top: 1px solid #f3f4f6;
}
.kv-key {
  width: 42%;
  flex: none;
  color: #6b7280;
  word-break: break-all;
}
.kv-value {
  min-width: 0;
  flex: 1;
  color: #111827;
  word-break: break-all;
}
.code-block {
  margin: 0;
  min-height: 0;
  overflow: auto;
  border-radius: 8px;
  background: #0f172a;
  padding: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.6;
  color: #e2e8f0;
  tab-size: 2;
  white-space: pre;
}
</style>
