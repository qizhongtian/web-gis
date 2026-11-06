/**
 * 生成一个完全本地的 3D Tiles 示例（3D Tiles 1.1 + glTF 内容）
 * 输入：public/data/models/Duck.glb
 * 输出：public/data/tiles/duck/tileset.json（与 Duck.glb 同目录）
 *
 * 说明：线上 3d-tiles-samples 示例已不可访问，这里用本地 glTF 组装一个最小 tileset，
 * 让 3D Tiles 示例页在不联网的情况下也能演示加载 / 定位 / 显隐 / 线框。
 */
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const SRC = path.join(root, 'public/data/models/Duck.glb')
const OUT_DIR = path.join(root, 'public/data/tiles/duck')

/* ---------------- glTF 解析：计算世界坐标 AABB ---------------- */
function parseGlb(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('不是有效的 GLB 文件')
  let offset = 12
  let json = null
  while (offset < buf.length) {
    const len = buf.readUInt32LE(offset)
    const type = buf.readUInt32LE(offset + 4)
    const data = buf.subarray(offset + 8, offset + 8 + len)
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'))
    offset += 8 + len + ((4 - (len % 4)) % 4) * 0
    offset += (4 - (offset % 4)) % 4
  }
  return json
}

function mul(a, b) {
  const out = new Array(16).fill(0)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
      out[c * 4 + r] = s
    }
  }
  return out
}

function trs(node) {
  if (node.matrix) return node.matrix.slice()
  const [tx, ty, tz] = node.translation ?? [0, 0, 0]
  const [qx, qy, qz, qw] = node.rotation ?? [0, 0, 0, 1]
  const [sx, sy, sz] = node.scale ?? [1, 1, 1]
  // 四元数 -> 3x3，再拼 4x4（列主序）
  const x2 = qx + qx
  const y2 = qy + qy
  const z2 = qz + qz
  const xx = qx * x2
  const xy = qx * y2
  const xz = qx * z2
  const yy = qy * y2
  const yz = qy * z2
  const zz = qz * z2
  const wx = qw * x2
  const wy = qw * y2
  const wz = qw * z2
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ]
}

function apply(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ]
}

function geometryBounds(gltf) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]

  const walk = (index, parent) => {
    const node = gltf.nodes?.[index]
    if (!node) return
    const world = mul(parent, trs(node))
    if (node.mesh !== undefined) {
      const mesh = gltf.meshes?.[node.mesh]
      for (const prim of mesh?.primitives ?? []) {
        const posIndex = prim.attributes?.POSITION
        const acc = gltf.accessors?.[posIndex]
        if (!acc?.min || !acc?.max) continue
        // 8 个角点做变换
        for (let i = 0; i < 8; i++) {
          const corner = [
            i & 1 ? acc.max[0] : acc.min[0],
            i & 2 ? acc.max[1] : acc.min[1],
            i & 4 ? acc.max[2] : acc.min[2],
          ]
          const p = apply(world, corner)
          for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], p[k])
            max[k] = Math.max(max[k], p[k])
          }
        }
      }
    }
    for (const child of node.children ?? []) walk(child, world)
  }

  const scene = gltf.scenes?.[gltf.scene ?? 0]
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  for (const nodeIndex of scene?.nodes ?? []) walk(nodeIndex, identity)
  return { min, max }
}

/* ---------------- 位置：香港中环附近 ---------------- */
const lon = 114.1694
const lat = 22.3193
const height = 0
const TARGET_SIZE = 90 // 目标最大尺寸（米）

function ecef(lonDeg, latDeg, h) {
  const a = 6378137
  const f = 1 / 298.257223563
  const e2 = f * (2 - f)
  const rad = Math.PI / 180
  const lonR = lonDeg * rad
  const latR = latDeg * rad
  const N = a / Math.sqrt(1 - e2 * Math.sin(latR) ** 2)
  return [
    (N + h) * Math.cos(latR) * Math.cos(lonR),
    (N + h) * Math.cos(latR) * Math.sin(lonR),
    (N * (1 - e2) + h) * Math.sin(latR),
  ]
}

const buf = await readFile(SRC)
const gltf = parseGlb(buf)
const { min, max } = geometryBounds(gltf)

const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
const center = [(max[0] + min[0]) / 2, (max[1] + min[1]) / 2, (max[2] + min[2]) / 2]
const maxDim = Math.max(...size)
const scale = TARGET_SIZE / maxDim

// glTF 是 Y-Up，Cesium 载入 glTF 内容时会转成 Z-Up：(x, y, z) -> (x, -z, y)
// boundingVolume 定义在 tile 局部坐标系（transform 之前），内容同样会被 transform 的缩放放大，
// 因此 box 必须使用「未缩放」的局部尺寸，否则会二次缩放，导致 boundingSphere 虚大、zoomTo 飞太远。
const boxCenter = [0, 0, (center[1] - min[1]) * 1]
const half = [size[0] / 2, size[2] / 2, size[1] / 2]

const rad = Math.PI / 180
const lonR = lon * rad
const latR = lat * rad
const east = [-Math.sin(lonR), Math.cos(lonR), 0]
const north = [-Math.sin(latR) * Math.cos(lonR), -Math.sin(latR) * Math.sin(lonR), Math.cos(latR)]
const up = [Math.cos(latR) * Math.cos(lonR), Math.cos(latR) * Math.sin(lonR), Math.sin(latR)]
const origin = ecef(lon, lat, height)
const s = scale

// 局部偏移：水平居中（x / -z）+ 底部落到地面（y = min），保证模型不悬空
const shift = [center[0], -center[2], min[1]]
const tx = origin[0] - s * (east[0] * shift[0] + north[0] * shift[1] + up[0] * shift[2])
const ty = origin[1] - s * (east[1] * shift[0] + north[1] * shift[1] + up[1] * shift[2])
const tz = origin[2] - s * (east[2] * shift[0] + north[2] * shift[1] + up[2] * shift[2])

const transform = [
  east[0] * s, east[1] * s, east[2] * s, 0,
  north[0] * s, north[1] * s, north[2] * s, 0,
  up[0] * s, up[1] * s, up[2] * s, 0,
  tx, ty, tz, 1,
]

const tileset = {
  asset: { version: '1.1', generator: 'web-gis local sample (Duck.glb)' },
  geometricError: TARGET_SIZE,
  root: {
    transform,
    boundingVolume: {
      box: [boxCenter[0], boxCenter[1], boxCenter[2], half[0], 0, 0, 0, half[1], 0, 0, 0, half[2]],
    },
    geometricError: 0,
    refine: 'ADD',
    content: { uri: 'Duck.glb' },
  },
}

await mkdir(OUT_DIR, { recursive: true })
await copyFile(SRC, path.join(OUT_DIR, 'Duck.glb'))
await writeFile(path.join(OUT_DIR, 'tileset.json'), JSON.stringify(tileset, null, 2), 'utf8')

console.log(
  `[tileset] 原始尺寸 ${size.map((n) => n.toFixed(2)).join(' × ')}，缩放 ${scale.toFixed(3)}，输出 ${path.relative(root, OUT_DIR)}`,
)
