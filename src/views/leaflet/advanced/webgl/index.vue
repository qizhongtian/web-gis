<script setup lang="ts">
import { ref } from 'vue'
import DemoBox from '@/components/DemoBox.vue'
import { loadLeaflet } from '@/utils/gis/leafletLoader'
import { createDemoMap, hasWebGL, randomPoints } from '@/utils/gis/leafletDemo'

const pointCount = ref(30000)
const pointSize = ref(2)
const mode = ref('WebGL')
const cost = ref(0)

let map: any = null
let L: any = null
let layer: any = null
let points: [number, number][] = []

const VS = `
attribute vec2 a_pos;
uniform vec2 u_res;
uniform float u_size;
void main() {
  vec2 clip = a_pos / u_res * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = u_size;
}`

const FS = `
precision mediump float;
uniform vec4 u_color;
void main() {
  gl_FragColor = u_color;
}`

function makeShader(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  return sh
}

/** 极简 WebGL 点图层：CPU 算屏幕坐标 → GPU 画点，5 万点仍是毫秒级 */
function createGlLayer(lib: any, data: [number, number][]) {
  const Layer = lib.Layer.extend({
    onAdd(this: any, m: any) {
      this._map = m
      const canvas = document.createElement('canvas')
      canvas.style.position = 'absolute'
      canvas.style.pointerEvents = 'none'
      this._canvas = canvas
      m.getPanes().overlayPane.appendChild(canvas)

      const gl = canvas.getContext('webgl', { antialias: false, alpha: true })
      this._gl = gl
      if (gl) {
        const prog = gl.createProgram()!
        gl.attachShader(prog, makeShader(gl, gl.VERTEX_SHADER, VS))
        gl.attachShader(prog, makeShader(gl, gl.FRAGMENT_SHADER, FS))
        gl.linkProgram(prog)
        gl.useProgram(prog)
        this._prog = prog
        this._buf = gl.createBuffer()
        this._locPos = gl.getAttribLocation(prog, 'a_pos')
        this._locRes = gl.getUniformLocation(prog, 'u_res')
        this._locSize = gl.getUniformLocation(prog, 'u_size')
        this._locColor = gl.getUniformLocation(prog, 'u_color')
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
      }

      m.on('moveend zoomend resize viewreset', this._reset, this)
      this._reset()
    },
    onRemove(this: any, m: any) {
      m.off('moveend zoomend resize viewreset', this._reset, this)
      this._canvas?.remove()
    },
    _reset(this: any) {
      const m = this._map
      const size = m.getSize()
      const canvas = this._canvas
      lib.DomUtil.setPosition(canvas, m.containerPointToLayerPoint([0, 0]))
      canvas.width = size.x
      canvas.height = size.y
      canvas.style.width = `${size.x}px`
      canvas.style.height = `${size.y}px`

      const t0 = performance.now()
      const gl = this._gl
      const pos = new Float32Array(data.length * 2)
      for (let i = 0; i < data.length; i++) {
        const p = m.latLngToContainerPoint(data[i])
        pos[i * 2] = p.x
        pos[i * 2 + 1] = p.y
      }

      if (!gl) {
        // 无 WebGL：降级为 2D 描点
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, size.x, size.y)
        ctx.fillStyle = 'rgba(34,211,238,.8)'
        for (let i = 0; i < data.length; i++) ctx.fillRect(pos[i * 2], pos[i * 2 + 1], 2, 2)
        mode.value = '2D 降级'
        cost.value = Number((performance.now() - t0).toFixed(1))
        return
      }

      gl.viewport(0, 0, size.x, size.y)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.bindBuffer(gl.ARRAY_BUFFER, this._buf)
      gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW)
      gl.enableVertexAttribArray(this._locPos)
      gl.vertexAttribPointer(this._locPos, 2, gl.FLOAT, false, 0, 0)
      gl.uniform2f(this._locRes, size.x, size.y)
      gl.uniform1f(this._locSize, pointSize.value)
      gl.uniform4f(this._locColor, 0.13, 0.83, 0.93, 0.85)
      gl.drawArrays(gl.POINTS, 0, data.length)
      mode.value = 'WebGL'
      cost.value = Number((performance.now() - t0).toFixed(1))
    },
  })
  return new Layer()
}

function rebuild() {
  if (!map) return
  if (layer) map.removeLayer(layer)
  points = randomPoints(pointCount.value, [116.05, 39.6, 116.8, 40.2], 20260101)
  layer = createGlLayer(L, points)
  layer.addTo(map)
}

async function init(lib: any, el: HTMLElement) {
  L = lib
  map = createDemoMap(lib, el, { center: [39.9, 116.42], zoom: 10, base: 'dark' })
  if (!hasWebGL()) mode.value = '无 WebGL'
  rebuild()
  return () => {
    map?.remove()
    map = null
    layer = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col p-2 gap-2">
    <p class="demo-hint">
      WebGL：点数据直接进 GPU 画 POINTS，CPU 只做一次屏幕坐标换算；无 WebGL 时自动降级为 2D 描点
    </p>
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-[12px] text-[#64748b]">点数 {{ pointCount }}</span>
      <el-slider class="max-w-40" :model-value="pointCount" :min="5000" :max="80000" :step="5000" size="small" @input="(v) => { pointCount = Number(v); rebuild() }" />
      <span class="text-[12px] text-[#64748b]">点大小 {{ pointSize }}</span>
      <el-slider class="max-w-24" :model-value="pointSize" :min="1" :max="6" :step="1" size="small" @input="(v) => { pointSize = Number(v); rebuild() }" />
      <el-tag size="small" effect="plain" type="success">{{ mode }} · {{ cost }}ms</el-tag>
    </div>
    <DemoBox class="flex-1" :loader="loadLeaflet" :init="init" />
  </div>
</template>
