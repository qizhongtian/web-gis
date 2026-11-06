<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadCesium } from '@/utils/gis/cesiumLoader'
import { createViewer } from '@/utils/gis/cesiumInit'

/** 3D Tiles 加载速度优化常用手段：
 *  1. maximumScreenSpaceError（SSE）越大加载越快、越模糊
 *  2. tileCacheSize 缓存瓦片数
 *  3. requestRenderMode 按需渲染省电省 CPU
 *  4. dynamicScreenSpaceError / fog 雾化远处
 */
const sse = ref(16)
const cache = ref(512)
const requestRender = ref(false)
const token = ref(localStorage.getItem('wg-cesium-token') || '')

let C: any = null
let viewer: any = null
let tileset: any = null

function apply() {
  if (!viewer) return
  viewer.scene.globe.maximumScreenSpaceError = sse.value
  viewer.scene.globe.tileCacheSize = cache.value
  if (tileset) {
    tileset.maximumScreenSpaceError = sse.value
    tileset.tileCacheSize = cache.value
  }
}

function toggleRender(v: any) {
  viewer.scene.requestRenderMode = !!v
}

async function init(Cesium: any, el: HTMLElement) {
  C = Cesium
  viewer = createViewer(Cesium, el)
  Cesium.Ion.defaultAccessToken = token.value
  if (token.value) {
    try {
      tileset = await Cesium.createOsmBuildingsAsync()
      viewer.scene.primitives.add(tileset)
      viewer.zoomTo(tileset)
    } catch {
      /* token 无效时忽略 */
    }
  }
  apply()
  return () => {
    viewer.destroy()
    viewer = null
    tileset = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">3D Tiles(优化速度)：SSE / 缓存 / 按需渲染调优（配置对地形与 3D Tiles 同时生效）</p>
    <div class="flex items-center gap-4 flex-wrap">
      <span class="text-xs text-[#7c8db0]">SSE: {{ sse }}</span>
      <el-slider v-model="sse" :min="2" :max="64" :step="2" class="!w-40" @change="apply" />
      <span class="text-xs text-[#7c8db0]">缓存瓦片: {{ cache }}</span>
      <el-slider v-model="cache" :min="0" :max="2000" :step="100" class="!w-40" @change="apply" />
      <el-switch v-model="requestRender" active-text="按需渲染" @change="toggleRender" />
    </div>
    <DemoBox class="flex-1" :loader="loadCesium" :init="init" />
  </div>
</template>
