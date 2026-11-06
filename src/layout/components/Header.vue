<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/store/app'
import { useUserStore } from '@/store/user'
import BrandLogo from '@/components/BrandLogo.vue'
import LangSwitch from '@/components/LangSwitch.vue'

const { t } = useI18n()
const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()

const nickname = computed(() => userStore.userInfo?.nickname || userStore.userInfo?.username || '-')
const collapsed = computed(() => !appStore.isMobile && appStore.sidebarCollapsed)

const toggleTip = computed(() => {
  if (appStore.isMobile) return t('common.menu')
  return collapsed.value ? t('common.expand') : t('common.collapse')
})

async function onLogout() {
  try {
    await ElMessageBox.confirm(t('common.logout') + '?', t('common.tip'), {
      type: 'warning',
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
    })
  } catch {
    return
  }
  await userStore.logoutAction()
  ElMessage.success(t('common.logout'))
  router.replace('/login')
}
</script>

<template>
  <header class="h-14 shrink-0 flex items-center gap-1.5 px-3 md:px-4 bg-white border-b border-[#e6e8eb]">
    <!-- 菜单收起 / 展开 -->
    <el-tooltip :content="toggleTip" placement="bottom" :show-after="200">
      <button class="nav-icon" type="button" :aria-label="toggleTip" @click="appStore.toggleSidebar()">
        <!-- 移动端：汉堡 -->
        <svg
          v-if="appStore.isMobile"
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        >
          <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" />
        </svg>
        <!-- 桌面端：侧栏面板图标，箭头指示收起/展开方向 -->
        <svg
          v-else
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2.5" />
          <path d="M7.75 3.75v12.5" />
          <path v-if="collapsed" d="M11.25 8.25 13 10l-1.75 1.75" />
          <path v-else d="M13 8.25 11.25 10 13 11.75" />
        </svg>
      </button>
    </el-tooltip>

    <div class="flex items-center gap-2.5 cursor-pointer min-w-0 pl-1" @click="router.push('/home')">
      <BrandLogo :size="27" />
      <span class="font-semibold text-[15px] tracking-tight truncate hidden sm:block">{{ t('login.title') }}</span>
    </div>

    <div class="flex-1" />

    <LangSwitch />

    <div class="w-px h-5 bg-[#e6e8eb] mx-1.5 hidden sm:block" />

    <!-- 用户 -->
    <el-dropdown trigger="click" placement="bottom-end">
      <div class="flex items-center gap-2 cursor-pointer h-9 pl-1 pr-1.5 rounded-lg hover:bg-[#f3f4f6]">
        <div class="w-7 h-7 rounded-full bg-[#eef4ff] text-[#2563eb] grid place-items-center text-xs font-medium">
          {{ nickname.slice(0, 1).toUpperCase() }}
        </div>
        <span class="text-sm max-w-24 truncate hidden md:block">{{ nickname }}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-[#9ca3af] hidden md:block"
        >
          <path d="M3 4.75 6 7.75l3-3" />
        </svg>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item disabled>
            <span class="text-xs text-[#6b7280]">{{ userStore.userInfo?.username }} · {{ userStore.roles.join(',') }}</span>
          </el-dropdown-item>
          <el-dropdown-item divided @click="onLogout">
            <el-icon class="mr-1.5"><SwitchButton /></el-icon>{{ t('common.logout') }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </header>
</template>

<style scoped>
.nav-icon {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  color: #6b7280;
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.15s ease;
}
.nav-icon:hover {
  color: #1f2328;
}
</style>
