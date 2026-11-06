<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import CesiumOverlay from '@/components/CesiumOverlay.vue'
import { useCesiumDraw, type DrawMode } from '@/composables/useCesiumDraw'

const draw = useCesiumDraw()
const output = ref('')

const modes: { key: DrawMode; label: string }[] = [
  { key: 'point', label: '点' },
  { key: 'polyline', label: '线' },
  { key: 'polygon', label: '面' },
  { key: 'rectangle', label: '矩形' },
  { key: 'circle', label: '圆' },
]

watch(draw.count, () => {
  const geojson = draw.toGeoJSON()
  output.value = geojson.features.length ? JSON.stringify(geojson, null, 2) : ''
})

function start(mode: DrawMode) {
  if (draw.mode.value === mode) {
    draw.stop()
    return
  }
  draw.start(mode)
}

async function copy() {
  if (!output.value) return
  try {
    await navigator.clipboard.writeText(output.value)
    ElMessage.success('GeoJSON 已复制')
  } catch {
    ElMessage.warning('当前环境不支持剪贴板，请手动复制')
  }
}

function download() {
  if (!output.value) return
  const blob = new Blob([output.value], { type: 'application/geo+json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `draw-${Date.now()}.geojson`
  a.click()
  URL.revokeObjectURL(url)
}

function clearAll() {
  draw.clear()
  output.value = ''
}
</script>

<template>
  <CesiumOverlay title="绘制" class="absolute left-3 top-3 z-10" :width="292">
    <div class="flex flex-wrap items-center gap-2">
      <el-button
        v-for="m in modes"
        :key="m.key"
        size="small"
        :type="draw.mode.value === m.key ? 'primary' : 'default'"
        @click="start(m.key)"
      >
        {{ m.label }}
      </el-button>
    </div>

    <div class="flex items-center gap-2 mt-2">
      <el-button size="small" plain :disabled="draw.mode.value === ''" @click="draw.stop()">完成</el-button>
      <el-button size="small" plain :disabled="!draw.count.value" @click="draw.removeLast()">撤销</el-button>
      <el-button size="small" plain :disabled="!draw.count.value" @click="clearAll">清空</el-button>
    </div>

    <p class="tip">
      {{ draw.mode.value ? '在地图上左键绘制，双击 / 右键结束当前图形' : `已绘制 ${draw.count.value} 个图形` }}
    </p>

    <div class="output-head">
      <span>GeoJSON</span>
      <div class="flex gap-1">
        <el-button size="small" text type="primary" :disabled="!output" @click="copy">复制</el-button>
        <el-button size="small" text type="primary" :disabled="!output" @click="download">下载</el-button>
      </div>
    </div>
    <pre class="output">{{ output || '// 绘制后在此展示 GeoJSON' }}</pre>
  </CesiumOverlay>
</template>

<style scoped>
.tip {
  margin: 10px 0 4px;
  color: #9ca3af;
  font-size: 12px;
}
.output-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e6e8eb;
  font-size: 12px;
  color: #6b7280;
}
.output {
  margin: 6px 0 0;
  padding: 8px;
  max-height: 190px;
  overflow: auto;
  border-radius: 8px;
  background: #0f172a;
  color: #a5f3fc;
  font-size: 11px;
  line-height: 1.5;
  font-family: 'JetBrains Mono', Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
