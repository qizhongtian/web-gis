<script setup lang="ts">
import { watch } from 'vue'

const props = defineProps<{
  /** 主屏 Viewer（由父级 @ready 取得） */
  source?: any
  /** 是否联动 */
  enabled?: boolean
}>()

let dst: any = null
let attached: any = null
let sync = (() => {}) as () => void
let raf = 0

function detach() {
  if (attached && sync) attached.camera.changed.removeEventListener(sync)
  attached = null
}

function runner() {
  if (!props.enabled || !attached || !dst || dst.isDestroyed?.() || attached.isDestroyed?.()) return
  // 2D 模式下方向向量无意义，跳过同步
  if (dst.scene.mode !== 3) return
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    if (!props.enabled || !attached || !dst || dst.isDestroyed?.() || attached.isDestroyed?.()) return
    try {
      dst.camera.setView({
        destination: attached.camera.positionWC,
        orientation: { direction: attached.camera.directionWC, up: attached.camera.upWC },
      })
    } catch {
      // 相机动画过程中可能出现瞬态异常，忽略
    }
  })
}

function attach(source: any) {
  detach()
  if (!source || source.isDestroyed?.()) return
  attached = source
  sync = runner
  attached.camera.changed.addEventListener(sync)
  runner()
}

onCesiumReady((v) => {
  dst = v
  attach(props.source)
  return () => {
    detach()
    if (raf) cancelAnimationFrame(raf)
    dst = null
  }
})

watch(() => props.source, (source) => attach(source))
watch(
  () => props.enabled,
  (enabled) => {
    if (enabled) runner()
  },
)
</script>

<template>
  <span v-show="false" />
</template>
