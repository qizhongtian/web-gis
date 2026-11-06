import { inject, onScopeDispose, watch, type InjectionKey, type ShallowRef } from 'vue'

/**
 * Cesium 实例类型（CDN 动态加载，无 npm 类型，这里用宽松类型）
 * 如需严格类型，可安装 `cesium` 依赖后改为 `import type { Viewer } from 'cesium'`
 */
export type CesiumViewerInstance = any
export type CesiumLib = any

/** <CesiumViewer> 通过 provide 向下暴露，勿直接使用 */
export const CESIUM_VIEWER_KEY: InjectionKey<ShallowRef<CesiumViewerInstance | undefined>> = Symbol('cesium-viewer')
export const CESIUM_LIB_KEY: InjectionKey<ShallowRef<CesiumLib | undefined>> = Symbol('cesium-lib')

/**
 * 获取 Cesium Viewer 实例（响应式）
 * 只能在 <CesiumViewer> 的后代组件中使用。
 *
 * ```ts
 * const viewer = useCesium()
 * watch(viewer, (v) => v && v.camera.flyTo(...), { immediate: true })
 * ```
 * 注意：Viewer 异步创建，务必判空或用 onCesiumReady。
 */
export function useCesium(): ShallowRef<CesiumViewerInstance | undefined> {
  const viewer = inject(CESIUM_VIEWER_KEY, null)
  if (!viewer) {
    throw new Error('[useCesium] 必须在 <CesiumViewer> 的子孙组件中调用')
  }
  return viewer as ShallowRef<CesiumViewerInstance | undefined>
}

/** 可选版本：不在 <CesiumViewer> 内时返回 null，便于组件既可独立使用也可嵌套使用 */
export function useCesiumOptional(): ShallowRef<CesiumViewerInstance | undefined> | null {
  return inject(CESIUM_VIEWER_KEY, null) as ShallowRef<CesiumViewerInstance | undefined> | null
}

/** 获取 Cesium 命名空间（Viewer 创建完成后才有值） */
export function useCesiumLib(): ShallowRef<CesiumLib | undefined> {
  const lib = inject(CESIUM_LIB_KEY, null)
  if (!lib) {
    throw new Error('[useCesiumLib] 必须在 <CesiumViewer> 的子孙组件中调用')
  }
  return lib as ShallowRef<CesiumLib | undefined>
}

/**
 * Viewer 就绪后执行回调，回调可返回清理函数；组件卸载 / Viewer 销毁时自动执行清理。
 * 避免子组件自己写 watch + 清理逻辑而漏掉事件解绑。
 *
 * ```ts
 * onCesiumReady((viewer) => {
 *   const handler = () => {...}
 *   viewer.camera.changed.addEventListener(handler)
 *   return () => viewer.camera.changed.removeEventListener(handler)
 * })
 * ```
 */
export function onCesiumReady(cb: (viewer: CesiumViewerInstance, lib: CesiumLib) => void | (() => void)) {
  const viewer = useCesium()
  const lib = useCesiumLib()
  let cleanup: void | (() => void)

  const stop = watch(
    [viewer, lib],
    ([v, c]) => {
      if (typeof cleanup === 'function') {
        cleanup()
        cleanup = undefined
      }
      if (v && c) cleanup = cb(v, c)
    },
    { immediate: true, flush: 'post' },
  )

  onScopeDispose(() => {
    stop()
    if (typeof cleanup === 'function') cleanup()
  })
}
