import type { Cartesian3, Cartographic, Cesium3DTileset, Scene, TerrainProvider } from 'cesium'

export type Cesium = typeof import('cesium')
export interface DemoPoint { id: number; lon: number; lat: number }
export interface SurfaceSample { height: number; source: 'tiles' | 'terrain' | 'ellipsoid' }
export const CENTER = { lon: 114.169329048385, lat: 22.319281819898 }
export const AUTO_LIMIT = 1000
// 示意点按公开城区位置播撒，并非真实设施或个人数据。
const OVERVIEW_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [114.158, 22.283], [114.185, 22.28], [114.2, 22.291], [114.155, 22.248],
  [114.172, 22.297], [114.187, 22.305], [114.226, 22.312], [114.26, 22.307],
  [114.113, 22.371], [114.188, 22.377], [114.168, 22.45], [114.032, 22.444],
  [113.976, 22.39], [113.945, 22.288], [114.273, 22.382], [114.107, 22.344],
]

export function pointHeightMode(terrainOn: boolean, tilesOn: boolean) {
  if (terrainOn && tilesOn) return 'CLAMP_TO_GROUND'
  if (tilesOn) return 'CLAMP_TO_3D_TILE'
  if (terrainOn) return 'CLAMP_TO_TERRAIN'
  return 'NONE'
}

export function makePoints(count: number): DemoPoint[] {
  let state = 83020
  const random = () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 2 ** 32)
  const points: DemoPoint[] = [{ id: 0, ...CENTER }]
  for (let id = 1; id < count; id++) {
    const anchor = OVERVIEW_ANCHORS[Math.floor(id / 2) % OVERVIEW_ANCHORS.length]
    const local = id % 2 === 0
    const lon = local ? CENTER.lon : anchor[0]
    const lat = local ? CENTER.lat : anchor[1]
    const radius = (local && id % 12 === 0 ? 0.00028 : 0.0038) * Math.sqrt(random())
    const angle = 2 * Math.PI * random()
    points.push({ id, lon: lon + radius * Math.cos(angle), lat: lat + radius * Math.sin(angle) })
  }
  return points
}

export function resolveSurface(terrain: number | undefined, tile: number | undefined): SurfaceSample {
  if (tile !== undefined && Number.isFinite(tile) && (!Number.isFinite(terrain) || tile >= (terrain as number))) {
    return { height: tile, source: 'tiles' }
  }
  if (terrain !== undefined && Number.isFinite(terrain)) return { height: terrain, source: 'terrain' }
  return { height: 0, source: 'ellipsoid' }
}

export async function sampleTerrainSlice(C: Cesium, terrain: TerrainProvider | undefined, cartos: Cartographic[]) {
  if (!terrain) return []
  // 服务提供 availability 时取最高细节，否则使用固定层级采样。
  const sampled = terrain.availability
    ? await C.sampleTerrainMostDetailed(terrain, cartos)
    : await C.sampleTerrain(terrain, 15, cartos)
  return sampled.map(c => c.height)
}

export function sampleTile(C: Cesium, tileset: Cesium3DTileset | undefined, scene: Scene, carto: Cartographic, scratch: Cartesian3, ray: InstanceType<Cesium['Ray']>) {
  if (!tileset) return undefined
  // 先做廉价的包围球检查，排除模型覆盖区以外的点，再查询已加载网格。
  C.Cartesian3.normalize(scene.globe.ellipsoid.cartographicToCartesian(carto, scratch), ray.direction)
  C.Cartesian3.multiplyByScalar(ray.direction, scene.globe.ellipsoid.maximumRadius * 2, ray.origin)
  C.Cartesian3.negate(ray.direction, ray.direction)
  return C.IntersectionTests.raySphere(ray, tileset.boundingSphere) ? tileset.getHeight(carto, scene) : undefined
}
