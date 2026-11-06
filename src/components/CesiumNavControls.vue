<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{ mode?: '3D' | '2D' | 'CV' }>(), { mode: '3D' })

const emit = defineEmits<{
  (e: 'zoom-in'): void
  (e: 'zoom-out'): void
  (e: 'reset'): void
  (e: 'morph', mode: '3D' | '2D' | 'CV'): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="nav-controls">
    <el-tooltip :content="t('cesium.zoomIn')" placement="left" :show-after="200">
      <button type="button" class="nav-btn" :aria-label="t('cesium.zoomIn')" @click="emit('zoom-in')">
        <svg viewBox="0 0 20 20" width="16" height="16" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round">
          <path d="M10 4.5v11M4.5 10h11" />
        </svg>
      </button>
    </el-tooltip>

    <el-tooltip :content="t('cesium.zoomOut')" placement="left" :show-after="200">
      <button type="button" class="nav-btn" :aria-label="t('cesium.zoomOut')" @click="emit('zoom-out')">
        <svg viewBox="0 0 20 20" width="16" height="16" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round">
          <path d="M4.5 10h11" />
        </svg>
      </button>
    </el-tooltip>

    <el-tooltip :content="t('cesium.resetView')" placement="left" :show-after="200">
      <button type="button" class="nav-btn" :aria-label="t('cesium.resetView')" @click="emit('reset')">
        <svg viewBox="0 0 20 20" width="16" height="16" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3.2 9.2 10 3.6l6.8 5.6" />
          <path d="M5 8.6V16h10V8.6" />
        </svg>
      </button>
    </el-tooltip>

    <el-tooltip :content="props.mode === '3D' ? t('cesium.to2d') : t('cesium.to3d')" placement="left" :show-after="200">
      <button
        type="button"
        class="nav-btn mode"
        :aria-label="props.mode === '3D' ? t('cesium.to2d') : t('cesium.to3d')"
        @click="emit('morph', props.mode === '3D' ? '2D' : '3D')"
      >
        <span>{{ props.mode }}</span>
      </button>
    </el-tooltip>
  </div>
</template>

<style scoped>
.nav-controls {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(6px);
}
.nav-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: none;
  background: transparent;
  color: #475569;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.nav-btn + .nav-btn {
  border-top: 1px solid rgba(226, 232, 240, 0.9);
}
.nav-btn:hover {
  background: #eef4ff;
  color: #2563eb;
}
.nav-btn.mode span {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
}
</style>
