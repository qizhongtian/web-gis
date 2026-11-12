<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CesiumViewer from '@/components/CesiumViewer.vue'
import { DEFAULT_IMAGERY_MAX_LEVEL, DEFAULT_IMAGERY_URL } from '@/utils/gis/cesiumConfig'
import ElevationPanel from './ElevationPanel.vue'

const { t } = useI18n()

/** 香港全景初始视角（面板内会在加载后微调为俯瞰角度） */
const HK_HOME: [number, number, number] = [114.1694, 22.3193, 42000]
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">{{ t('elevation.hint') }}</p>

    <CesiumViewer
      class="flex-1 min-h-0 rounded-lg overflow-hidden"
      :home="HK_HOME"
      :imagery-url="DEFAULT_IMAGERY_URL"
      :imagery-max-level="DEFAULT_IMAGERY_MAX_LEVEL"
      :status-bar="false"
    >
      <ElevationPanel />
    </CesiumViewer>
  </div>
</template>
