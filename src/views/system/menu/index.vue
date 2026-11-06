<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUserStore } from '@/store/user'
import type { MenuItem } from '@/types/global'

const { t } = useI18n()
const userStore = useUserStore()

/** 菜单树（登录后由 /api/menus 按角色过滤返回） */
const tree = computed<MenuItem[]>(() => userStore.menus)
</script>

<template>
  <div class="p-4 h-full flex flex-col gap-3 overflow-auto">
    <el-alert type="info" :closable="false" show-icon
      title="菜单数据来自 Mock 接口 /api/menus，按当前角色过滤后动态注册为路由（动态路由 + 权限菜单）" />

    <el-table :data="tree" row-key="id" border default-expand-all size="small" class="tech-panel"
      :tree-props="{ children: 'children' }">
      <el-table-column :label="t('system.menuTitle')" min-width="200">
        <template #default="{ row }">{{ $t(row.key) }}</template>
      </el-table-column>
      <el-table-column :label="t('system.menuPath')" prop="path" min-width="180" />
      <el-table-column :label="t('system.menuIcon')" prop="icon" width="140" />
      <el-table-column label="Component" prop="component" min-width="220" />
      <el-table-column label="Roles" min-width="140">
        <template #default="{ row }">
          <el-tag v-for="r in row.roles" :key="r" size="small" class="mr-1" type="warning" effect="plain">{{ r }}</el-tag>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
