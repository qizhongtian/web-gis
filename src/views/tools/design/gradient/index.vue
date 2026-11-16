<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ToolPage from '@/components/tools/ToolPage.vue'
import { randomHex } from '@/utils/tools/color'
import { copyText } from '@/utils/tools/file'

interface Stop {
  color: string
  pos: number
}

const type = ref<'linear' | 'radial' | 'conic'>('linear')
const angle = ref(135)
const shape = ref<'circle' | 'ellipse'>('circle')
const position = ref('center')
const stops = ref<Stop[]>([
  { color: '#2563eb', pos: 0 },
  { color: '#7c3aed', pos: 55 },
  { color: '#db2777', pos: 100 },
])
const copiedKey = ref('')

const POSITIONS = ['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right']

const PRESETS: { name: string; type: 'linear' | 'radial' | 'conic'; angle: number; stops: Stop[] }[] = [
  { name: '日落', type: 'linear', angle: 120, stops: [{ color: '#ff7e5f', pos: 0 }, { color: '#feb47b', pos: 100 }] },
  { name: '深海', type: 'linear', angle: 135, stops: [{ color: '#2b5876', pos: 0 }, { color: '#4e4376', pos: 100 }] },
  { name: '极光', type: 'linear', angle: 160, stops: [{ color: '#00c9ff', pos: 0 }, { color: '#92fe9d', pos: 100 }] },
  { name: '薄荷', type: 'linear', angle: 135, stops: [{ color: '#43e97b', pos: 0 }, { color: '#38f9d7', pos: 100 }] },
  { name: '蜜桃', type: 'linear', angle: 120, stops: [{ color: '#ffecd2', pos: 0 }, { color: '#fcb69f', pos: 100 }] },
  { name: '午夜', type: 'linear', angle: 145, stops: [{ color: '#232526', pos: 0 }, { color: '#414345', pos: 100 }] },
  { name: '糖果', type: 'linear', angle: 90, stops: [{ color: '#f093fb', pos: 0 }, { color: '#f5576c', pos: 100 }] },
  { name: '烈焰', type: 'linear', angle: 90, stops: [{ color: '#f83600', pos: 0 }, { color: '#f9d423', pos: 100 }] },
  { name: '天空', type: 'linear', angle: 180, stops: [{ color: '#2193b0', pos: 0 }, { color: '#6dd5ed', pos: 100 }] },
  { name: '霓虹球', type: 'radial', angle: 0, stops: [{ color: '#7c3aed', pos: 0 }, { color: '#0f172a', pos: 100 }] },
  { name: '彩色锥', type: 'conic', angle: 0, stops: [{ color: '#f87171', pos: 0 }, { color: '#fbbf24', pos: 25 }, { color: '#34d399', pos: 50 }, { color: '#60a5fa', pos: 75 }, { color: '#f87171', pos: 100 }] },
]

const sortedStops = computed(() => [...stops.value].sort((a, b) => a.pos - b.pos))

const css = computed(() => {
  const list = sortedStops.value.map((s) => `${s.color} ${s.pos}%`).join(', ')
  if (type.value === 'linear') return `linear-gradient(${angle.value}deg, ${list})`
  if (type.value === 'radial') return `radial-gradient(${shape.value} at ${position.value}, ${list})`
  return `conic-gradient(from ${angle.value}deg at ${position.value}, ${list})`
})

const tailwind = computed(() => `bg-[${css.value.replace(/\s+/g, '_')}]`)
const backgroundCss = computed(() => `background: ${css.value};`)

function addStop() {
  if (stops.value.length >= 8) return ElMessage.warning('最多 8 个色标')
  const last = sortedStops.value[sortedStops.value.length - 1]
  stops.value.push({ color: randomHex(), pos: Math.min(95, (last?.pos ?? 50) + 10) })
}

function removeStop(index: number) {
  if (stops.value.length <= 2) return ElMessage.warning('至少保留 2 个色标')
  stops.value.splice(index, 1)
}

function randomize() {
  stops.value = [
    { color: randomHex(), pos: 0 },
    { color: randomHex(), pos: Math.round(40 + Math.random() * 20) },
    { color: randomHex(), pos: 100 },
  ]
  angle.value = Math.floor(Math.random() * 360)
}

function applyPreset(p: (typeof PRESETS)[number]) {
  type.value = p.type
  angle.value = p.angle
  stops.value = p.stops.map((s) => ({ ...s }))
}

async function copy(value: string, key: string) {
  if (await copyText(value)) {
    copiedKey.value = key
    ElMessage.success('已复制')
    window.setTimeout(() => (copiedKey.value = ''), 1500)
  } else ElMessage.error('复制失败')
}
</script>

<template>
  <ToolPage title="渐变生成" desc="线性 / 径向 / 锥形渐变可视化编辑，实时输出 CSS 与 Tailwind 类名" wide>
    <template #actions>
      <el-button size="small" @click="randomize">随机渐变</el-button>
      <el-button size="small" type="primary" @click="copy(backgroundCss, 'css')">
        {{ copiedKey === 'css' ? '已复制' : '复制 CSS' }}
      </el-button>
    </template>

    <div class="grid gap-3 lg:grid-cols-[400px_1fr]">
      <section class="app-panel p-3 space-y-3">
        <div>
          <div class="pb-1.5 text-[11.5px] text-[#6b7280]">渐变类型</div>
          <el-radio-group v-model="type" size="small">
            <el-radio-button value="linear">线性</el-radio-button>
            <el-radio-button value="radial">径向</el-radio-button>
            <el-radio-button value="conic">锥形</el-radio-button>
          </el-radio-group>
        </div>

        <div v-if="type !== 'radial'">
          <div class="flex items-center justify-between pb-1 text-[11.5px] text-[#6b7280]">
            <span>{{ type === 'linear' ? '角度' : '起始角度' }}</span>
            <span class="font-mono">{{ angle }}°</span>
          </div>
          <el-slider v-model="angle" :min="0" :max="360" size="small" />
        </div>

        <div v-if="type === 'radial'" class="grid grid-cols-2 gap-2">
          <div>
            <div class="pb-1.5 text-[11.5px] text-[#6b7280]">形状</div>
            <el-select v-model="shape" size="small">
              <el-option label="圆形 circle" value="circle" />
              <el-option label="椭圆 ellipse" value="ellipse" />
            </el-select>
          </div>
          <div>
            <div class="pb-1.5 text-[11.5px] text-[#6b7280]">中心位置</div>
            <el-select v-model="position" size="small">
              <el-option v-for="p in POSITIONS" :key="p" :label="p" :value="p" />
            </el-select>
          </div>
        </div>

        <div v-if="type === 'conic'">
          <div class="pb-1.5 text-[11.5px] text-[#6b7280]">中心位置</div>
          <el-select v-model="position" size="small">
            <el-option v-for="p in POSITIONS" :key="p" :label="p" :value="p" />
          </el-select>
        </div>

        <div>
          <div class="flex items-center gap-2 pb-1.5">
            <span class="text-[11.5px] text-[#6b7280]">色标（{{ stops.length }}）</span>
            <el-button size="small" text class="ml-auto" @click="addStop">+ 添加色标</el-button>
          </div>
          <div class="space-y-2">
            <div v-for="(stop, i) in stops" :key="i" class="flex items-center gap-2">
              <el-color-picker v-model="stop.color" size="small" />
              <code class="w-[72px] shrink-0 text-[11px] text-[#6b7280]">{{ stop.color }}</code>
              <el-slider v-model="stop.pos" :min="0" :max="100" size="small" class="flex-1" />
              <el-input-number v-model="stop.pos" :min="0" :max="100" :step="1" size="small" controls-position="right" style="width: 74px" />
              <button type="button" class="del-btn" title="删除色标" @click="removeStop(i)">×</button>
            </div>
          </div>
        </div>
      </section>

      <div class="space-y-3">
        <section class="app-panel p-3">
          <div class="flex items-center gap-2 pb-2">
            <span class="text-[12.5px] font-medium text-[#374151]">预览</span>
            <span class="ml-auto text-[11px] text-[#9ca3af]">{{ sortedStops.length }} 个色标</span>
          </div>
          <div class="h-[280px] rounded-xl border border-[#eef0f3]" :style="{ backgroundImage: css }" />
        </section>

        <section class="app-panel p-3 space-y-2">
          <div class="flex items-center gap-2">
            <span class="text-[12.5px] font-medium text-[#374151]">CSS</span>
            <button type="button" class="copy-btn ml-auto" @click="copy(backgroundCss, 'css')">
              {{ copiedKey === 'css' ? '已复制' : '复制' }}
            </button>
          </div>
          <pre class="code-block">{{ backgroundCss }}</pre>

          <div class="flex items-center gap-2 pt-1">
            <span class="text-[12.5px] font-medium text-[#374151]">Tailwind 任意值</span>
            <button type="button" class="copy-btn ml-auto" @click="copy(tailwind, 'tw')">
              {{ copiedKey === 'tw' ? '已复制' : '复制' }}
            </button>
          </div>
          <pre class="code-block">{{ tailwind }}</pre>
        </section>

        <section class="app-panel p-3">
          <div class="pb-2 text-[12.5px] font-medium text-[#374151]">预设</div>
          <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <button
              v-for="p in PRESETS"
              :key="p.name"
              type="button"
              class="group overflow-hidden rounded-lg border border-[#eef0f3] bg-white text-left transition hover:border-[#c7d7fb] hover:shadow-sm"
              @click="applyPreset(p)"
            >
              <span
                class="block h-12 w-full"
                :style="{
                  backgroundImage:
                    p.type === 'linear'
                      ? `linear-gradient(${p.angle}deg, ${p.stops.map((s) => `${s.color} ${s.pos}%`).join(', ')})`
                      : p.type === 'radial'
                        ? `radial-gradient(circle at center, ${p.stops.map((s) => `${s.color} ${s.pos}%`).join(', ')})`
                        : `conic-gradient(from ${p.angle}deg at center, ${p.stops.map((s) => `${s.color} ${s.pos}%`).join(', ')})`,
                }"
              />
              <span class="block px-2 py-1 text-[11px] text-[#4b5563] group-hover:text-[#2563eb]">{{ p.name }}</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  </ToolPage>
</template>

<style scoped>
.code-block {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: #0b1623;
  color: #cbd5e1;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}
.copy-btn {
  padding: 1px 7px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #9ca3af;
  font-size: 11px;
  cursor: pointer;
}
.copy-btn:hover {
  background: #eef4ff;
  color: #2563eb;
}
.del-btn {
  flex: none;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #b0b7c3;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.del-btn:hover {
  background: #fdeeee;
  color: #dc2626;
}
</style>
