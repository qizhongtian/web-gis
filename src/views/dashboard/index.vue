<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowRight } from '@element-plus/icons-vue'
import { useUserStore } from '@/store/user'

const { t } = useI18n()
const router = useRouter()
const userStore = useUserStore()

const stats = computed(() => {
  const count = (menu: any): number =>
    menu.children?.length ? menu.children.reduce((s: number, c: any) => s + count(c), 0) : 1
  return userStore.menus
    .filter((m) => m.path !== '/system')
    .map((m) => ({ key: m.key, path: m.path, title: t(m.key), count: count(m) }))
})
</script>

<template>
  <div class="h-full overflow-auto">
    <div class="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      <!-- 欢迎 -->
      <section class="min-w-0">
        <h1 class="text-[22px] md:text-2xl font-semibold tracking-tight text-[#111827]">
          {{ t('dashboard.hello', { name: userStore.userInfo?.nickname }) }}
        </h1>
        <p class="text-sm text-[#6b7280] mt-1.5">{{ t('dashboard.desc') }}</p>
      </section>

      <!-- 示例统计 -->
      <section class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <button
          v-for="s in stats"
          :key="s.key"
          type="button"
          class="app-panel p-4 md:p-5 text-left hover:border-[#c7d7fb] hover:shadow-sm transition-all group"
          @click="router.push(s.path)"
        >
          <div class="flex items-start justify-between">
            <span class="text-2xl md:text-3xl font-semibold tracking-tight text-[#111827]">{{ s.count }}</span>
            <el-icon class="text-[#d1d5db] group-hover:text-[#2563eb] transition-colors" :size="16">
              <ArrowRight />
            </el-icon>
          </div>
          <div class="text-[13px] text-[#6b7280] mt-2 truncate">{{ s.title }}</div>
        </button>
      </section>

      <!-- 角色 / 权限 -->
      <section class="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        <div class="app-panel p-5">
          <h3 class="text-sm font-medium text-[#111827] mb-3">{{ t('dashboard.role') }}</h3>
          <div class="flex flex-wrap gap-2">
            <el-tag v-for="r in userStore.roles" :key="r" size="small" effect="light" round>{{ r }}</el-tag>
          </div>
        </div>
        <div class="app-panel p-5">
          <h3 class="text-sm font-medium text-[#111827] mb-3">{{ t('dashboard.permission') }}</h3>
          <div class="flex flex-wrap gap-1.5">
            <el-tag v-for="p in userStore.permissions" :key="p" size="small" type="info" effect="plain" round>
              {{ p }}
            </el-tag>
          </div>
        </div>
      </section>

      <!-- 说明 -->
      <section class="app-panel p-5">
        <h3 class="text-sm font-medium text-[#111827] mb-1.5">{{ t('dashboard.tipTitle') }}</h3>
        <p class="text-[13px] leading-relaxed text-[#6b7280]">{{ t('dashboard.tipDesc') }}</p>
      </section>
    </div>
  </div>
</template>
