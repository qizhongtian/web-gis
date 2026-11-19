/**
 * Three.js 最小舞台封装：场景 / 相机 / 渲染器 / 尺寸监听 / 渲染循环 / 统一释放
 *
 * 示例页只关心「建什么物体、每帧改什么」，重复样板收在这里：
 * - setPixelRatio 上限 2：Retina 屏按物理像素渲染，像素量翻 4 倍，必须封顶
 * - ResizeObserver 监听容器：面板折叠、窗口缩放都能正确适配
 * - onFrame 回调吃 clock 的 delta（秒）：动画速度与帧率解耦，60Hz / 120Hz 表现一致
 * - dispose 里遍历场景释放 geometry / material / texture，避免 WebGL 资源泄漏
 */
import { loadThreeAddon } from './threeLoader'

export interface StageOptions {
  /** 视场角，默认 50 */
  fov?: number
  near?: number
  far?: number
  /** 相机初始位置，默认 [4, 3, 6] */
  position?: [number, number, number]
  /** 相机注视点，默认原点 */
  lookAt?: [number, number, number]
  /** 画布是否透明（不设背景色时有效），默认 true */
  alpha?: boolean
  antialias?: boolean
  /** 场景背景色，不传则透明 */
  background?: string | number
  /** 像素比上限，默认 2 */
  maxPixelRatio?: number
}

type FrameFn = (dt: number, elapsed: number) => void
type ResizeFn = (width: number, height: number) => void

export interface Stage {
  THREE: any
  el: HTMLElement
  scene: any
  /** 当前相机：可用 setCamera 换成正交相机等 */
  camera: any
  renderer: any
  clock: any
  /** 每帧回调，返回取消函数 */
  onFrame(fn: FrameFn): () => void
  /** 尺寸变化回调，返回取消函数 */
  onResize(fn: ResizeFn): () => void
  setCamera(camera: any): void
  /** 替换默认的 renderer.render，用于后处理 composer.render */
  setRender(fn: (() => void) | null): void
  resize(): void
  dispose(): void
}

export function createStage(THREE: any, el: HTMLElement, options: StageOptions = {}): Stage {
  const width = () => Math.max(1, el.clientWidth)
  const height = () => Math.max(1, el.clientHeight)
  const {
    fov = 50,
    near = 0.1,
    far = 500,
    position = [4, 3, 6],
    lookAt = [0, 0, 0],
    alpha = true,
    antialias = true,
    background,
    maxPixelRatio = 2,
  } = options

  const renderer = new THREE.WebGLRenderer({ antialias, alpha })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio))
  renderer.setSize(width(), height())
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  el.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  if (background !== undefined) scene.background = new THREE.Color(background as any)

  let camera = new THREE.PerspectiveCamera(fov, width() / height(), near, far)
  camera.position.set(...position)
  camera.lookAt(...lookAt)

  const clock = new THREE.Clock()
  const frameCbs: FrameFn[] = []
  const resizeCbs: ResizeFn[] = []
  let raf = 0
  let alive = true
  let customRender: (() => void) | null = null

  const loop = () => {
    if (!alive) return
    raf = requestAnimationFrame(loop)
    const dt = clock.getDelta()
    for (const fn of frameCbs) fn(dt, clock.elapsedTime)
    if (customRender) customRender()
    else renderer.render(scene, camera)
  }
  raf = requestAnimationFrame(loop)

  const resize = () => {
    if (!alive) return
    const w = width()
    const h = height()
    renderer.setSize(w, h)
    if (camera.isPerspectiveCamera) {
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    for (const fn of resizeCbs) fn(w, h)
  }

  const observer = new ResizeObserver(resize)
  observer.observe(el)

  return {
    THREE,
    el,
    scene,
    get camera() {
      return camera
    },
    renderer,
    clock,
    onFrame(fn) {
      frameCbs.push(fn)
      return () => {
        const i = frameCbs.indexOf(fn)
        if (i > -1) frameCbs.splice(i, 1)
      }
    },
    onResize(fn) {
      resizeCbs.push(fn)
      return () => {
        const i = resizeCbs.indexOf(fn)
        if (i > -1) resizeCbs.splice(i, 1)
      }
    },
    setCamera(next) {
      camera = next
      resize()
    },
    setRender(fn) {
      customRender = fn
    },
    resize,
    dispose() {
      if (!alive) return
      alive = false
      cancelAnimationFrame(raf)
      observer.disconnect()
      frameCbs.length = 0
      resizeCbs.length = 0
      disposeObject(scene)
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

/** 递归释放几何体、材质与材质上挂的纹理 */
export function disposeObject(root: any) {
  root?.traverse?.((obj: any) => {
    obj.geometry?.dispose?.()
    const list = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : []
    for (const material of list) {
      for (const key of Object.keys(material)) {
        const value = material[key]
        if (value && value.isTexture) value.dispose()
      }
      material.dispose?.()
    }
  })
}

/**
 * 把相机摆到刚好框住物体的位置（模型尺寸千差万别，写死 position 必然翻车）
 * @returns 包围盒中心与尺寸，方便外层继续用
 */
export function frameObject(
  THREE: any,
  camera: any,
  object: any,
  options: { offset?: number; target?: any } = {},
) {
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const center = options.target ?? box.getCenter(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z) || 1
  const fov = camera.isPerspectiveCamera ? (camera.fov * Math.PI) / 180 : Math.PI / 4
  const fitHeight = maxDim / (2 * Math.tan(fov / 2))
  const fitWidth = fitHeight / (camera.aspect || 1)
  const dist = Math.max(fitHeight, fitWidth) * (options.offset ?? 1.9)

  const dir = new THREE.Vector3(0.65, 0.5, 0.85).normalize()
  camera.position.copy(center).add(dir.multiplyScalar(dist))
  if (camera.isPerspectiveCamera) {
    camera.near = Math.max(dist / 500, 0.01)
    camera.far = Math.max(dist * 200, 100)
    camera.updateProjectionMatrix()
  }
  camera.lookAt(center)
  return { center, size, distance: dist }
}

/**
 * 程序化环境光照（RoomEnvironment → PMREM）
 * PBR 材质的金属感来自环境反射，没有 HDR 资源时这是最轻量的替代方案
 * @returns 环境贴图，可用于 scene.environment 或 scene.background
 */
export async function createRoomEnvironment(THREE: any, renderer: any, scene: any, intensity = 1) {
  const { RoomEnvironment } = await loadThreeAddon('RoomEnvironment')
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envScene = new RoomEnvironment()
  const target = pmrem.fromScene(envScene, 0.04)
  scene.environment = target.texture
  scene.environmentIntensity = intensity
  pmrem.dispose()
  envScene.traverse?.((obj: any) => {
    obj.geometry?.dispose?.()
    obj.material?.dispose?.()
  })
  return target.texture
}

/** 生成一张程序化画布纹理（示例站不依赖外部图片，避免 404 与跨域） */
export function canvasTexture(
  THREE: any,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  size = 256,
  colorSpace = true,
) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  draw(ctx, size)
  const texture = new THREE.CanvasTexture(canvas)
  if (colorSpace) texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}
