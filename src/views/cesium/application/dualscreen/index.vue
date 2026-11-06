<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import CesiumViewer from '@/components/CesiumViewer.vue'
import CameraSync from './CameraSync.vue'

const HOME: [number, number, number] = [114.1694, 22.3193, 40000]

const left = shallowRef<any>()
const right = shallowRef<any>()
const linked = ref(true)
const right2D = ref(false)

function setLeft(viewer: any) {
  left.value = viewer
}

function setRight(viewer: any) {
  right.value = viewer
}

function toggleRightMode() {
  const v = right.value
  if (!v || v.isDestroyed?.()) return
  if (right2D.value) v.scene.morphTo3D(1)
  else v.scene.morphTo2D(1)
  right2D.value = !right2D.value
}
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-2 p-2">
    <div class="flex flex-wrap items-center gap-3">
      <p class="demo-hint !mb-0 flex-1">
        双屏联动：左屏为主视角，右屏通过 <b>camera.changed</b> 实时跟随；可关闭联动独立浏览，右屏支持二三维切换对比。
      </p>
      <label class="tool"><el-switch v-model="linked" size="small" /> 相机联动</label>
      <el-button size="small" plain @click="toggleRightMode">{{ right2D ? '右屏切换三维' : '右屏切换二维' }}</el-button>
    </div>

    <div class="flex-1 min-h-0 grid grid-cols-2 gap-2">
      <div class="relative min-h-0 rounded-lg overflow-hidden">
        <CesiumViewer class="h-full" :home="HOME" :status-bar="false" @ready="setLeft">
          <div class="pane-badge">主视角 · 3D</div>
        </CesiumViewer>
      </div>
      <div class="relative min-h-0 rounded-lg overflow-hidden">
        <CesiumViewer class="h-full" :home="HOME" :status-bar="false" @ready="setRight">
          <div class="pane-badge">{{ right2D ? '对比视角 · 2D' : '对比视角 · 3D' }}</div>
          <CameraSync :source="left" :enabled="linked" />
        </CesiumViewer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tool {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}
.pane-badge {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 10;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.62);
  color: #fff;
  font-size: 11px;
  letter-spacing: 0.02em;
  backdrop-filter: blur(4px);
}
</style>
