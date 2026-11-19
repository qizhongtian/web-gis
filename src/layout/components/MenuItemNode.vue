<script setup lang="ts">
import { computed } from 'vue'
import type { MenuItem } from '@/types/global'
import { useAppStore } from '@/store/app'
import OverflowTooltip from '@/components/OverflowTooltip.vue'

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
      <el-icon v-if="menu.icon" class="menu-node__icon"><component :is="menu.icon" /></el-icon>
      <OverflowTooltip :text="$t(menu.key)" :disabled="collapsed" />
    </template>
    <MenuItemNode v-for="child in menu.children" :key="child.id" :menu="child" />
  </el-sub-menu>

  <el-tooltip v-else :disabled="!collapsed" :content="$t(menu.key)" placement="right" :show-after="80">
    <el-menu-item :index="menu.path">
      <el-icon v-if="menu.icon" class="menu-node__icon"><component :is="menu.icon" /></el-icon>
      <template #title>
        <OverflowTooltip :text="$t(menu.key)" :disabled="collapsed" />
      </template>
    </el-menu-item>
  </el-tooltip>
</template>
