<script setup lang="ts">
import { computed } from 'vue'
import type { MenuItem } from '@/types/global'
import { useAppStore } from '@/store/app'

defineProps<{ menu: MenuItem }>()

const appStore = useAppStore()
const collapsed = computed(() => appStore.sidebarCollapsed && !appStore.isMobile)
</script>

<script lang="ts">
export default { name: 'MenuItemNode' }
</script>

<template>
  <el-sub-menu v-if="menu.children && menu.children.length" :index="menu.path">
    <template #title>
      <el-icon v-if="menu.icon"><component :is="menu.icon" /></el-icon>
      <span>{{ $t(menu.key) }}</span>
    </template>
    <MenuItemNode v-for="child in menu.children" :key="child.id" :menu="child" />
  </el-sub-menu>

  <el-tooltip v-else :disabled="!collapsed" :content="$t(menu.key)" placement="right" :show-after="80">
    <el-menu-item :index="menu.path">
      <el-icon v-if="menu.icon"><component :is="menu.icon" /></el-icon>
      <template #title>{{ $t(menu.key) }}</template>
    </el-menu-item>
  </el-tooltip>
</template>
