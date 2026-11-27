<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  wsPlaybackCodeAliases,
  wsPlaybackEnglishFallback,
  wsPlaybackEnglishMessages,
  wsPlaybackFallback,
  wsPlaybackMessages,
} from '@/utils/video/wsplayer-errors'

const query = ref('')
const rows = Object.entries(wsPlaybackMessages).map(([value, message]) => {
  const code = Number(value) as keyof typeof wsPlaybackMessages
  return { code, message, english: wsPlaybackEnglishMessages[code], callback: wsPlaybackCodeAliases[code] }
})
const filteredRows = computed(() => {
  const term = query.value.trim().toLowerCase()
  return rows.filter(({ code, message, english, callback }) =>
    [code, message, english, callback ?? ''].some(value => String(value).toLowerCase().includes(term)),
  )
})
</script>

<template>
  <article class="error-reference" aria-labelledby="ws-error-title">
    <header class="reference-header">
      <p class="reference-kicker">WSPlayer · 播放排障</p>
      <h1 id="ws-error-title">流解析错误码</h1>
      <p class="reference-intro">在实时画面或历史回放的「播放器事件」里找到播放错误码，再按错误码或中英文提示词查询。</p>
    </header>

    <aside class="parse-note" aria-label="流类型解析失败">
      <code>406</code>
      <div>
        <strong>{{ wsPlaybackMessages[406] }}</strong>
        <p class="english-message" lang="en">{{ wsPlaybackEnglishMessages[406] }}</p>
        <p>优先核对通道编码、主／辅码流是否启用，以及流媒体服务实际返回的码流类型。</p>
      </div>
    </aside>

    <section class="reference-list" aria-labelledby="ws-error-list-title">
      <div class="table-toolbar">
        <div>
          <h2 id="ws-error-list-title">错误码与提示词</h2>
          <p role="status">显示 {{ filteredRows.length }} / {{ rows.length }} 条</p>
        </div>
        <el-input v-model="query" class="code-search" aria-label="搜索错误码或提示词" placeholder="搜索错误码或提示词" clearable />
      </div>
      <table>
        <colgroup><col class="table-code-col"><col></colgroup>
        <thead><tr><th scope="col">错误码</th><th scope="col">中英文提示词</th></tr></thead>
        <tbody>
          <tr v-for="row in filteredRows" :key="row.code" :class="{ 'parse-row': row.code === 406 }">
            <th scope="row"><code>{{ row.code }}</code></th>
            <td>
              {{ row.message }}
              <span v-if="row.callback" class="code-alias">回调归并为 <code>{{ row.callback }}</code></span>
              <span v-else-if="row.code === 203 || row.code === 411" class="code-alias">播放结束，非故障</span>
              <div class="english-message">
                <span lang="en">{{ row.english }}</span><span v-if="row.code === 100" class="code-alias">参考译文</span>
              </div>
            </td>
          </tr>
          <tr v-if="!filteredRows.length"><td colspan="2" class="empty-result">未找到匹配项，请换一个错误码或提示词。</td></tr>
        </tbody>
      </table>
    </section>

    <section class="reference-notes" aria-labelledby="ws-error-notes-title">
      <h2 id="ws-error-notes-title">对照时注意</h2>
      <ul>
        <li>拉流错误以 <code>realError</code>／<code>recordError</code> 回调中的 <code>err.code</code> 为准。<code>errorInfo</code> 是另一套业务码；浏览器网络面板的 HTTP 状态也不是这张表的错误码。</li>
        <li>WebSocket 连接报 <code>202</code> 时，<code>wss://</code> 保留证书错误提示，<code>ws://</code> 在播放错误处理中归并为 <code>254</code>（网络异常）。</li>
        <li>未匹配到提示词时，播放窗口可能显示「{{ wsPlaybackFallback }}」或 <span lang="en">{{ wsPlaybackEnglishFallback }}</span>。排查时请同时保留原始错误码和回调名。</li>
      </ul>
      <p class="reference-source">来源：项目内置 <code>WSPlayer.js</code> 的 <code>errorVideoInfo</code> 与中英文语言包。<code>100</code> 没有独立的英文词条，已标明参考译文。</p>
    </section>
  </article>
</template>

<style scoped>
.error-reference { height: 100%; overflow: auto; padding: clamp(14px, 3vw, 32px); color: #1f2937; background: #fff; }
.reference-header, .parse-note, .reference-list, .reference-notes { max-width: 860px; margin-inline: auto; }
.reference-kicker { margin: 0 0 5px; color: #526174; font-size: 12px; font-weight: 600; }
h1 { margin: 0; font-size: clamp(21px, 3vw, 28px); line-height: 1.3; }
.reference-intro { margin: 8px 0 0; color: #526174; font-size: 14px; line-height: 1.6; }
.parse-note { display: flex; align-items: flex-start; gap: 12px; margin-block: 18px; padding: 12px 14px; border: 1px solid #dbeafe; border-radius: 8px; background: #eff6ff; color: #1e3a66; font-size: 14px; }
.parse-note > code { padding: 2px 6px; background: #fff; border: 1px solid #c9defb; border-radius: 4px; color: #17438c; font-weight: 700; }
.parse-note p { margin: 3px 0 0; line-height: 1.5; }
.reference-list { overflow: hidden; border: 1px solid #e2e8f0; border-radius: 8px; }
.table-toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px 16px; padding: 12px 14px; }
h2 { margin: 0; font-size: 15px; }
.table-toolbar p { margin: 3px 0 0; color: #526174; font-size: 12px; }
.code-search { width: min(100%, 260px); }
table { width: 100%; border-collapse: collapse; table-layout: fixed; text-align: left; font-size: 13px; }
.table-code-col { width: clamp(70px, 16%, 126px); }
th, td { padding: 8px 14px; border-top: 1px solid #e7edf4; overflow-wrap: anywhere; }
thead th { background: #f6f8fb; color: #465568; }
tbody th { font-weight: 600; }
tr.parse-row { background: #f0f6ff; }
.english-message { margin-top: 3px; color: #465568; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.code-alias { display: inline-block; margin-left: 7px; color: #526174; font-size: 12px; }
.empty-result { color: #526174; padding-block: 20px; text-align: center; }
.reference-notes { margin-block: 18px 0; color: #465568; font-size: 13px; line-height: 1.6; }
.reference-notes h2 { color: #1f2937; }
.reference-notes ul { margin-block: 6px; padding-left: 20px; }
.reference-source { color: #526174; font-size: 12px; overflow-wrap: anywhere; }
</style>
