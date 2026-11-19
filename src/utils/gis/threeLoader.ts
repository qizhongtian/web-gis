/**
 * Three.js 加载器：本地 npm 包，构建时单独分包，不依赖 CDN
 *
 * - loadThree：核心库（约 600KB，单独 chunk）
 * - loadThreeAddon：examples/jsm 下的扩展，按需动态 import，用到哪个才下载哪个
 *
 * 注意：动态 import 的路径必须是字面量，Vite 才能静态分析并分包；
 * 因此这里用显式映射表，而不是 import(`three/examples/jsm/${name}.js`)。
 */
let promise: Promise<any> | null = null

export function loadThree(): Promise<any> {
  if (promise) return promise
  promise = import('three')
  promise.catch(() => (promise = null))
  return promise
}

const ADDONS = {
  OrbitControls: () => import('three/examples/jsm/controls/OrbitControls.js'),
  GLTFLoader: () => import('three/examples/jsm/loaders/GLTFLoader.js'),
  FBXLoader: () => import('three/examples/jsm/loaders/FBXLoader.js'),
  RGBELoader: () => import('three/examples/jsm/loaders/RGBELoader.js'),
  EffectComposer: () => import('three/examples/jsm/postprocessing/EffectComposer.js'),
  RenderPass: () => import('three/examples/jsm/postprocessing/RenderPass.js'),
  UnrealBloomPass: () => import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
  ShaderPass: () => import('three/examples/jsm/postprocessing/ShaderPass.js'),
  OutputPass: () => import('three/examples/jsm/postprocessing/OutputPass.js'),
  RoomEnvironment: () => import('three/examples/jsm/environments/RoomEnvironment.js'),
  BufferGeometryUtils: () => import('three/examples/jsm/utils/BufferGeometryUtils.js'),
  ConvexGeometry: () => import('three/examples/jsm/geometries/ConvexGeometry.js'),
} as const

export type ThreeAddonName = keyof typeof ADDONS

const addonCache = new Map<ThreeAddonName, Promise<any>>()

/** 按需加载扩展模块，返回整个模块（用解构取具体导出） */
export function loadThreeAddon<K extends ThreeAddonName>(name: K): Promise<any> {
  const cached = addonCache.get(name)
  if (cached) return cached
  const task = ADDONS[name]()
  task.catch(() => addonCache.delete(name))
  addonCache.set(name, task)
  return task
}
