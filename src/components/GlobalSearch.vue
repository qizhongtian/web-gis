<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useKnowledge, type KnowledgeEntry } from '@/composables/useKnowledge'
import { useGlobalSearch } from '@/composables/useGlobalSearch'

const { t } = useI18n()
const router = useRouter()
const { entries, categories, recent, scenes, search } = useKnowledge()
const { visible, consumePending } = useGlobalSearch()

const query = ref('')
const activeCategory = ref('')
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement>()

const keyword = computed(() => query.value.trim())
const searching = computed(() => !!keyword.value)

/** 有输入时给搜索结果，无输入时给最近新增 / 当前分类 */
const list = computed<KnowledgeEntry[]>(() => {
  if (keyword.value) return search(keyword.value, activeCategory.value)
  const pool = activeCategory.value
    ? entries.value.filter((e) => e.categoryKey === activeCategory.value)
    : recent.value
  return pool.slice(0, 6)
})

const listTitle = computed(() => {
  if (keyword.value) return t('knowledge.results')
  if (activeCategory.value) {
    const label = categories.value.find((c) => c.key === activeCategory.value)?.label
    return label || t('knowledge.recent')
  }
  return t('knowledge.recent')
})

// 打开面板时应用首页带进来的预置条件
watch(visible, (v) => {
  if (!v) return
  const preset = consumePending()
  if (preset) {
    query.value = preset.query ?? ''
    activeCategory.value = preset.category ?? ''
  }
})

watch([query, activeCategory], () => {
  activeIndex.value = 0
})

function focusInput() {
  nextTick(() => inputRef.value?.focus())
}

function reset() {
  query.value = ''
  activeCategory.value = ''
  activeIndex.value = 0
}

function toggleCategory(key: string) {
  activeCategory.value = activeCategory.value === key ? '' : key
}

function applyScene(scene: { query: string; category: string }) {
  query.value = scene.query
  activeCategory.value = scene.category
  focusInput()
}

function go(entry?: KnowledgeEntry) {
  if (!entry) return
  visible.value = false
  router.push(entry.path)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const len = list.value.length
    if (!len) return
    const delta = e.key === 'ArrowDown' ? 1 : -1
    activeIndex.value = (activeIndex.value + delta + len) % len
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    go(list.value[activeIndex.value])
    return
  }
  if (e.key === 'Escape') visible.value = false
}

/** 关键词高亮：按空格分词，命中片段用 <mark> 渲染 */
function parts(text: string) {
  const q = keyword.value
  if (!q || !text) return [{ text, hit: false }]
  const tokens = q
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!tokens.length) return [{ text, hit: false }]
  return text
    .split(new RegExp(`(${tokens.join('|')})`, 'gi'))
    .filter(Boolean)
    .map((seg, i) => ({ text: seg, hit: i % 2 === 1 }))
}

function onHotkey(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null
  const typing =
    el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT' || !!el?.isContentEditable
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    visible.value = !visible.value
    return
  }
  if (e.key === '/' && !typing && !visible.value) {
    e.preventDefault()
    visible.value = true
  }
}

onMounted(() => window.addEventListener('keydown', onHotkey))
onBeforeUnmount(() => window.removeEventListener('keydown', onHotkey))
</script>

<template>
  <button type="button" class="gs-trigger" :aria-label="t('knowledge.search')" @click="visible = true">
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
      <circle cx="9" cy="9" r="5.5" />
      <path d="m13.2 13.2 3.3 3.3" stroke-linecap="round" />
    </svg>
    <span class="gs-trigger-text">{{ t('knowledge.searchShort') }}</span>
    <kbd class="gs-kbd">Ctrl K</kbd>
  </button>

  <el-dialog
    v-model="visible"
    class="gs-dialog"
    width="min(680px, 94vw)"
    top="8vh"
    :show-close="false"
    append-to-body
    @opened="focusInput"
    @closed="reset"
  >
    <div class="gs-head">
      <svg class="gs-head-icon" width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
        <circle cx="9" cy="9" r="5.5" />
        <path d="m13.2 13.2 3.3 3.3" stroke-linecap="round" />
      </svg>
      <input
        ref="inputRef"
        v-model="query"
        class="gs-input"
        :aria-label="t('knowledge.search')"
        :placeholder="t('knowledge.placeholder')"
        autocomplete="off"
        spellcheck="false"
        @keydown="onKeydown"
      />
      <kbd class="gs-esc">Esc</kbd>
    </div>

    <div class="gs-filter">
      <button
        type="button"
        class="gs-chip"
        :class="{ on: !activeCategory }"
        @click="activeCategory = ''"
      >
        {{ t('knowledge.all') }}
        <span class="gs-count">{{ entries.length }}</span>
      </button>
      <button
        v-for="c in categories"
        :key="c.key"
        type="button"
        class="gs-chip"
        :class="{ on: activeCategory === c.key }"
        @click="toggleCategory(c.key)"
      >
        {{ c.label }}
        <span class="gs-count">{{ c.count }}</span>
      </button>
    </div>

    <div class="gs-body">
      <!-- 无关键词：场景化导航 + 最近新增 -->
      <template v-if="!searching">
        <p class="gs-label">{{ t('knowledge.sceneNav') }}</p>
        <div class="gs-scenes">
          <button v-for="s in scenes" :key="s.key" type="button" class="gs-scene" @click="applyScene(s)">
            <span class="gs-scene-title">{{ s.label }}</span>
            <span class="gs-scene-desc">{{ s.desc }}</span>
          </button>
        </div>
      </template>

      <div class="gs-list-head">
        <span class="gs-label">{{ listTitle }}</span>
        <span v-if="searching" class="gs-total">{{ t('knowledge.hitCount', { count: list.length }) }}</span>
      </div>

      <ul v-if="list.length" class="gs-list">
        <li v-for="(item, i) in list" :key="item.path">
          <button
            type="button"
            class="gs-item"
            :class="{ active: i === activeIndex }"
            @mouseenter="activeIndex = i"
            @click="go(item)"
          >
            <div class="gs-item-top">
              <span class="gs-item-title">
                <template v-for="(p, pi) in parts(item.title)" :key="pi">
                  <mark v-if="p.hit" class="gs-hit">{{ p.text }}</mark>
                  <span v-else>{{ p.text }}</span>
                </template>
              </span>
              <span v-if="item.isNew" class="gs-new">{{ t('knowledge.new') }}</span>
              <span class="gs-item-cat">{{ item.category }}</span>
            </div>
            <p class="gs-item-meta">
              <span v-if="item.group">{{ item.group }}</span>
              <span v-if="item.scenario" class="gs-item-scene">{{ item.scenario }}</span>
              <span v-if="item.addedAt">{{ item.addedAt.slice(5).replace('-', '/') }}</span>
            </p>
            <p class="gs-item-desc">
              <template v-for="(p, pi) in parts(item.summary)" :key="pi">
                <mark v-if="p.hit" class="gs-hit">{{ p.text }}</mark>
                <span v-else>{{ p.text }}</span>
              </template>
            </p>
          </button>
        </li>
      </ul>

      <div v-else class="gs-empty">
        <p class="gs-empty-title">{{ t('knowledge.noResult') }}</p>
        <p class="gs-empty-desc">{{ t('knowledge.noResultDesc') }}</p>
      </div>
    </div>

    <div class="gs-foot">
      <span class="gs-key-hint"><kbd>↑</kbd><kbd>↓</kbd> {{ t('knowledge.move') }}</span>
      <span class="gs-key-hint"><kbd>Enter</kbd> {{ t('knowledge.open') }}</span>
      <span class="gs-foot-total">{{ t('knowledge.totalKnowledge', { count: entries.length }) }}</span>
    </div>
  </el-dialog>
</template>

<style scoped>
.gs-trigger {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  width: 260px;
  height: 32px;
  padding: 0 8px 0 10px;
  border: 1px solid #e6e8eb;
  border-radius: 8px;
  background: #f8fafc;
  color: #8a9099;
  font-size: 12.5px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}
.gs-trigger:hover {
  border-color: #c7d7fb;
  background: #fff;
  color: #2563eb;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
}
.gs-trigger-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-align: left;
  text-overflow: ellipsis;
}
.gs-kbd,
.gs-esc {
  border: 1px solid #e2e6eb;
  border-radius: 4px;
  background: #fff;
  padding: 1px 4px;
  color: #9ca3af;
  font-size: 10px;
  line-height: 1.3;
  font-family: inherit;
}
@media (max-width: 1279px) {
  .gs-trigger {
    width: 206px;
  }
}
@media (max-width: 1023px) {
  .gs-trigger {
    width: 160px;
  }
}
@media (max-width: 767px) {
  .gs-trigger {
    width: 32px;
    padding: 0;
    justify-content: center;
  }
  .gs-trigger-text,
  .gs-kbd {
    display: none;
  }
}

.gs-head {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 13px 15px;
  border-bottom: 1px solid #eef0f3;
}
.gs-head-icon {
  flex: none;
  color: #9ca3af;
}
.gs-input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: #1f2328;
  font-size: 15px;
}
.gs-input::placeholder {
  color: #9ca3af;
}

.gs-filter {
  display: flex;
  gap: 6px;
  padding: 9px 15px;
  overflow-x: auto;
  border-bottom: 1px solid #f3f4f6;
}
.gs-filter::-webkit-scrollbar {
  height: 0;
}
.gs-chip {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 9px;
  border: 1px solid #e6e8eb;
  border-radius: 999px;
  background: #fff;
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.gs-chip:hover {
  border-color: #c7d7fb;
  color: #2563eb;
}
.gs-chip.on {
  border-color: #dbe7ff;
  background: #eef4ff;
  color: #2563eb;
  font-weight: 500;
}
.gs-count {
  color: #9ca3af;
  font-size: 10.5px;
}
.gs-chip.on .gs-count {
  color: #6e9aee;
}

.gs-body {
  max-height: min(58vh, 520px);
  padding: 4px 8px 8px;
  overflow-y: auto;
}
.gs-label {
  margin: 8px 8px 6px;
  color: #9ca3af;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.gs-scenes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 0 4px 6px;
}
.gs-scene {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid #eef0f3;
  border-radius: 9px;
  background: #fbfcfd;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}
.gs-scene:hover {
  border-color: #dbe7ff;
  background: #f5f9ff;
}
.gs-scene-title {
  color: #1f2328;
  font-size: 12.5px;
  font-weight: 500;
}
.gs-scene-desc {
  color: #9ca3af;
  font-size: 11px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.gs-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 8px;
}
.gs-total {
  color: #9ca3af;
  font-size: 11px;
}
.gs-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.gs-item {
  display: block;
  width: 100%;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.gs-item.active {
  border-color: #e4edff;
  background: #f3f8ff;
}
.gs-item-top {
  display: flex;
  align-items: center;
  gap: 6px;
}
.gs-item-title {
  flex: 1;
  min-width: 0;
  color: #1f2328;
  font-size: 13.5px;
  font-weight: 500;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.gs-new {
  flex: none;
  padding: 0 4px;
  border-radius: 4px;
  background: #eef4ff;
  color: #2563eb;
  font-size: 9.5px;
  font-weight: 600;
  line-height: 15px;
}
.gs-item-cat {
  flex: none;
  color: #9ca3af;
  font-size: 11px;
}
.gs-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 3px 0 0;
  color: #9ca3af;
  font-size: 11px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.gs-item-scene {
  padding: 0 6px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 10.5px;
  line-height: 16px;
}
.gs-item-desc {
  display: -webkit-box;
  margin: 3px 0 0;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.5;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.gs-hit {
  background: #fef3c7;
  color: #92400e;
  border-radius: 2px;
  padding: 0 1px;
}

.gs-empty {
  padding: 34px 16px 40px;
  text-align: center;
}
.gs-empty-title {
  margin: 0;
  color: #4b5563;
  font-size: 13px;
}
.gs-empty-desc {
  margin: 5px 0 0;
  color: #9ca3af;
  font-size: 11.5px;
}

.gs-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 15px;
  border-top: 1px solid #f3f4f6;
  color: #9ca3af;
  font-size: 11px;
}
.gs-foot kbd {
  margin-right: 3px;
  padding: 0 4px;
  border: 1px solid #e6e8eb;
  border-radius: 4px;
  background: #fafbfc;
  font-family: inherit;
  font-size: 10px;
}
.gs-foot-total {
  margin-left: auto;
}
@media (max-width: 479px) {
  .gs-foot {
    gap: 8px;
  }
  .gs-foot-total {
    display: none;
  }
}

:global(.gs-dialog) {
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.18);
}
:global(.gs-dialog .el-dialog__header) {
  display: none;
}
:global(.gs-dialog .el-dialog__body) {
  padding: 0;
}
</style>
