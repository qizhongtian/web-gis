<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowRight } from '@element-plus/icons-vue'
import { useUserStore } from '@/store/user'
import { useKnowledge } from '@/composables/useKnowledge'
import { openGlobalSearch } from '@/composables/useGlobalSearch'

const { t } = useI18n()
const router = useRouter()
const userStore = useUserStore()
const { entries, recent, changeGroups, relativeDay, shortDate } = useKnowledge()

const stats = computed(() => {
  const count = (menu: any): number =>
    menu.children?.length ? menu.children.reduce((s: number, c: any) => s + count(c), 0) : 1
  return userStore.menus
    .filter((m) => m.path !== '/system')
    .map((m) => ({ key: m.key, path: m.path, title: t(m.key), count: count(m) }))
})

/** 首页只展示最近 6 条新增知识 */
const recentTop = computed(() => recent.value.slice(0, 6))

/** 角色菜单里存在的路由才允许从更新动态跳转 */
const knownPaths = computed(() => new Set(entries.value.map((e) => e.path)))
function openPath(path?: string) {
  if (path && knownPaths.value.has(path)) router.push(path)
}
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
      <section class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
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

      <!-- 知识模块：最近新增 + 更新动态 -->
      <section class="grid grid-cols-1 xl:grid-cols-3 gap-3 md:gap-4">
        <div class="app-panel xl:col-span-2 overflow-hidden flex flex-col">
          <header class="flex items-start justify-between gap-3 px-4 md:px-5 pt-4 pb-3 border-b border-[#f1f3f5]">
            <div class="min-w-0">
              <h3 class="text-sm font-medium text-[#111827]">{{ t('dashboard.recentKnowledge') }}</h3>
              <p class="text-[11.5px] text-[#9ca3af] mt-0.5">{{ t('dashboard.recentKnowledgeDesc') }}</p>
            </div>
            <button type="button" class="link-btn" @click="openGlobalSearch()">
              {{ t('dashboard.allKnowledge') }} · {{ entries.length }}
              <ArrowRight class="w-3 h-3 inline-block -mt-px" />
            </button>
          </header>

          <div
            v-if="recentTop.length"
            class="grid sm:grid-cols-2 [grid-auto-rows:1fr] gap-2 p-3 md:p-4 flex-1 min-h-0"
          >
            <button
              v-for="item in recentTop"
              :key="item.path"
              type="button"
              class="know-item"
              @click="router.push(item.path)"
            >
              <div class="flex items-center gap-1.5">
                <span class="know-cat">{{ item.category }}</span>
                <span v-if="item.isNew" class="know-new">{{ t('knowledge.new') }}</span>
                <span class="ml-auto text-[11px] text-[#9ca3af]">{{ relativeDay(item.addedAt) }}</span>
              </div>
              <p class="know-title">{{ item.title }}</p>
              <p class="know-desc">{{ item.summary }}</p>
            </button>
          </div>
          <p v-else class="flex-1 flex items-center justify-center px-5 py-8 text-[13px] text-[#9ca3af]">
            {{ t('dashboard.emptyRecent') }}
          </p>
        </div>

        <div class="app-panel overflow-hidden flex flex-col">
          <header class="px-4 md:px-5 pt-4 pb-3 border-b border-[#f1f3f5]">
            <h3 class="text-sm font-medium text-[#111827]">{{ t('dashboard.changelog') }}</h3>
            <p class="text-[11.5px] text-[#9ca3af] mt-0.5">{{ t('dashboard.changelogDesc') }}</p>
          </header>

          <div class="changelog">
            <div v-for="group in changeGroups" :key="group.date" class="chg-group">
              <p class="chg-date">{{ shortDate(group.date) }}</p>
              <ul class="chg-list">
                <li
                  v-for="c in group.items"
                  :key="c.id"
                  class="chg-item"
                  :class="{ 'is-link': !!c.path && knownPaths.has(c.path) }"
                  @click="openPath(c.path)"
                >
                  <span class="chg-dot" :class="c.type" />
                  <div class="min-w-0">
                    <p class="chg-title">
                      <span class="chg-badge" :class="c.type">{{ c.typeLabel }}</span>
                      <span>{{ c.title }}</span>
                    </p>
                    <p v-if="c.desc" class="chg-desc">{{ c.desc }}</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.link-btn {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 7px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #2563eb;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.link-btn:hover {
  background: #eef4ff;
}

.know-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 11px 12px;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}
.know-item:hover {
  border-color: #dbe7ff;
  background: #fafcff;
  box-shadow: 0 2px 10px rgba(37, 99, 235, 0.06);
}
.know-cat {
  padding: 0 5px;
  border-radius: 4px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 10px;
  line-height: 16px;
}
.know-new {
  padding: 0 4px;
  border-radius: 4px;
  background: #eef4ff;
  color: #2563eb;
  font-size: 9.5px;
  font-weight: 600;
  line-height: 15px;
}
.know-title {
  margin: 0;
  color: #1f2328;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.know-desc {
  display: -webkit-box;
  margin: 0;
  color: #6b7280;
  font-size: 11.5px;
  line-height: 1.55;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.changelog {
  flex: 1;
  min-height: 0;
  max-height: 452px;
  padding: 10px 18px 14px;
  overflow-y: auto;
}
.chg-group + .chg-group {
  margin-top: 6px;
}
.chg-date {
  margin: 6px 0 4px;
  color: #9ca3af;
  font-size: 10.5px;
  letter-spacing: 0.05em;
}
.chg-list {
  margin: 0;
  padding: 0 0 0 10px;
  list-style: none;
  border-left: 1px solid #eef0f3;
}
.chg-item {
  position: relative;
  display: flex;
  gap: 8px;
  padding: 5px 6px 7px 10px;
  border-radius: 7px;
  transition: background 0.15s ease;
}
.chg-item.is-link {
  cursor: pointer;
}
.chg-item.is-link:hover {
  background: #f8fafc;
}
.chg-dot {
  position: absolute;
  left: -14px;
  top: 11px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #cbd5e1;
  box-shadow: 0 0 0 3px #fff;
}
.chg-dot.feat {
  background: #2563eb;
}
.chg-dot.fix {
  background: #ef4444;
}
.chg-dot.opt {
  background: #10b981;
}
.chg-dot.chore {
  background: #9ca3af;
}
.chg-title {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  color: #1f2328;
  font-size: 12.5px;
  line-height: 1.5;
}
.chg-badge {
  flex: none;
  margin-top: 1px;
  padding: 0 4px;
  border-radius: 4px;
  background: #eef4ff;
  color: #2563eb;
  font-size: 9.5px;
  font-weight: 600;
  line-height: 15px;
}
.chg-badge.fix {
  background: #fef2f2;
  color: #dc2626;
}
.chg-badge.opt {
  background: #ecfdf5;
  color: #059669;
}
.chg-badge.chore {
  background: #f3f4f6;
  color: #6b7280;
}
.chg-desc {
  margin: 3px 0 0;
  color: #9ca3af;
  font-size: 11px;
  line-height: 1.55;
}
</style>
