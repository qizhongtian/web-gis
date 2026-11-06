<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CesiumViewer from '@/components/CesiumViewer.vue'
import VectorContext from './VectorContext.vue'

const { t } = useI18n()

// 组件名用于 layout 的 keep-alive include：切走再回来时地图 / 表单 / 图层状态都保留
defineOptions({ name: 'CesiumVectorUpload' })

/** 香港地政总署影像服务（WGS84 XYZ 瓦片） */
const HK_IMAGERY = 'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/imagery/WGS84/{z}/{x}/{y}.png'
/** 香港默认视角 */
const HK_HOME: [number, number, number] = [114.1694, 22.3193, 28000]
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <p class="demo-hint">{{ t('vector.hint') }}</p>

    <CesiumViewer
      class="flex-1 min-h-0 rounded-lg overflow-hidden"
      :home="HK_HOME"
      :imagery-url="HK_IMAGERY"
      :imagery-max-level="18"
      :status-bar="false"
    >
      <VectorContext />
    </CesiumViewer>
  </div>
</template>
