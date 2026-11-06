import { ref } from 'vue'

export type SceneModeKey = '3D' | '2D' | 'CV'

/**
 * 场景控制：二维/三维切换、地下模式
 * 所有副作用都在 onCesiumReady 的清理函数中还原，避免污染下一个页面
 */
export function useCesiumScene() {
  const mode = ref<SceneModeKey>('3D')
  const underground = ref(false)
  let viewer: any = null
  let Cesium: any = null

  function syncMode() {
    if (!viewer || !Cesium) return
    const m = viewer.scene.mode
    mode.value = m === Cesium.SceneMode.SCENE2D ? '2D' : m === Cesium.SceneMode.COLUMBUS_VIEW ? 'CV' : '3D'
  }

  function applyUnderground(on: boolean) {
    if (!viewer) return
    const scene = viewer.scene
    const globe = scene.globe
    globe.translucency.enabled = on
    globe.translucency.frontFaceAlpha = on ? 0.45 : 1
    globe.translucency.backFaceAlpha = on ? 0.25 : 1
    scene.screenSpaceCameraController.enableCollisionDetection = !on
    underground.value = on
  }

  onCesiumReady((v, C) => {
    viewer = v
    Cesium = C
    const onMorphComplete = () => syncMode()
    v.scene.morphComplete.addEventListener(onMorphComplete)
    syncMode()

    return () => {
      if (v.isDestroyed?.()) return
      v.scene.morphComplete.removeEventListener(onMorphComplete)
      applyUnderground(false)
      viewer = null
      Cesium = null
    }
  })

  /** 切换场景模式（动画时长 0.8s） */
  function morph(target: SceneModeKey) {
    if (!viewer) return
    const scene = viewer.scene
    if (target === '2D') scene.morphTo2D(0.8)
    else if (target === 'CV') scene.morphToColumbusView(0.8)
    else scene.morphTo3D(0.8)
  }

  function toggleUnderground(value?: boolean) {
    applyUnderground(value ?? !underground.value)
  }

  return { mode, underground, morph, toggleUnderground }
}
