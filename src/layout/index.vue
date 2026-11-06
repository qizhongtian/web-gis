<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import LayoutHeader from './components/Header.vue'
import SideMenu from './components/SideMenu.vue'
import Breadcrumb from './components/Breadcrumb.vue'
import { useAppStore } from '@/store/app'

const route = useRoute()
const appStore = useAppStore()

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
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </div>
      </main>
    </div>
  </div>
</template>
