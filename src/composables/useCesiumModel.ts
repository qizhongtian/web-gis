import { reactive, ref } from 'vue'

export interface ModelOptions {
  lon: number
  lat: number
  height: number
  heading: number
  pitch: number
  roll: number
  scale: number
  minimumPixelSize: number
  silhouette: boolean
}

/**
 * glTF / GLB 模型加载（Entity model）
 * 使用 Entity 而非 Primitive：位置/朝向/样式都是响应式属性，卸载时随实体一并移除
 */
export function useCesiumModel() {
  const options = reactive<ModelOptions>({
    lon: 114.1694,
    lat: 22.3193,
    height: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    scale: 1,
    minimumPixelSize: 64,
    silhouette: false,
  })

  const loading = ref(false)
  const error = ref('')
  const loaded = ref(false)
  const url = ref('')

  let viewer: any = null
  let C: any = null
  let entity: any = null

  function applyTransform() {
    if (!entity || !C) return
    const e = entity as any
    const position = C.Cartesian3.fromDegrees(options.lon, options.lat, options.height)
    e.position = position
    e.orientation = C.Transforms.headingPitchRollQuaternion(
      position,
      new C.HeadingPitchRoll(
        C.Math.toRadians(options.heading),
        C.Math.toRadians(options.pitch),
        C.Math.toRadians(options.roll),
      ),
    )
    e.model.scale = options.scale
    e.model.minimumPixelSize = options.minimumPixelSize
    e.model.silhouetteColor = options.silhouette ? C.Color.fromCssColorString('#f59e0b') : undefined
    e.model.silhouetteSize = options.silhouette ? 2 : 0
  }

  function load(glbUrl: string) {
    if (!viewer || !glbUrl) return
    remove()
    url.value = glbUrl
    error.value = ''
    loading.value = true
    try {
      viewer.shadows = true
      entity = viewer.entities.add({
        position: C.Cartesian3.fromDegrees(options.lon, options.lat, options.height),
        model: {
          uri: glbUrl,
          scale: options.scale,
          minimumPixelSize: options.minimumPixelSize,
          shadows: C.ShadowMode.ENABLED,
          silhouetteColor: options.silhouette ? C.Color.fromCssColorString('#f59e0b') : undefined,
          silhouetteSize: options.silhouette ? 2 : 0,
        },
      })
      applyTransform()
      loaded.value = true
      loading.value = false
      // 固定斜俯视角 + 合适距离，避免 flyTo(entity) 在模型 ready 前取到过小的默认范围而贴脸
      viewer.flyTo(entity, {
        duration: 1.2,
        offset: new C.HeadingPitchRange(
          C.Math.toRadians(options.heading),
          C.Math.toRadians(-30),
          120,
        ),
      })
    } catch (e: any) {
      error.value = e?.message || '模型加载失败'
      loading.value = false
    }
  }

  function remove() {
    if (entity && viewer && !viewer.isDestroyed?.()) viewer.entities.remove(entity)
    entity = null
    loaded.value = false
    loading.value = false
  }

  function update(patch: Partial<ModelOptions> = {}) {
    Object.assign(options, patch)
    applyTransform()
  }

  onCesiumReady((v, lib) => {
    viewer = v
    C = lib
    return () => {
      remove()
      viewer = null
      C = null
    }
  })

  return { options, loading, error, loaded, url, load, remove, update }
}
