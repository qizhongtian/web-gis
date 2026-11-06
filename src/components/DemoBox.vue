<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * GIS 示例通用容器：
 * - 统一处理库加载（loading / error / retry）
 * - init 返回清理函数，卸载时自动释放
 */
const props = withDefaults(
  defineProps<{
    loader: () => Promise<any>
    init: (lib: any, el: HTMLElement) => void | (() => void) | Promise<void | (() => void)>
    /** 三维场景使用科技风加载遮罩 */
    tech?: boolean
  }>(),
  { tech: false },
)

const { t } = useI18n()
const el = ref<HTMLElement>()
const loading = ref(false)
const error = ref('')
const dispose = shallowRef<null | (() => void)>(null)
const retryKey = ref(0)
let alive = true

async function run() {
  if (!el.value) return
  dispose.value?.()
  dispose.value = null
  loading.value = true
  error.value = ''
  try {
    const lib = await props.loader()
    if (!alive) return
    const d = await props.init(lib, el.value)
    dispose.value = typeof d === 'function' ? d : null
  } catch (e: any) {
    if (alive) error.value = e?.message || String(e)
  } finally {
    if (alive) loading.value = false
  }
}

onMounted(run)
watch(retryKey, run)
onBeforeUnmount(() => {
  alive = false
  dispose.value?.()
  dispose.value = null
})
</script>

<template>
  <div class="relative w-full h-full rounded-lg overflow-hidden border border-[#e6e8eb] bg-[#0a1a28]">
    <div ref="el" class="absolute inset-0"></div>

    <Transition name="gis-fade">
      <GisLoading
        v-if="loading"
        overlay
        compact
        :tech="tech"
        :title="t('common.loadingMap')"
        :desc="t('common.loadingMapDesc')"
      />
    </Transition>

    <Transition name="gis-fade">
      <div
        v-if="!loading && error"
        class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 bg-white/95"
      >
        <el-icon class="text-2xl text-[#ef4444]"><CircleCloseFilled /></el-icon>
        <span class="text-[13px] text-[#6b7280]">{{ t('common.libError') }}</span>
        <span class="text-[11px] text-[#9ca3af] max-w-80 break-all text-center">{{ error }}</span>
        <el-button size="small" type="primary" @click="retryKey++">{{ t('common.retry') }}</el-button>
      </div>
    </Transition>
  </div>
</template>
