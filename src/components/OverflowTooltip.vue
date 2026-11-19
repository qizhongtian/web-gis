<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    text: string
    /** 强制禁用 tooltip（如收起态、文本本身被隐藏时） */
    disabled?: boolean
    placement?: 'top' | 'bottom' | 'left' | 'right'
    showAfter?: number
  }>(),
  { disabled: false, placement: 'right', showAfter: 120 },
)

const textRef = ref<HTMLElement | null>(null)
/** 文本是否被省略号截断，只有截断时才提示完整内容 */
const truncated = ref(false)
let observer: ResizeObserver | null = null

function measure() {
  const el = textRef.value
  if (!el) return
  truncated.value = el.scrollWidth > el.clientWidth + 1
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measure)
    if (textRef.value) observer.observe(textRef.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

watch(
  () => props.text,
  () => nextTick(measure),
)
</script>

<template>
  <el-tooltip
    :disabled="props.disabled || !truncated"
    :content="props.text"
    :placement="props.placement"
    :show-after="props.showAfter"
    :hide-after="0"
    :enterable="false"
    popper-class="overflow-tooltip"
  >
    <span ref="textRef" class="overflow-text" @mouseenter="measure">{{ props.text }}</span>
  </el-tooltip>
</template>

<style scoped>
.overflow-text {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
