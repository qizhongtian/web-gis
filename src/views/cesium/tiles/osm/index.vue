<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import DemoBox from '@/components/DemoBox.vue'
import { loadCesium } from '@/utils/gis/cesiumLoader'
import { createViewer } from '@/utils/gis/cesiumInit'

const token = ref(localStorage.getItem('wg-cesium-token') || '')
let C: any = null
let viewer: any = null

async function init(Cesium: any, el: HTMLElement) {
  C = Cesium
  viewer = createViewer(Cesium, el)
  Cesium.Ion.defaultAccessToken = token.value
  if (token.value) {
    // OSM 建筑物 3D Tiles（Cesium ion 公共资产，需 token）
    const tileset = await Cesium.createOsmBuildingsAsync()
    viewer.scene.primitives.add(tileset)
    viewer.zoomTo(tileset)
  }
  return () => {
    viewer.destroy()
    viewer = null
  }
}

function applyToken() {
  if (!token.value) return ElMessage.warning('请输入 Cesium ion Token')
  localStorage.setItem('wg-cesium-token', token.value)
  location.reload()
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      3D Tiles：加载 Cesium ion 的 OSM 建筑物。示例使用
      <code>createOsmBuildingsAsync</code>，需在
      <a class="text-[#2563eb] underline" href="https://cesium.com/ion/" target="_blank">ion</a> 申请免费 Token
    </p>
    <div class="flex items-center gap-2">
      <el-input v-model="token" size="small" class="!w-96" placeholder="Cesium ion Token（保存在 localStorage）" />
      <el-button size="small" type="primary" @click="applyToken">应用并刷新</el-button>
    </div>
    <DemoBox class="flex-1" :loader="loadCesium" :init="init" />
  </div>
</template>
