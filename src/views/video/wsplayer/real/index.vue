<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import GuidePanel from '../../GuidePanel.vue'
import { guideBlocks, notes } from './guide'
import { WsPlayerHost, wsProtocolOf, type WsPlayerAdapter } from '@/utils/video/wsplayer'

/** 播放器挂载容器 id，WSPlayer 会直接往里塞分屏 DOM */
const STAGE_ID = 'ws-player-stage'

const host = new WsPlayerHost()

type Status = 'loading' | 'ready' | 'error'
const status = ref<Status>('loading')
const statusText = ref('正在按需加载解码库…')
const errorMsg = ref('')
const playing = ref(false)

const isHttps = window.location.protocol === 'https:'

const form = reactive({
  wsURL: isHttps ? 'wss://192.168.1.1:9102' : 'ws://192.168.1.1:9100',
  rtspURL: '',
  channelId: '',
  streamType: 1,
  selectIndex: 0,
})

/** 当前实例使用的协议：以 ws 地址为准，地址没写协议时随页面 */
const protocol = ref<'ws' | 'wss'>(wsProtocolOf(form.wsURL) ?? (isHttps ? 'wss' : 'ws'))

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

function onMessage(method: string, data: any, err?: any) {
  switch (method) {
    case 'initializationCompleted':
      status.value = 'ready'
      statusText.value = '解码库初始化完成'
      host.setPlayerAdapter(adapter.value)
      pushLog(method, '可以调用播放方法了')
      break
    case 'realSuccess':
      playing.value = true
      pushLog(method, `窗口 ${data?.selectIndex ?? 0} 播放成功`)
      break
    case 'realError':
      playing.value = false
      pushLog(method, brief(err) || '拉流失败，请检查 ws / rtsp 地址与 token')
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
    await host.init({ el: STAGE_ID, num: num.value, maxNum: 16, protocol: protocol.value, onMessage })
    statusText.value = '解码库已加载，等待播放器初始化…'
  } catch (e: any) {
    status.value = 'error'
    errorMsg.value = e?.message || String(e)
    pushLog('error', errorMsg.value)
  }
}

/**
 * 地址协议和实例协议不一致时重建实例：页面是 http 也能连 wss://
 * 返回 true 表示已重建，此时 realByUrl 会被挂起，初始化完成后自动播放
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
  if (!form.rtspURL.trim()) return ElMessage.warning('请填写 rtsp 地址（需带 token）')
  if (!form.wsURL.trim()) return ElMessage.warning('请填写 websocket 地址')
  if (!form.channelId.trim()) return ElMessage.warning('请填写通道编码')

  const rebuilt = await ensureProtocol()
  if (!rebuilt && status.value !== 'ready') return ElMessage.warning('解码库尚未初始化完成')

  host.realByUrl({
    rtspURL: form.rtspURL.trim(),
    wsURL: form.wsURL.trim(),
    channelId: form.channelId.trim(),
    streamType: Number(form.streamType),
    selectIndex: Number(form.selectIndex),
    playerAdapter: adapter.value,
    channelData: { channelId: form.channelId.trim() },
  })
  pushLog('realByUrl', `窗口 ${form.selectIndex} 发起拉流（${protocol.value}）`)
}

function fillSample() {
  form.rtspURL = `rtsp://192.168.1.2:9100/dss/monitor/param/cameraid=1000006%240%26substream=1&packtype=Private?token=157438`
  form.channelId = '1000006$0'
  form.wsURL = isHttps ? 'wss://192.168.1.1:9102' : 'ws://192.168.1.1:9100'
  ElMessage.success('已填入示例地址，替换成你自己的平台 IP 与 token')
}

function closeAll() {
  host.close()
  playing.value = false
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
  // 释放 wasm / worker / webgl 上下文，避免反复进出页面后黑屏
  host.destroy(STAGE_ID)
})

const stageStatusText = () => {
  if (status.value === 'loading') return statusText.value
  if (status.value === 'error') return '解码库加载失败'
  return playing.value ? '播放中' : '就绪'
}
</script>

<template>
  <div class="ws-page">
    <section class="stage-wrap">
      <div class="hint">
        <el-icon><InfoFilled /></el-icon>
        <span class="hint-text">
          大华无插件播放器（WSPlayer）快速集成示例：解码库放在 <code>public/wsplayer</code>，进入本页才按需注入，不参与打包；右侧为集成步骤与注意事项，播放器事件实时打在下方日志。
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
            <span class="label">websocket 地址</span>
            <el-input v-model="form.wsURL" size="small" placeholder="ws://ip:9100 或 wss://ip:9102" />
          </label>
          <label class="field grow">
            <span class="label">rtsp 地址（含 token，30 秒内有效）</span>
            <el-input v-model="form.rtspURL" size="small" placeholder="rtsp://ip:9100/dss/monitor/...?token=xxx" />
          </label>
          <label class="field">
            <span class="label">通道编码</span>
            <el-input v-model="form.channelId" size="small" placeholder="如 1000006$0" />
          </label>
          <label class="field sm">
            <span class="label">码流</span>
            <el-select v-model="form.streamType" size="small">
              <el-option :value="1" label="主码流" />
              <el-option :value="2" label="辅码流1" />
              <el-option :value="3" label="辅码流2" />
            </el-select>
          </label>
          <label class="field sm">
            <span class="label">窗口号</span>
            <el-input-number v-model="form.selectIndex" size="small" :min="0" :max="15" controls-position="right" />
          </label>
        </div>

        <div class="btn-row">
          <el-button type="primary" :disabled="status !== 'ready'" @click="play">开始播放</el-button>
          <el-button :disabled="status !== 'ready'" @click="closeAll">关闭全部</el-button>
          <el-button link type="primary" @click="fillSample">填入示例地址</el-button>
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
            <li v-if="!logs.length" class="empty">暂无事件，初始化完成或发起播放后这里会打印回调</li>
            <li v-for="(l, i) in logs" :key="i">
              <span class="time">{{ l.time }}</span>
              <span class="method">{{ l.method }}</span>
              <span class="text">{{ l.text }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <GuidePanel class="side-pane" :blocks="guideBlocks" :notes="notes" />
  </div>
</template>

<style scoped>
.ws-page {
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
  min-height: 240px;
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
.field :deep(.el-input-number) {
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
  height: 62px;
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
