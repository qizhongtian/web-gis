import { reactive, ref } from 'vue'
import {
  CLOUD_SHADER,
  HAZE_SHADER,
  LIGHTNING_SHADER,
  NIGHT_SHADER,
  RAIN_SHADER,
  SAND_SHADER,
  SNOW_SHADER,
} from '@/utils/gis/weatherShaders'
import { useCesiumPostStage } from './useCesiumPostStage'

export type WeatherKey = 'rain' | 'snow' | 'fog' | 'cloud' | 'lightning' | 'sand' | 'night'

export interface WeatherState {
  rain: boolean
  snow: boolean
  fog: boolean
  cloud: boolean
  lightning: boolean
  sand: boolean
  night: boolean
  /** 雨/雪/沙强度 0.2 ~ 2 */
  intensity: number
  /** 雾浓度 0 ~ 0.005（同时作用于 scene.fog 与雾霾着色器） */
  fogDensity: number
  /** 云量 0.05 ~ 1 */
  cloudCover: number
}

/** 场景默认雾浓度，关闭特效时还原 */
const DEFAULT_FOG_DENSITY = 0.0002

/**
 * 天气 / 环境特效：雨、雪、雾、云、闪电、沙尘、夜景
 *
 * 全部基于 GLSL 片段着色器（`scene.postProcessStages` 自定义材质），由 useCesiumPostStage 封装：
 * - 无粒子几何体，不随相机缩放变稀 / 穿模
 * - 动态参数（时间、强度、雾浓度、云量、闪电亮度）以「每帧求值函数」传入 uniform
 * - 阶段按「夜景 → 雾霾 → 云层 → 雨 / 雪 / 沙尘 → 闪电」顺序挂载，保证合成次序
 * - 组件卸载时移除阶段并还原 scene.fog
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
    cloudCover: 0.6,
  })

  /** 着色器动画时间（秒），交给 uniform 每帧读取，帧率无关 */
  const time = () => performance.now() / 1000
  /** 闪电瞬时亮度 0 ~ 1 */
  const flash = ref(0)

  let viewer: any = null

  // 阶段创建顺序即渲染顺序（Cesium 后处理链按加入顺序叠加）
  const nightStage = useCesiumPostStage({
    name: 'weather-night',
    fragmentShader: NIGHT_SHADER,
  })
  const fogStage = useCesiumPostStage({
    name: 'weather-haze',
    fragmentShader: HAZE_SHADER,
    uniforms: {
      u_time: time,
      u_density: () => state.fogDensity,
    },
  })
  const cloudStage = useCesiumPostStage({
    name: 'weather-cloud',
    fragmentShader: CLOUD_SHADER,
    uniforms: {
      u_time: time,
      u_cover: () => state.cloudCover,
    },
  })
  const rainStage = useCesiumPostStage({
    name: 'weather-rain',
    fragmentShader: RAIN_SHADER,
    uniforms: {
      u_time: time,
      u_intensity: () => state.intensity,
    },
  })
  const snowStage = useCesiumPostStage({
    name: 'weather-snow',
    fragmentShader: SNOW_SHADER,
    uniforms: {
      u_time: time,
      u_intensity: () => state.intensity,
    },
  })
  const sandStage = useCesiumPostStage({
    name: 'weather-sand',
    fragmentShader: SAND_SHADER,
    uniforms: {
      u_time: time,
      u_intensity: () => state.intensity,
    },
  })
  const lightningStage = useCesiumPostStage({
    name: 'weather-lightning',
    fragmentShader: LIGHTNING_SHADER,
    uniforms: {
      u_flash: () => flash.value,
    },
  })

  const stages: Record<WeatherKey, ReturnType<typeof useCesiumPostStage>> = {
    night: nightStage,
    fog: fogStage,
    cloud: cloudStage,
    rain: rainStage,
    snow: snowStage,
    sand: sandStage,
    lightning: lightningStage,
  }

  /* ------------------------------ 闪电时序 ------------------------------ */

  let strikeTimer = 0
  let decayTimer = 0

  function scheduleStrike() {
    strikeTimer = window.setTimeout(() => {
      if (!state.lightning) return
      flash.value = 0.85 + Math.random() * 0.15
      // 常见双闪
      if (Math.random() > 0.45) {
        window.setTimeout(() => {
          if (state.lightning) flash.value = 0.55 + Math.random() * 0.35
        }, 130)
      }
      scheduleStrike()
    }, 1400 + Math.random() * 2600)
  }

  function startLightning() {
    stopLightning()
    decayTimer = window.setInterval(() => {
      if (flash.value > 0) flash.value = Math.max(0, flash.value - 0.22)
    }, 60)
    scheduleStrike()
  }

  function stopLightning() {
    window.clearTimeout(strikeTimer)
    window.clearInterval(decayTimer)
    strikeTimer = 0
    decayTimer = 0
    flash.value = 0
  }

  /* ------------------------------ 开关 / 参数 ------------------------------ */

  function applyFogDensityToScene() {
    if (viewer && !viewer.isDestroyed?.()) viewer.scene.fog.density = state.fog ? state.fogDensity : DEFAULT_FOG_DENSITY
  }

  function set(key: WeatherKey, on: boolean) {
    state[key] = on
    stages[key].enabled.value = on

    if (key === 'fog') applyFogDensityToScene()
    if (key === 'lightning') {
      if (on) startLightning()
      else stopLightning()
    }
  }

  function toggle(key: WeatherKey) {
    set(key, !state[key])
  }

  /** 强度通过 uniform 闭包实时生效，无需重建任何资源 */
  function applyIntensity(value: number) {
    state.intensity = Math.min(2, Math.max(0.2, value))
  }

  function applyFogDensity(value: number) {
    state.fogDensity = value
    applyFogDensityToScene()
  }

  function applyCloudCover(value: number) {
    state.cloudCover = Math.min(1, Math.max(0.05, value))
  }

  function reset() {
    Object.assign(state, {
      rain: false,
      snow: false,
      fog: false,
      cloud: false,
      lightning: false,
      sand: false,
      night: false,
    })
    ;(Object.keys(stages) as WeatherKey[]).forEach((key) => {
      stages[key].enabled.value = false
    })
    stopLightning()
    applyFogDensityToScene()
  }

  onCesiumReady((v) => {
    viewer = v
    // 雾浓度与 scene.fog 联动，避免仅屏幕雾幕而远处地形无衰减
    if (state.fog) applyFogDensityToScene()

    return () => {
      stopLightning()
      if (!v.isDestroyed?.()) v.scene.fog.density = DEFAULT_FOG_DENSITY
      viewer = null
    }
  })

  return { state, set, toggle, reset, applyIntensity, applyFogDensity, applyCloudCover }
}
