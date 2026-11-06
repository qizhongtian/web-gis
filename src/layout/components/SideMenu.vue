<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/store/user'
import { useAppStore } from '@/store/app'
import MenuItemNode from './MenuItemNode.vue'

const props = defineProps<{ inDrawer?: boolean }>()

const route = useRoute()
const appStore = useAppStore()
const userStore = useUserStore()

const collapsed = computed(() => !props.inDrawer && appStore.sidebarCollapsed)
const width = computed(() => (props.inDrawer ? '100%' : collapsed.value ? '64px' : '232px'))
</script>

<template>
  <aside
    class="shrink-0 h-full bg-white border-r border-[#e6e8eb] overflow-hidden transition-[width] duration-200 ease-out"
    :style="{ width }"
  >
    <el-scrollbar class="h-full">
      <el-menu
        class="app-menu"
        :collapse="collapsed"
        :collapse-transition="false"
        :default-active="route.path"
        :default-openeds="[]"
        unique-opened
        router
      >
        <MenuItemNode v-for="menu in userStore.menus" :key="menu.id" :menu="menu" />
      </el-menu>
    </el-scrollbar>
  </aside>
</template>
