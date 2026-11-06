<script setup lang="ts">
// computed / useCesium / useCesiumLib 均由 unplugin-auto-import 自动引入，无需手写 import
const viewer = useCesium()
const Cesium = useCesiumLib()

const ready = computed(() => !!viewer.value)

function flyHome() {
  const v = viewer.value
  const C = Cesium.value
  if (!v || !C || v.isDestroyed?.()) return
  v.camera.flyTo({
    destination: C.Cartesian3.fromDegrees(116.407, 39.904, 2_000_000),
    duration: 1.6,
  })
}
</script>

<template>
  <div class="absolute top-3 left-3 z-10 flex items-center gap-2">
    <el-button size="small" :disabled="!ready" @click="flyHome">飞到北京</el-button>
    <span class="text-[11px] text-white/80 bg-black/45 px-2 py-1 rounded">子组件 useCesium()</span>
  </div>
</template>
