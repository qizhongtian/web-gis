import { ref, watch } from 'vue'

/**
 * 屏幕空间着色器材质（后处理）封装
 *
 * 把一段 GLSL 片段着色器挂到 `scene.postProcessStages`，用 hook 管理生命周期：
 * - Viewer 就绪时自动创建 stage，组件卸载 / Viewer 销毁时移除并 destroy
 * - `enabled` 与 `stage.enabled` 双向同步，可随时开关且不重复编译着色器
 * - `uniforms` 的值可以是函数：Cesium 会每帧调用它，适合 `u_time`、强度、开关量等动态参数；
 *   值为函数时不可再通过 `setUniform` 覆盖（Cesium 内部会把它固化为只读属性）
 *
 * 着色器约定（Cesium 1.115 / GLSL ES 3.00）：
 * ```glsl
 * uniform sampler2D colorTexture;
 * in vec2 v_textureCoordinates;
 * void main() {
 *   out_FragColor = texture(colorTexture, v_textureCoordinates);
 * }
 * ```
 * 另外可直接使用 Cesium 自动 uniform：`czm_viewport`（宽高）、`czm_frameNumber`、`czm_pixelRatio` 等。
 *
 * ```ts
 * const stage = useCesiumPostStage({
 *   name: 'weather-rain',
 *   fragmentShader: RAIN_SHADER,
 *   uniforms: { u_time: () => performance.now() / 1000 },
 * })
 * stage.enabled.value = true
 * ```
 */
export function useCesiumPostStage(options: {
  /** 完整片段着色器源码 */
  fragmentShader: string
  /** uniform 初始值；值为函数时每帧求值 */
  uniforms?: Record<string, any>
  /** 便于调试的阶段名 */
  name?: string
  /** 初始是否开启 */
  enabled?: boolean
}) {
  const enabled = ref(!!options.enabled)
  /** 着色器阶段是否已挂载 */
  const ready = ref(false)

  let stage: any = null

  onCesiumReady((viewer, C) => {
    stage = new C.PostProcessStage({
      name: options.name ?? 'cesium-post-stage',
      fragmentShader: options.fragmentShader,
      uniforms: options.uniforms ?? {},
    })
    stage.enabled = enabled.value
    viewer.scene.postProcessStages.add(stage)
    ready.value = true

    return () => {
      ready.value = false
      const s = stage
      stage = null
      if (!s || viewer.isDestroyed?.()) return
      viewer.scene.postProcessStages.remove(s)
      s.destroy?.()
    }
  })

  watch(enabled, (on) => {
    if (stage) stage.enabled = on
  })

  /** 修改非函数型 uniform（函数型 uniform 请通过闭包读取响应式状态） */
  function setUniform(name: string, value: any) {
    if (stage?.uniforms) stage.uniforms[name] = value
  }

  return { enabled, ready, setUniform, getStage: () => stage }
}
