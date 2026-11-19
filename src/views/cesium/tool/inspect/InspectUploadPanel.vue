<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useAssetInspect } from '@/composables/useCesiumAssetInspect'
import { assetUrl } from '@/utils/publicUrl'
import type { AssetKind } from '@/utils/gis/assetInspect'

const { t } = useI18n()
const store = useAssetInspect()
const { kind, loading, error, notice, result, loadedToMap, sizeText } = store

const url = ref('')
const fileInput = ref<HTMLInputElement>()

const TABS: Array<{ key: AssetKind; label: string }> = [
  { key: 'geojson', label: 'inspect.tabGeoJson' },
  { key: 'tileset', label: 'inspect.tabTileset' },
  { key: 'model', label: 'inspect.tabModel' },
]

const presets = computed<Record<AssetKind, Array<{ label: string; url: string }>>>(() => ({
  geojson: [
    { label: t('inspect.presetPoint'), url: assetUrl('data/geojson/point.json') },
    { label: t('inspect.presetLine'), url: assetUrl('data/geojson/line.json') },
    { label: t('inspect.presetPolygon'), url: assetUrl('data/geojson/polygon.json') },
    { label: t('inspect.presetStates'), url: assetUrl('data/geojson/us-states.json') },
  ],
  tileset: [{ label: t('inspect.presetDuckTileset'), url: assetUrl('data/tiles/duck/tileset.json') }],
  model: [
    { label: t('inspect.presetDuckModel'), url: assetUrl('data/models/Duck.glb') },
    { label: t('inspect.presetTruckModel'), url: assetUrl('data/models/CesiumMilkTruck.glb') },
  ],
}))

const tipKey = computed(() => {
  if (kind.value === 'tileset') return 'inspect.tipTileset'
  if (kind.value === 'model') return 'inspect.tipModel'
  return 'inspect.tipGeoJson'
})

function changeKind(next: string | number | boolean | undefined) {
  store.setKind(next as AssetKind)
  url.value = ''
}

function submit() {
  if (!url.value.trim()) {
    error.value = t('inspect.urlEmpty')
    return
  }
  void store.loadUrl(url.value)
}

function usePreset(target: string) {
  url.value = target
  void store.loadUrl(target)
}

function pickFile() {
  fileInput.value?.click()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void store.loadFile(file)
  input.value = ''
}
</script>

<template>
  <CesiumOverlay
    class="absolute left-3 top-3 bottom-3 z-10"
    :title="t('inspect.title')"
    :width="340"
    fill
  >
    <div class="flex flex-col gap-3">
      <el-radio-group :model-value="kind" size="small" class="w-full" @change="changeKind">
        <el-radio-button v-for="tab in TABS" :key="tab.key" :value="tab.key">
          {{ t(tab.label) }}
        </el-radio-button>
      </el-radio-group>

      <p class="tip">{{ t(tipKey) }}</p>

      <div class="space-y-2">
        <div class="section-title">{{ t('inspect.source') }}</div>
        <el-input
          v-model="url"
          size="small"
          :placeholder="t('inspect.urlPlaceholder')"
          clearable
          @keyup.enter="submit"
        />
        <div class="flex flex-wrap items-center gap-2">
          <el-button size="small" type="primary" :loading="loading" @click="submit">
            {{ t('inspect.load') }}
          </el-button>
          <el-button size="small" @click="pickFile">{{ t('inspect.chooseFile') }}</el-button>
          <el-button size="small" text :disabled="!loadedToMap" @click="store.zoom()">
            {{ t('inspect.locate') }}
          </el-button>
          <el-button size="small" text @click="store.clear()">{{ t('inspect.clear') }}</el-button>
        </div>
        <input
          ref="fileInput"
          type="file"
          class="hidden"
          accept=".json,.geojson,.gltf,.glb"
          @change="onFileChange"
        />
      </div>

      <div class="space-y-2">
        <div class="section-title">{{ t('inspect.preset') }}</div>
        <div class="flex flex-wrap gap-1.5">
          <el-button
            v-for="preset in presets[kind]"
            :key="preset.url"
            size="small"
            round
            @click="usePreset(preset.url)"
          >
            {{ preset.label }}
          </el-button>
        </div>
      </div>

      <div v-if="loading" class="status">{{ t('inspect.parsing') }}</div>
      <div v-if="error" class="alert error">{{ error }}</div>
      <div v-if="notice" class="alert info">{{ t(notice) }}</div>

      <div v-if="result" class="summary">
        <div class="summary-row">
          <span>{{ t('inspect.dataName') }}</span>
          <b :title="result.name">{{ result.name }}</b>
        </div>
        <div class="summary-row">
          <span>{{ t('inspect.size') }}</span>
          <b>{{ sizeText }}</b>
        </div>
        <div class="summary-row">
          <span>{{ t('inspect.mapState') }}</span>
          <b :class="loadedToMap ? 'text-[#059669]' : 'text-[#b45309]'">
            {{ loadedToMap ? t('inspect.onMap') : t('inspect.notOnMap') }}
          </b>
        </div>
      </div>

      <div class="space-y-2">
        <div class="section-title">{{ t('inspect.options') }}</div>

        <template v-if="kind === 'geojson'">
          <div class="option-row">
            <span>{{ t('inspect.clamp') }}</span>
            <el-switch
              :model-value="store.geoOptions.clamp"
              size="small"
              @change="store.setGeoClamp($event as boolean)"
            />
          </div>
        </template>

        <template v-else-if="kind === 'tileset'">
          <div class="option-row">
            <span>{{ t('inspect.visible') }}</span>
            <el-switch
              :model-value="store.tilesetOptions.show"
              size="small"
              @change="store.setTilesetVisible($event as boolean)"
            />
          </div>
          <div class="option-row">
            <span>{{ t('inspect.wireframe') }}</span>
            <el-switch
              :model-value="store.tilesetOptions.wireframe"
              size="small"
              @change="store.setTilesetWireframe($event as boolean)"
            />
          </div>
          <div class="option-row">
            <span>{{ t('inspect.boundingVolume') }}</span>
            <el-switch
              :model-value="store.tilesetOptions.boundingVolume"
              size="small"
              @change="store.setTilesetBoundingVolume($event as boolean)"
            />
          </div>
          <div class="option-row">
            <span>{{ t('inspect.maxError') }}</span>
            <el-slider
              class="flex-1"
              :model-value="store.tilesetOptions.maxError"
              :min="4"
              :max="64"
              :step="4"
              size="small"
              @change="store.setTilesetMaxError($event as number)"
            />
            <b class="w-6 text-right">{{ store.tilesetOptions.maxError }}</b>
          </div>
        </template>

        <template v-else>
          <div class="grid grid-cols-2 gap-2">
            <label class="number-field">
              <span>{{ t('inspect.lon') }}</span>
              <el-input-number
                :model-value="store.modelOptions.lon"
                :precision="6"
                :step="0.001"
                size="small"
                controls-position="right"
                @change="store.updateModelOption('lon', $event as number)"
              />
            </label>
            <label class="number-field">
              <span>{{ t('inspect.lat') }}</span>
              <el-input-number
                :model-value="store.modelOptions.lat"
                :precision="6"
                :step="0.001"
                size="small"
                controls-position="right"
                @change="store.updateModelOption('lat', $event as number)"
              />
            </label>
            <label class="number-field">
              <span>{{ t('inspect.height') }}</span>
              <el-input-number
                :model-value="store.modelOptions.height"
                :step="1"
                size="small"
                controls-position="right"
                @change="store.updateModelOption('height', $event as number)"
              />
            </label>
            <label class="number-field">
              <span>{{ t('inspect.scale') }}</span>
              <el-input-number
                :model-value="store.modelOptions.scale"
                :min="0.01"
                :step="0.1"
                size="small"
                controls-position="right"
                @change="store.updateModelOption('scale', $event as number)"
              />
            </label>
          </div>
          <p class="tip">{{ t('inspect.placeTip') }}</p>
        </template>
      </div>
    </div>
  </CesiumOverlay>
</template>

<style scoped>
.tip {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: #6b7280;
}
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}
.status {
  border-radius: 6px;
  background: #eff6ff;
  padding: 6px 8px;
  font-size: 12px;
  color: #1d4ed8;
}
.alert {
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-all;
}
.alert.error {
  background: #fef2f2;
  color: #b91c1c;
}
.alert.info {
  background: #fffbeb;
  color: #b45309;
}
.summary {
  border-radius: 8px;
  border: 1px solid #eef0f3;
  background: #fafbfc;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.summary-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.summary-row span {
  flex: none;
  color: #6b7280;
}
.summary-row b {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  color: #111827;
}
.option-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: #4b5563;
}
.option-row > span {
  width: 64px;
  flex: none;
}
.number-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11.5px;
  color: #6b7280;
}
.number-field :deep(.el-input-number) {
  width: 100%;
}
</style>
