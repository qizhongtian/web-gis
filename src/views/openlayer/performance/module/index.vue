<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { randomPoints } from '@/utils/gis/olDemo'
import { OlMapManager } from '@/utils/gis/olMapManager'

const layerCount = ref(0)
const featureCount = ref(0)

let manager: OlMapManager | null = null
let ol: any = null

function sync() {
  layerCount.value = manager?.size ?? 0
  const layer = manager?.getLayer('poi')
  featureCount.value = layer?.getSource().getFeatures().length ?? 0
}

function addPoints() {
  if (!manager || !ol) return
  manager.removeLayer('poi')
  manager.addVectorLayer(
    'poi',
    randomPoints(ol, 400, [116.1, 39.7, 116.7, 40.1], (i) => ({ name: `POI-${i + 1}` })),
    new ol.Style({
      image: new ol.CircleStyle({
        radius: 5,
        fill: new ol.Fill({ color: '#22d3ee' }),
        stroke: new ol.Stroke({ color: '#fff', width: 1.5 }),
      }),
    }),
  )
  sync()
}

function removeLayer() {
  manager?.removeLayer('poi')
  sync()
}

function clearLayers() {
  manager?.clearLayers()
  sync()
}

function fitAll() {
  manager?.fitAll()
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  manager = new OlMapManager(lib, el, { center: [116.4, 39.92], zoom: 10, base: 'light' })
  addPoints()
  return () => {
    manager?.destroy()
    manager = null
    sync()
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      模块化封装：OlMapManager 收敛地图创建、图层增删、范围缩放与销毁，业务组件只调用方法，便于替换引擎与复用
    </p>
    <div class="flex flex-wrap items-center gap-2">
      <el-button size="small" type="primary" @click="addPoints">添加点位图层</el-button>
      <el-button size="small" @click="removeLayer">移除点位图层</el-button>
      <el-button size="small" @click="fitAll">缩放到数据</el-button>
      <el-button size="small" @click="clearLayers">清空图层</el-button>
      <el-tag size="small" effect="plain">图层数 {{ layerCount }}</el-tag>
      <el-tag size="small" type="success" effect="plain">要素数 {{ featureCount }}</el-tag>
    </div>
    <el-tag class="w-fit max-w-full" size="small" type="info" effect="plain">
      src/utils/gis/olMapManager.ts · addVectorLayer / removeLayer / fitAll / destroy
    </el-tag>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
