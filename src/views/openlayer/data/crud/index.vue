<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadOl } from '@/utils/gis/olLoader'
import { createDemoMap } from '@/utils/gis/olDemo'

const drawType = ref('Point')
const editable = ref(false)
const nameInput = ref('')
const names = ref<string[]>([])
const count = ref(0)
const selected = shallowRef<any>(null)

let map: any = null
let ol: any = null
let source: any = null
let draw: any = null
let modify: any = null
let select: any = null

function refresh() {
  const features = source.getFeatures()
  count.value = features.length
  names.value = features.map((f: any) => String(f.get('name') ?? '未命名')).slice(0, 10)
}

function setType(type: any) {
  drawType.value = type
  if (!map || !ol) return
  map.removeInteraction(draw)
  draw = new ol.Draw({ source, type })
  draw.on('drawend', (e: any) => {
    e.feature.set('name', `要素 ${source.getFeatures().length + 1}`)
  })
  map.addInteraction(draw)
}

function toggleModify(value: any) {
  editable.value = Boolean(value)
  modify?.setActive(editable.value)
}

function updateName() {
  if (!selected.value || !nameInput.value) return
  selected.value.set('name', nameInput.value)
  source.changed()
  refresh()
}

function removeSelected() {
  if (!selected.value) return
  source.removeFeature(selected.value)
  selected.value = null
  nameInput.value = ''
  refresh()
}

function clearAll() {
  source.clear()
  selected.value = null
  nameInput.value = ''
  refresh()
}

async function init(lib: any, el: HTMLElement) {
  ol = lib
  const { VectorSource, VectorLayer, Style, Fill, Stroke, CircleStyle, Draw, Modify, Select } = lib

  source = new VectorSource()
  source.on('addfeature', refresh)
  source.on('removefeature', refresh)

  const layer = new VectorLayer({
    source,
    style: new Style({
      fill: new Fill({ color: 'rgba(34,211,238,0.25)' }),
      stroke: new Stroke({ color: '#22d3ee', width: 2 }),
      image: new CircleStyle({
        radius: 7,
        fill: new Fill({ color: '#f97316' }),
        stroke: new Stroke({ color: '#fff', width: 2 }),
      }),
    }),
  })

  map = createDemoMap(lib, el, { center: [116.407, 39.904], zoom: 11, base: 'light', layers: [layer] })

  select = new Select()
  select.on('select', (e: any) => {
    const feature = e.selected[0]
    selected.value = feature ?? null
    nameInput.value = feature ? String(feature.get('name') ?? '') : ''
  })
  map.addInteraction(select)

  modify = new Modify({ source })
  modify.setActive(false)
  map.addInteraction(modify)

  draw = new Draw({ source, type: drawType.value })
  draw.on('drawend', (e: any) => {
    e.feature.set('name', `要素 ${source.getFeatures().length + 1}`)
  })
  map.addInteraction(draw)

  refresh()
  return () => {
    map?.setTarget(null)
    map = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">数据增删改查：Draw 新增、Select 选中、Modify 拖拽改几何、set 改属性、removeFeature 删除</p>
    <div class="flex flex-wrap items-center gap-2">
      <el-radio-group v-model="drawType" size="small" @change="setType as any">
        <el-radio-button value="Point">点</el-radio-button>
        <el-radio-button value="LineString">线</el-radio-button>
        <el-radio-button value="Polygon">面</el-radio-button>
      </el-radio-group>
      <el-checkbox v-model="editable" size="small" @change="toggleModify as any">编辑几何</el-checkbox>
      <el-input v-model="nameInput" size="small" class="max-w-36" placeholder="要素名称" :disabled="!selected" />
      <el-button size="small" type="primary" :disabled="!selected" @click="updateName">更新</el-button>
      <el-button size="small" type="danger" :disabled="!selected" @click="removeSelected">删除选中</el-button>
      <el-button size="small" @click="clearAll">清空</el-button>
      <el-tag size="small" effect="plain">共 {{ count }} 个要素</el-tag>
    </div>
    <div v-if="names.length" class="flex flex-wrap gap-1">
      <el-tag v-for="n in names" :key="n" size="small" type="info" effect="plain">{{ n }}</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadOl" :init="init" />
  </div>
</template>
