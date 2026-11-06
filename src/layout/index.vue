<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import LayoutHeader from './components/Header.vue'
import SideMenu from './components/SideMenu.vue'
import Breadcrumb from './components/Breadcrumb.vue'
import { useAppStore } from '@/store/app'

const route = useRoute()
const appStore = useAppStore()

/**
 * 需要 keep-alive 缓存的页面组件名
 * 页面内用 defineOptions({ name: 'XXX' }) 声明，名字加到这里即可缓存（地图与表单状态不会因切换路由丢失）
 */
const cachedViews = ['CesiumVectorUpload']

/**
 * 直接取 route.matched 最深层的页面组件来渲染
 * 菜单目录层是 PassThrough + 内层 router-view，页面会被渲染到更深层级，
 * 外层 keep-alive 缓存不到；这里由 Layout 统一渲染叶子组件，缓存才生效。
 */
const leafComponent = computed(() => {
  const matched = route.matched
  for (let i = matched.length - 1; i >= 0; i--) {
    const comp = (matched[i].components as Record<string, any> | undefined)?.default
    if (comp) return comp
  }
  return null
})

// 自适应：小屏抽屉菜单 / 中屏自动收起侧边栏
const isMobile = useMediaQuery('(max-width: 767px)')
const isCompact = useMediaQuery('(max-width: 1200px)')

watch(
  isMobile,
  (v) => {
    appStore.isMobile = v
    if (!v) appStore.closeDrawer()
  },
  { immediate: true },
)

watch(
  isCompact,
  (v) => {
    if (v) appStore.sidebarCollapsed = true
  },
  { immediate: true },
)

// 移动端点击菜单后自动关闭抽屉
watch(
  () => route.path,
  () => appStore.closeDrawer(),
)
</script>

<template>
  <div class="h-full flex flex-col bg-[#f4f6f8]">
    <LayoutHeader />

    <div class="flex-1 flex min-h-0">
      <SideMenu v-if="!appStore.isMobile" />

      <el-drawer
        v-else
        v-model="appStore.drawerVisible"
        direction="ltr"
        size="236px"
        :with-header="false"
        class="menu-drawer"
      >
        <SideMenu in-drawer />
      </el-drawer>

      <main class="flex-1 flex flex-col min-w-0 min-h-0 gap-3 p-3 md:p-4 overflow-hidden">
        <Breadcrumb />
        <div class="flex-1 min-h-0 bg-white border border-[#e6e8eb] rounded-xl overflow-hidden relative">
          <transition name="fade" mode="out-in">
            <keep-alive v-if="leafComponent" :include="cachedViews">
              <component :is="leafComponent" :key="route.path" />
            </keep-alive>
          </transition>
        </div>
      </main>
    </div>
  </div>
</template>
