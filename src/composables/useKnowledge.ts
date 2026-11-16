import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { i18n, type AppLocale } from '@/i18n'
import { useUserStore } from '@/store/user'
import type { MenuItem } from '@/types/global'
import { knowledgeMeta, searchScenes, type LocaleText } from '@/data/knowledge'
import { changelog } from '@/data/changelog'

/** 统一的搜索条目：菜单树 + 知识元数据 */
export interface KnowledgeEntry {
  path: string
  /** 菜单 i18n key */
  i18nKey: string
  title: string
  titleZh: string
  titleEn: string
  /** 顶层技术分类（菜单 key） */
  categoryKey: string
  category: string
  /** 所属分组路径，如「工具 / 空间量算」 */
  group: string
  summary: string
  keywords: string[]
  scenario: string
  addedAt: string
  isNew: boolean
  /** 用于兜底全文匹配的小写串 */
  haystack: string
}

export interface KnowledgeCategory {
  key: string
  label: string
  count: number
}

interface LeafDraft {
  path: string
  i18nKey: string
  categoryKey: string
  groupKeys: string[]
}

/** NEW 标记的时间窗口 */
const NEW_WINDOW_MS = 14 * 24 * 3600 * 1000
const metaMap = new Map(knowledgeMeta.map((m) => [m.path, m]))

/** 从角色菜单树里收集所有可访问的示例页（排除首页与系统管理） */
function collectLeaves(menus: MenuItem[], out: LeafDraft[]) {
  const walk = (menu: MenuItem, categoryKey: string, groupKeys: string[]) => {
    if (!menu.children?.length) {
      if (!menu.path || !menu.component) return
      if (menu.path === '/home' || menu.path.startsWith('/system')) return
      if (!categoryKey) return
      out.push({ path: menu.path, i18nKey: menu.key, categoryKey, groupKeys })
      return
    }
    menu.children.forEach((child) => {
      const isTop = !categoryKey
      walk(child, isTop ? menu.key : categoryKey, isTop ? [] : [...groupKeys, menu.key])
    })
  }
  menus.forEach((menu) => walk(menu, '', []))
}

/**
 * 直接读原始语言包，避免为了生成双语检索串而反复编译消息
 * （消息里出现 `<` 时 vue-i18n 会刷 XSS 警告）。
 */
function rawMessage(key: string, loc: AppLocale): string | undefined {
  const messages = (i18n.global as any).messages
  const dict = messages?.value ? messages.value[loc] : messages?.[loc]
  if (!dict) return undefined
  let node: any = dict
  for (const seg of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined
    node = node[seg]
  }
  return typeof node === 'string' ? node : undefined
}

export function useKnowledge() {
  const { t, locale } = useI18n()
  const userStore = useUserStore()

  const currentLocale = computed<AppLocale>(() => (locale.value === 'en' ? 'en' : 'zh-CN'))
  const tr = (key: string, loc?: AppLocale) =>
    rawMessage(key, loc ?? currentLocale.value) ?? ((t as any)(key) as string)
  const pick = (text: LocaleText) => (locale.value === 'en' ? text.en : text.zh)

  const entries = computed<KnowledgeEntry[]>(() => {
    const leaves: LeafDraft[] = []
    collectLeaves(userStore.menus, leaves)
    const now = Date.now()

    return leaves.map((leaf) => {
      const meta = metaMap.get(leaf.path)
      const titleZh = tr(leaf.i18nKey, 'zh-CN')
      const titleEn = tr(leaf.i18nKey, 'en')
      const categoryZh = tr(leaf.categoryKey, 'zh-CN')
      const categoryEn = tr(leaf.categoryKey, 'en')
      const groupZh = leaf.groupKeys.map((k) => tr(k, 'zh-CN')).join(' / ')
      const groupEn = leaf.groupKeys.map((k) => tr(k, 'en')).join(' / ')
      const group = locale.value === 'en' ? groupEn || categoryEn : groupZh || categoryZh

      const summary = meta
        ? pick(meta.summary)
        : locale.value === 'en'
          ? `${group} demo · ${titleEn}`
          : `${group}示例 · ${titleZh}`

      const keywords = [
        ...(meta?.keywords.zh ?? []),
        ...(meta?.keywords.en ?? []),
        titleZh,
        titleEn,
        categoryZh,
        categoryEn,
        ...leaf.groupKeys.map((k) => tr(k, 'zh-CN')),
        ...leaf.groupKeys.map((k) => tr(k, 'en')),
      ]

      const addedAt = meta?.addedAt ?? ''
      const isNew = !!addedAt && now - new Date(`${addedAt}T00:00:00`).getTime() <= NEW_WINDOW_MS

      return {
        path: leaf.path,
        i18nKey: leaf.i18nKey,
        title: tr(leaf.i18nKey),
        titleZh,
        titleEn,
        categoryKey: leaf.categoryKey,
        category: locale.value === 'en' ? categoryEn : categoryZh,
        group,
        summary,
        keywords,
        scenario: meta?.scenario ? pick(meta.scenario) : '',
        addedAt,
        isNew,
        haystack: [leaf.path, titleZh, titleEn, categoryZh, categoryEn, groupZh, groupEn, summary, ...keywords]
          .join(' ')
          .toLowerCase(),
      }
    })
  })

  const categories = computed<KnowledgeCategory[]>(() => {
    const map = new Map<string, KnowledgeCategory>()
    entries.value.forEach((e) => {
      const hit = map.get(e.categoryKey)
      if (hit) hit.count += 1
      else map.set(e.categoryKey, { key: e.categoryKey, label: e.category, count: 1 })
    })
    return [...map.values()]
  })

  /** 最近新增（有登记 addedAt 的条目） */
  const recent = computed(() =>
    entries.value
      .filter((e) => e.addedAt)
      .slice()
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt) || a.title.localeCompare(b.title)),
  )

  const scenes = computed(() =>
    searchScenes.map((s) => ({
      key: s.key,
      label: pick(s.label),
      desc: pick(s.desc),
      query: pick(s.query),
      category: s.category ?? '',
    })),
  )

  const changes = computed(() =>
    changelog.map((c) => ({
      ...c,
      title: pick(c.title),
      desc: c.desc ? pick(c.desc) : '',
      typeLabel: tr(`changelog.${c.type}`),
    })),
  )

  /** 按日期分组的更新动态，供时间线渲染 */
  const changeGroups = computed(() => {
    const groups = new Map<string, typeof changes.value>()
    changes.value.forEach((c) => {
      const list = groups.get(c.date)
      if (list) list.push(c)
      else groups.set(c.date, [c])
    })
    return [...groups.entries()].map(([date, items]) => ({ date, items }))
  })

  /** 单 token 命中打分 */
  function scoreOne(entry: KnowledgeEntry, token: string) {
    const title = entry.title.toLowerCase()
    if (title === token) return 100
    if (title.startsWith(token)) return 80
    if (title.includes(token)) return 60
    if (entry.keywords.some((k) => k.toLowerCase().includes(token))) return 45
    if (entry.summary.toLowerCase().includes(token)) return 35
    if (entry.group.toLowerCase().includes(token) || entry.category.toLowerCase().includes(token)) return 30
    if (entry.scenario.toLowerCase().includes(token)) return 28
    if (entry.haystack.includes(token)) return 20
    return 0
  }

  /**
   * 全文搜索：标题 > 关键词 > 摘要 > 分类 / 分组 > 路径。
   * 空格分词需要全部命中，多词时额外加分。
   */
  function search(keyword: string, category = ''): KnowledgeEntry[] {
    const pool = category ? entries.value.filter((e) => e.categoryKey === category) : entries.value
    const q = keyword.trim().toLowerCase()
    if (!q) return pool

    const tokens = q.split(/\s+/).filter(Boolean)
    const scored = pool.map((entry) => {
      let total = 0
      for (const token of tokens) {
        const s = scoreOne(entry, token)
        if (!s) return { entry, score: 0 }
        total += s
      }
      return { entry, score: total / tokens.length + (tokens.length > 1 ? 10 : 0) }
    })

    return scored
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.entry.addedAt.localeCompare(a.entry.addedAt) || a.entry.title.localeCompare(b.entry.title))
      .map((x) => x.entry)
  }

  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

  /** 相对日期：今天 / 昨天 / N 天前 / N 周前 */
  function relativeDay(iso: string) {
    if (!iso) return ''
    const day = new Date(`${iso}T00:00:00`).getTime()
    const diff = Math.floor((startOfToday - day) / 86400000)
    if (diff <= 0) return tr('knowledge.today')
    if (diff === 1) return tr('knowledge.yesterday')
    if (diff < 7) return (t as any)('knowledge.daysAgo', { n: diff }) as string
    if (diff < 30) return (t as any)('knowledge.weeksAgo', { n: Math.floor(diff / 7) }) as string
    return iso.slice(5).replace('-', '/')
  }

  /** 时间线日期：MM/DD */
  function shortDate(iso: string) {
    return iso.slice(5).replace('-', '/')
  }

  return {
    entries,
    categories,
    recent,
    scenes,
    changes,
    changeGroups,
    search,
    relativeDay,
    shortDate,
  }
}
