/**
 * 同步本地静态资源（不依赖 CDN）
 *
 * - Cesium：复制 node_modules/cesium/Build/Cesium（Cesium.js / Workers / Assets / Widgets / ThirdParty）
 * - Leaflet：复制 leaflet.css 与配套 images（标注图标）
 * - OpenLayers：复制 ol.css
 *
 * 由 postinstall / predev / prebuild 自动调用；手动强制刷新：npm run sync:vendor -- --force
 */
import { cp, mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const force = process.argv.includes('--force')

const CESIUM_SRC = path.join(root, 'node_modules/cesium/Build/Cesium')
const CESIUM_DEST = path.join(root, 'public/cesium')
const VENDOR_DEST = path.join(root, 'public/vendor')

async function copyDir(src, dest) {
  if (!existsSync(src)) throw new Error(`源目录不存在：${src}，请先执行 npm install`)
  await mkdir(dest, { recursive: true })
  await cp(src, dest, { recursive: true, force: true })
}

async function copyFile(src, dest) {
  if (!existsSync(src)) throw new Error(`源文件不存在：${src}，请先执行 npm install`)
  await mkdir(path.dirname(dest), { recursive: true })
  await cp(src, dest, { force: true })
}

async function sizeOf(p) {
  try {
    const s = await stat(p)
    if (s.isFile()) return s.size
    let total = 0
    const { readdir } = await import('node:fs/promises')
    for (const entry of await readdir(p, { withFileTypes: true })) {
      total += await sizeOf(path.join(p, entry.name))
    }
    return total
  } catch {
    return 0
  }
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`

async function syncCesium() {
  if (!force && existsSync(path.join(CESIUM_DEST, 'Cesium.js'))) {
    console.log('[vendor] Cesium 已存在，跳过（--force 可强制覆盖）')
    return
  }
  await copyDir(CESIUM_SRC, CESIUM_DEST)
  console.log(`[vendor] Cesium -> public/cesium (${mb(await sizeOf(CESIUM_DEST))})`)
}

async function syncLeaflet() {
  await copyFile(
    path.join(root, 'node_modules/leaflet/dist/leaflet.css'),
    path.join(VENDOR_DEST, 'leaflet/leaflet.css'),
  )
  await copyDir(path.join(root, 'node_modules/leaflet/dist/images'), path.join(VENDOR_DEST, 'leaflet/images'))
  console.log('[vendor] Leaflet css/images -> public/vendor/leaflet')
}

async function syncOpenLayers() {
  await copyFile(path.join(root, 'node_modules/ol/ol.css'), path.join(VENDOR_DEST, 'ol/ol.css'))
  console.log('[vendor] OpenLayers css -> public/vendor/ol')
}

await syncCesium()
await syncLeaflet()
await syncOpenLayers()
console.log('[vendor] 静态资源同步完成')
