<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import GuidePanel from '@/components/GuidePanel.vue'
import { guideBlocks, notes } from './guide'
import { WsPlayerHost, wsProtocolOf, type WsPlayerAdapter, type WsRecordFile } from '@/utils/video/wsplayer'

/** 回放容器 id，必须与实时预览页的容器区分开 */
const STAGE_ID = 'ws-record-stage'

const host = new WsPlayerHost()

type Status = 'loading' | 'ready' | 'error'
const status = ref<Status>('loading')
const statusText = ref('正在按需加载解码库…')
const errorMsg = ref('')
const playing = ref(false)
const paused = ref(false)

const isHttps = window.location.protocol === 'https:'
const now = Date.now()

const form = reactive({
  wsURL: isHttps ? 'wss://192.168.1.1:9322' : 'ws://192.168.1.1:9320',
  rtspURL: '',
  channelId: '',
  selectIndex: 0,
})

/** 当前实例使用的协议：以 ws 地址为准，地址没写协议时随页面 */
const protocol = ref<'ws' | 'wss'>(wsProtocolOf(form.wsURL) ?? (isHttps ? 'wss' : 'ws'))

/** 回放时间段，秒级时间戳提交 */
const range = ref<[Date, Date]>([new Date(now - 30 * 60 * 1000), new Date(now)])
/** 录像段列表（QueryRecords 返回的 records），文本形式便于粘贴 */
const recordsText = ref('')

/** 跳转时间点 */
const jumpTime = ref<Date | null>(null)
const speed = ref(1)

const num = ref(1)
const adapter = ref<WsPlayerAdapter>('selfAdaption')

interface LogItem {
  time: string
  method: string
  text: string
}
const logs = ref<LogItem[]>([])

function pushLog(method: string, text: string) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  logs.value.unshift({ time, method, text })
  if (logs.value.length > 30) logs.value.pop()
}

/** 事件数据压缩成一行，够看就行 */
function brief(data: unknown) {
  if (data === undefined || data === null) return ''
  try {
    const text = typeof data === 'string' ? data : JSON.stringify(data)
    return text.length > 90 ? `${text.slice(0, 90)}…` : text
  } catch {
    return ''
  }
}

function toSecond(date: Date) {
  return Math.floor(date.getTime() / 1000)
}

function onMessage(method: string, data: any, err?: any) {
  switch (method) {
    case 'initializationCompleted':
      status.value = 'ready'
      statusText.value = '解码库初始化完成'
      host.setPlayerAdapter(adapter.value)
      pushLog(method, '可以调用 recordByUrl 了')
      break
    case 'recordSuccess':
      playing.value = true
      paused.value = false
      pushLog(method, `窗口 ${data?.selectIndex ?? 0} 回放开始`)
      break
    case 'recordError':
      playing.value = false
      pushLog(method, brief(err) || '回放失败：该时段可能没有录像，或 token 已过期')
      break
    case 'recordFinish':
      playing.value = false
      pushLog(method, '录像已播完，可重新选择时间段')
      break
    case 'switchStartTime':
      // 只给时间戳，新地址要自己重新请求
      pushLog(method, `拖到 ${data?.timeStamp ?? '-'}（秒级），需要重新取 rtsp 再 recordByUrl`)
      break
    case 'closeVideo':
      playing.value = false
      pushLog(method, `窗口 ${data?.selectIndex ?? 0} 已关闭`)
      break
    case 'windowNumChanged':
      pushLog(method, brief(data))
      break
    case 'errorInfo':
      pushLog(method, brief(err) || brief(data))
      break
    default:
      break
  }
}

async function initPlayer() {
  status.value = 'loading'
  errorMsg.value = ''
  statusText.value = '正在按需加载解码库（首次进入才下载，之后走缓存）…'
  try {
    await host.init({
      el: STAGE_ID,
      type: 'record',
      num: num.value,
      maxNum: 16,
      protocol: protocol.value,
      onMessage,
    })
    statusText.value = '解码库已加载，等待播放器初始化…'
  } catch (e: any) {
    status.value = 'error'
    errorMsg.value = e?.message || String(e)
    pushLog('error', errorMsg.value)
  }
}

/** 解析录像段，空文本视为不传 */
function parseRecords(): WsRecordFile[] | null {
  const text = recordsText.value.trim()
  if (!text) return []
  try {
    const data = JSON.parse(text)
    if (!Array.isArray(data)) {
      ElMessage.error('录像文件要填 JSON 数组（平台 QueryRecords 接口返回的 records）')
      return null
    }
    return data
  } catch {
    ElMessage.error('录像文件不是合法 JSON，请检查粘贴内容')
    return null
  }
}

/**
 * 地址协议和实例协议不一致时重建实例：页面是 http 也能连 wss://
 * 返回 true 表示已重建，此时 recordByUrl 会被挂起，初始化完成后自动回放
 */
async function ensureProtocol(): Promise<boolean> {
  const want = wsProtocolOf(form.wsURL) ?? protocol.value
  if (want === protocol.value) return false
  protocol.value = want
  pushLog('protocol', `websocket 改用 ${want}，重建播放器实例`)
  await initPlayer()
  return true
}

async function play() {
  if (!form.rtspURL.trim()) return ElMessage.warning('请填写回放 rtsp 地址（时间形式回放，需带 token）')
  if (!form.wsURL.trim()) return ElMessage.warning('请填写回放 websocket 地址（默认 9320 / 9322）')
  if (!form.channelId.trim()) return ElMessage.warning('请填写通道编码')

  const records = parseRecords()
  if (records === null) return

  const rebuilt = await ensureProtocol()
  if (!rebuilt && status.value !== 'ready') return ElMessage.warning('解码库尚未初始化完成')

  const [start, end] = range.value
  host.recordByUrl({
    rtspURL: form.rtspURL.trim(),
    wsURL: form.wsURL.trim(),
    channelId: form.channelId.trim(),
    records,
    selectIndex: Number(form.selectIndex),
    startTime: start ? toSecond(start) : undefined,
    endTime: end ? toSecond(end) : undefined,
    playerAdapter: adapter.value,
    channelData: { channelId: form.channelId.trim(), records },
  })
  pushLog('recordByUrl', `窗口 ${form.selectIndex} 发起回放，records ${records.length} 段（${protocol.value}）`)
}

/** 时间对齐到整分钟，避免示例数据出现零头 */
function floorMinute(date: Date, offsetMinutes = 0) {
  const d = new Date(date)
  d.setSeconds(0, 0)
  d.setMinutes(d.getMinutes() + offsetMinutes)
  return d
}

function fillSample() {
  const start = floorMinute(new Date(now - 30 * 60 * 1000))
  const end = floorMinute(new Date(now))
  const step = Math.max(60, Math.floor((toSecond(end) - toSecond(start)) / 3))
  const segments = [0, 1, 2].map((i) => ({
    startTime: toSecond(start) + i * step,
    endTime: toSecond(start) + (i + 1) * step - 1,
  }))

  form.wsURL = isHttps ? 'wss://192.168.1.1:9322' : 'ws://192.168.1.1:9320'
  form.rtspURL = 'rtsp://192.168.1.1:9320/playback/pu/11?token=157438'
  form.channelId = '1000006$0'
  form.selectIndex = 0
  range.value = [start, end]
  recordsText.value = JSON.stringify(segments, null, 2)
  ElMessage.success('已填入示例，记得把 records 换成接口真实返回的数组')
}

function pause() {
  host.pause(Number(form.selectIndex))
  paused.value = true
  pushLog('pause', `窗口 ${form.selectIndex} 暂停`)
}

function resume() {
  host.resume(Number(form.selectIndex))
  paused.value = false
  pushLog('play', `窗口 ${form.selectIndex} 继续播放`)
}

function changeSpeed(value: number | string | boolean | undefined) {
  const rate = Number(value)
  if (!Number.isFinite(rate)) return
  speed.value = rate
  host.playSpeed(rate, Number(form.selectIndex))
  pushLog('playSpeed', `窗口 ${form.selectIndex} 切成 ${rate} 倍速`)
}

function jumpTo() {
  if (!jumpTime.value) return ElMessage.warning('先选择要跳转的时间点')
  const second = toSecond(jumpTime.value)
  host.jumpPlayByTime(second, Number(form.selectIndex), true)
  pushLog('jumpPlayByTime', `跳到 ${second}（秒级时间戳）`)
}

function closeAll() {
  host.close()
  playing.value = false
  paused.value = false
  pushLog('close', '已关闭全部窗口')
}

function changeNum(value: string | number | boolean | undefined) {
  const count = Number(value)
  if (!Number.isFinite(count)) return
  num.value = count
  host.setPlayerNum(count)
}

function changeAdapter(value: string | number | boolean | undefined) {
  if (value !== 'selfAdaption' && value !== 'stretching') return
  adapter.value = value
  host.setPlayerAdapter(value)
}

function clearLogs() {
  logs.value = []
}

onMounted(initPlayer)

onBeforeUnmount(() => {
  // 回放实例同样持有 worker / webgl，离开页面必须释放
  host.destroy(STAGE_ID)
})

const stageStatusText = () => {
  if (status.value === 'loading') return statusText.value
  if (status.value === 'error') return '解码库加载失败'
  if (!playing.value) return '就绪'
  return paused.value ? '已暂停' : '回放中'
}
</script>

<template>
  <div class="video-page">
    <section class="stage-wrap">
      <div class="hint">
        <el-icon><InfoFilled /></el-icon>
        <span class="hint-text">
          大华 WSPlayer 历史回放：与实时预览共用一套解码库，但要建 <code>type: 'record'</code> 的实例；回放端口为 9320 / 9322，
          <code>records</code> 不传则进度条不可拖拽，拖拽后必须重新取 rtsp。
        </span>
        <span class="status-chip" :class="status">
          <i class="dot" />
          {{ stageStatusText() }}
        </span>
      </div>

      <div class="stage-card">
        <div :id="STAGE_ID" class="stage" />

        <div v-if="status === 'error'" class="stage-mask">
          <el-icon class="warn-icon"><WarningFilled /></el-icon>
          <p class="mask-title">解码库加载失败</p>
          <p class="mask-desc">{{ errorMsg }}</p>
          <p class="mask-tip">
            检查 <code>public/wsplayer/WSPlayer</code> 是否存在、服务器是否支持 <code>.wasm</code> / <code>.data</code> 的 MIME 类型，以及页面能否直接访问解码库地址。
          </p>
          <el-button type="primary" @click="initPlayer">重新加载</el-button>
        </div>
      </div>

      <div class="ops-card">
        <div class="field-row">
          <label class="field">
            <span class="label">回放 websocket 地址</span>
            <el-input v-model="form.wsURL" size="small" placeholder="ws://ip:9320 或 wss://ip:9322" />
          </label>
          <label class="field grow">
            <span class="label">回放 rtsp 地址（时间形式回放，含 token）</span>
            <el-input v-model="form.rtspURL" size="small" placeholder="rtsp://ip:9320/playback/pu/11?token=xxx" />
          </label>
          <label class="field">
            <span class="label">通道编码</span>
            <el-input v-model="form.channelId" size="small" placeholder="如 1000006$0" />
          </label>
          <label class="field sm">
            <span class="label">窗口号</span>
            <el-input-number v-model="form.selectIndex" size="small" :min="0" :max="15" controls-position="right" />
          </label>
        </div>

        <div class="field-row">
          <label class="field grow">
            <span class="label">回放时间段（秒级时间戳提交，不传则由 records 截取）</span>
            <el-date-picker
              v-model="range"
              type="datetimerange"
              size="small"
              start-placeholder="开始时间"
              end-placeholder="结束时间"
              format="YYYY-MM-DD HH:mm"
            />
          </label>
          <label class="field auto">
            <span class="label">倍速</span>
            <el-select :model-value="speed" size="small" @update:model-value="changeSpeed">
              <el-option v-for="s in [0.125, 0.25, 0.5, 1, 1.25, 1.5, 2, 4, 8]" :key="s" :value="s" :label="`${s}x`" />
            </el-select>
          </label>
          <label class="field jump">
            <span class="label">跳转到指定时间点</span>
            <div class="jump-box">
              <el-date-picker
                v-model="jumpTime"
                type="datetime"
                size="small"
                placeholder="选择时间"
                format="YYYY-MM-DD HH:mm:ss"
              />
              <el-button :disabled="status !== 'ready' || !jumpTime" @click="jumpTo">跳转</el-button>
            </div>
          </label>
        </div>

        <div class="field-row">
          <label class="field records">
            <span class="label">
              录像文件 records（QueryRecords 返回的数组，原样粘贴；不传则进度条不可拖拽）
            </span>
            <el-input
              v-model="recordsText"
              type="textarea"
              :rows="2"
              resize="none"
              placeholder='[{"startTime": 1700000000, "endTime": 1700003600}]'
            />
          </label>
        </div>

        <div class="btn-row">
          <el-button type="primary" :disabled="status !== 'ready'" @click="play">开始回放</el-button>
          <el-button :disabled="status !== 'ready' || !playing" @click="pause">暂停</el-button>
          <el-button :disabled="status !== 'ready' || !paused" @click="resume">继续</el-button>
          <el-button :disabled="status !== 'ready'" @click="closeAll">关闭全部</el-button>
          <el-button link type="primary" @click="fillSample">填入示例</el-button>
          <span class="divider" />
          <span class="label">分屏</span>
          <el-radio-group :model-value="num" size="small" :disabled="status !== 'ready'" @update:model-value="changeNum">
            <el-radio-button :value="1">1</el-radio-button>
            <el-radio-button :value="4">4</el-radio-button>
            <el-radio-button :value="9">9</el-radio-button>
            <el-radio-button :value="16">16</el-radio-button>
          </el-radio-group>
          <span class="divider" />
          <span class="label">画面</span>
          <el-radio-group
            :model-value="adapter"
            size="small"
            :disabled="status !== 'ready'"
            @update:model-value="changeAdapter"
          >
            <el-radio-button value="selfAdaption">原始比例</el-radio-button>
            <el-radio-button value="stretching">铺满</el-radio-button>
          </el-radio-group>
        </div>

        <div class="log-row">
          <div class="log-head">
            <span class="label">播放器事件</span>
            <button type="button" class="clear-btn" @click="clearLogs">清空</button>
          </div>
          <ul class="logs">
            <li v-if="!logs.length" class="empty">暂无事件，发起回放后这里会打印 recordSuccess / recordFinish / switchStartTime 等回调</li>
            <li v-for="(l, i) in logs" :key="i">
              <span class="time">{{ l.time }}</span>
              <span class="method">{{ l.method }}</span>
              <span class="text">{{ l.text }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <GuidePanel
      class="side-pane"
      title="回放说明"
      :blocks="guideBlocks"
      :notes="notes"
      notes-tip="以下为对接大华无插件播放器时的高频问题，按「先能播、再播好、再排错」的顺序整理。"
    />
  </div>
</template>

<style scoped>
.video-page {
  display: flex;
  height: 100%;
  min-height: 0;
  gap: 8px;
  padding: 8px;
}
.stage-wrap {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}
.hint {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid #dbeafe;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 12px;
  line-height: 1.55;
}
.hint-text {
  flex: 1;
  min-width: 0;
}
.hint code {
  padding: 0 3px;
  border-radius: 3px;
  background: rgba(37, 99, 235, 0.1);
  font-size: 11px;
}
.status-chip {
  display: flex;
  flex: none;
  align-items: center;
  gap: 5px;
  max-width: 240px;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid rgba(37, 99, 235, 0.16);
  background: rgba(255, 255, 255, 0.75);
  color: #475569;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.status-chip .dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f59e0b;
}
.status-chip.ready .dot {
  background: #22c55e;
}
.status-chip.error .dot {
  background: #ef4444;
}
.stage-card {
  position: relative;
  flex: 1;
  min-height: 220px;
  border-radius: 12px;
  overflow: hidden;
  background: #0b1623;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
}
.stage {
  position: absolute;
  inset: 0;
}
.stage-mask {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 6px;
  padding: 24px;
  background: rgba(11, 22, 35, 0.94);
  text-align: center;
}
.warn-icon {
  font-size: 30px;
  color: #f59e0b;
}
.mask-title {
  margin: 0;
  color: #e2e8f0;
  font-size: 14px;
  font-weight: 600;
}
.mask-desc {
  margin: 0;
  max-width: 620px;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-all;
}
.mask-tip {
  margin: 0 0 6px;
  max-width: 620px;
  color: #64748b;
  font-size: 11.5px;
  line-height: 1.6;
}
.mask-tip code {
  padding: 0 3px;
  border-radius: 3px;
  background: rgba(148, 163, 184, 0.16);
  color: #cbd5e1;
}

.ops-card {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.1);
}
.field-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px;
}
.field {
  display: flex;
  flex: 0 1 140px;
  min-width: 120px;
  flex-direction: column;
  gap: 3px;
}
.field.grow {
  flex: 1 1 240px;
  min-width: 200px;
}
.field.sm {
  flex: 0 0 84px;
  min-width: 84px;
}
.field.records {
  flex: 1 1 100%;
  min-width: 260px;
}
.field.auto {
  flex: 0 0 84px;
  min-width: 84px;
}
.field.jump {
  flex: 0 1 320px;
  min-width: 260px;
}
.jump-box {
  display: flex;
  gap: 6px;
}
.jump-box :deep(.el-date-editor) {
  flex: 1;
  min-width: 0;
}
.field :deep(.el-input-number),
.field :deep(.el-date-editor) {
  width: 100%;
}
.label {
  color: #94a3b8;
  font-size: 11px;
  white-space: nowrap;
}
.btn-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.btn-row .divider {
  width: 1px;
  height: 16px;
  background: #e2e8f0;
}
.log-row {
  border-top: 1px dashed #e2e8f0;
  padding-top: 5px;
}
.log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.clear-btn {
  padding: 0 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #94a3b8;
  font-size: 11px;
  cursor: pointer;
}
.clear-btn:hover {
  color: #2563eb;
  background: #eff6ff;
}
.logs {
  margin: 2px 0 0;
  padding: 0;
  height: 58px;
  overflow: auto;
  list-style: none;
  font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
  font-size: 11px;
  line-height: 1.55;
  color: #475569;
}
.logs li {
  display: flex;
  gap: 8px;
  padding: 1px 0;
}
.logs .empty {
  color: #b6c2d2;
  font-style: italic;
}
.logs .time {
  flex: none;
  color: #cbd5e1;
}
.logs .method {
  flex: none;
  padding: 0 4px;
  height: 15px;
  line-height: 15px;
  border-radius: 4px;
  background: #eff6ff;
  color: #2563eb;
}
.logs .text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.side-pane {
  flex: none;
  width: 460px;
}
@media (max-width: 1366px) {
  .side-pane {
    width: 380px;
  }
}
</style>
