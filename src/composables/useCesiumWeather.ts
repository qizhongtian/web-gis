import { reactive } from 'vue'
import { getParticleTexture } from '@/utils/gis/textures'

export type WeatherKey = 'rain' | 'snow' | 'fog' | 'cloud' | 'lightning' | 'sand' | 'night'

export interface WeatherState {
  rain: boolean
  snow: boolean
  fog: boolean
  cloud: boolean
  lightning: boolean
  sand: boolean
  night: boolean
  /** 雨/雪强度 0.2 ~ 2 */
  intensity: number
  /** 雾浓度 0 ~ 0.005 */
  fogDensity: number
}

/**
 * 天气 / 环境特效：雨、雪、雾、云、闪电、沙尘、夜景
 * 粒子贴图由 canvas 运行时生成，粒子系统跟随相机，卸载时统一清理
 */
export function useCesiumWeather() {
  const state = reactive<WeatherState>({
    rain: false,
    snow: false,
    fog: false,
    cloud: false,
    lightning: false,
    sand: false,
    night: false,
    intensity: 1,
    fogDensity: 0.0008,
  })

  let viewer: any = null
  let C: any = null
  let preUpdate: any = null
  let lightningTimer: number | null = null

  /** weather key -> 粒子系统（雨/雪/云/沙尘） */
  const particles = new Map<WeatherKey, any>()

  const scene = () => viewer?.scene
  const cameraPosition = () => viewer.camera.positionWC

  function followCamera() {
    if (!viewer || viewer.isDestroyed?.()) return
    const modelMatrix = C.Transforms.eastNorthUpToFixedFrame(cameraPosition())
    particles.forEach((p) => {
      if (p && !p.isDestroyed?.()) p.modelMatrix = modelMatrix
    })
  }

  function buildParticles(key: WeatherKey) {
    const image = getParticleTexture(key === 'sand' ? 'sand' : key === 'cloud' ? 'cloud' : key === 'snow' ? 'snow' : 'rain')

    const common = {
      modelMatrix: C.Transforms.eastNorthUpToFixedFrame(cameraPosition()),
      emitter: new C.CylinderEmitter(key === 'cloud' ? 2600 : 380, key === 'cloud' ? 260 : 420),
      image,
      emissionRate: 0,
      lifetime: 16,
      startScale: 1,
      endScale: 1,
      minimumParticleLife: 4,
      maximumParticleLife: 9,
      minimumSpeed: 0,
      maximumSpeed: 0,
      sizeInMeters: false,
    }

    let options: any
    if (key === 'rain') {
      options = {
        ...common,
        emissionRate: 900 * state.intensity,
        startScale: 0.55,
        endScale: 0.9,
        startColor: new C.Color(0.72, 0.84, 1.0, 0.85),
        endColor: new C.Color(0.72, 0.84, 1.0, 0.15),
        emitterModelMatrix: C.Matrix4.fromTranslation(new C.Cartesian3(0, 0, 200)),
        updateCallback: (p: any) => {
          p.velocity = new C.Cartesian3(2.5, 0, -45)
        },
      }
    } else if (key === 'snow') {
      options = {
        ...common,
        emissionRate: 240 * state.intensity,
        startScale: 0.7,
        endScale: 1.35,
        startColor: C.Color.WHITE,
        endColor: new C.Color(1, 1, 1, 0.35),
        emitterModelMatrix: C.Matrix4.fromTranslation(new C.Cartesian3(0, 0, 220)),
        updateCallback: (p: any) => {
          p.velocity = new C.Cartesian3(1.6, 0.6, -2.2)
        },
      }
    } else if (key === 'sand') {
      options = {
        ...common,
        emissionRate: 260,
        startScale: 1.6,
        endScale: 4.5,
        startColor: new C.Color(0.86, 0.74, 0.5, 0.5),
        endColor: new C.Color(0.76, 0.62, 0.38, 0),
        emitterModelMatrix: C.Matrix4.fromTranslation(new C.Cartesian3(0, 0, 30)),
        updateCallback: (p: any) => {
          p.velocity = new C.Cartesian3(26, 6, 0.6)
        },
      }
    } else {
      options = {
        ...common,
        emissionRate: 24,
        startScale: 42,
        endScale: 78,
        startColor: new C.Color(1, 1, 1, 0.32),
        endColor: new C.Color(1, 1, 1, 0),
        emitterModelMatrix: C.Matrix4.fromTranslation(new C.Cartesian3(0, 0, 620)),
        updateCallback: (p: any) => {
          p.velocity = new C.Cartesian3(4, 0, 0)
        },
      }
    }

    const ps = new C.ParticleSystem(options)
    scene().primitives.add(ps)
    particles.set(key, ps)
  }

  function removeParticles(key: WeatherKey) {
    const ps = particles.get(key)
    if (ps && !ps.isDestroyed?.()) scene()?.primitives.remove(ps)
    particles.delete(key)
  }

  function setFog(on: boolean) {
    if (!scene()) return
    scene().fog.enabled = on
    scene().fog.density = on ? state.fogDensity : 0.0002
  }

  function setNight(on: boolean) {
    if (!scene()) return
    const globe = scene().globe
    globe.enableLighting = on
    scene().skyAtmosphere.brightnessShift = on ? -0.35 : 0
    scene().skyAtmosphere.saturationShift = on ? -0.3 : 0
  }

  function stopLightning() {
    if (lightningTimer !== null) {
      window.clearInterval(lightningTimer)
      lightningTimer = null
    }
    if (scene()) scene().skyAtmosphere.brightnessShift = state.night ? -0.35 : 0
  }

  function startLightning() {
    stopLightning()
    lightningTimer = window.setInterval(() => {
      if (!scene() || !state.lightning) return
      const flash = () => {
        if (!scene()) return
        scene().skyAtmosphere.brightnessShift = 0.45
        window.setTimeout(() => {
          if (scene()) scene().skyAtmosphere.brightnessShift = state.night ? -0.35 : 0
        }, 90)
      }
      flash()
      if (Math.random() > 0.55) window.setTimeout(flash, 180)
    }, 2600)
  }

  function set(key: WeatherKey, on: boolean) {
    if (!viewer || !C) return
    state[key] = on

    if (key === 'rain' || key === 'snow' || key === 'cloud' || key === 'sand') {
      if (on) {
        if (!particles.has(key)) buildParticles(key)
      } else {
        removeParticles(key)
      }
      return
    }

    if (key === 'fog') setFog(on)
    if (key === 'night') setNight(on)
    if (key === 'lightning') {
      if (on) startLightning()
      else stopLightning()
    }
  }

  function toggle(key: WeatherKey) {
    set(key, !state[key])
  }

  /** 强度变化后重建雨/雪粒子，使其立即生效 */
  function applyIntensity(value: number) {
    state.intensity = value
    ;(['rain', 'snow'] as WeatherKey[]).forEach((key) => {
      if (particles.has(key)) {
        removeParticles(key)
        buildParticles(key)
      }
    })
  }

  function applyFogDensity(value: number) {
    state.fogDensity = value
    if (state.fog && scene()) scene().fog.density = value
  }

  function reset() {
    ;(['rain', 'snow', 'cloud', 'sand'] as WeatherKey[]).forEach(removeParticles)
    stopLightning()
    if (scene()) {
      scene().fog.enabled = true
      scene().fog.density = 0.0002
      scene().globe.enableLighting = false
      scene().skyAtmosphere.brightnessShift = 0
      scene().skyAtmosphere.saturationShift = 0
    }
    Object.assign(state, {
      rain: false,
      snow: false,
      fog: false,
      cloud: false,
      lightning: false,
      sand: false,
      night: false,
    })
  }

  onCesiumReady((v, lib) => {
    viewer = v
    C = lib
    preUpdate = () => followCamera()
    v.scene.preUpdate.addEventListener(preUpdate)

    return () => {
      if (preUpdate) v.scene.preUpdate.removeEventListener(preUpdate)
      preUpdate = null
      reset()
      viewer = null
      C = null
    }
  })

  return { state, set, toggle, reset, applyIntensity, applyFogDensity }
}
