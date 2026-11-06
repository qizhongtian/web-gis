<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * GIS 加载动画
 * - 默认白色极简（二维地图）
 * - tech 开启科技风雷达（Cesium / Three 三维场景）
 * 样式见 public/loading.css
 */
const props = withDefaults(
  defineProps<{
    title?: string
    desc?: string
    /** 0-100；传 null 显示不确定进度 */
    progress?: number | null
    /** 小尺寸（用于较小的地图容器） */
    compact?: boolean
    /** 作为绝对定位遮罩铺满父容器 */
    overlay?: boolean
    /** 科技风雷达（三维场景） */
    tech?: boolean
  }>(),
  { title: '', desc: '', progress: null, compact: false, overlay: false, tech: false },
)

const { t } = useI18n()
/** 未传标题时使用当前语言的“加载中” */
const titleText = computed(() => props.title || t('common.loading'))
</script>

<template>
  <div
    class="gis-load"
    :class="[overlay && 'gis-overlay', compact && 'gis-load--compact', tech && 'gis-load--tech']"
  >
    <div v-if="tech" class="gis-radar gis-radar--tech">
      <span class="gis-radar__ring"></span>
      <span class="gis-radar__ring"></span>
      <span class="gis-radar__ring"></span>
      <span class="gis-radar__sweep"></span>
      <span class="gis-radar__ripple"></span>
      <span class="gis-radar__orbit"></span>
      <span class="gis-radar__core"></span>
    </div>
    <div v-else class="gis-radar" />

    <div class="gis-load__title">
      {{ titleText }}
      <span class="gis-dots"><i></i><i></i><i></i></span>
    </div>

    <div v-if="desc" class="gis-load__desc">{{ desc }}</div>

    <div v-if="progress === null" class="gis-load__bar"><span></span></div>
    <template v-else>
      <div class="gis-load__bar is-determinate">
        <span :style="{ width: `${Math.max(3, Math.min(100, progress))}%` }"></span>
      </div>
      <div class="gis-load__pct">{{ Math.round(progress) }}%</div>
    </template>
  </div>
</template>
