import type { CodeBlock } from '@/components/CodePanel.vue'
import type { NoteItem } from '../../guide-types'

/**
 * 历史回放页的说明内容
 * 来源：大华 WSPlayer demo、对接文档 4.7「录像回放对接」与《高频问题 FAQ》
 */
export const guideBlocks: CodeBlock[] = [
  {
    title: '回放要单独建一个实例',
    desc: 'type 传 record，并且必须与实时预览用不同的容器 id；同一页面同时要实时和回放，就建两个实例',
    code: `// 回放播放器：容器、实例都与实时预览分开
const recordPlayer = new WSPlayer({
  el: 'ws-record-stage',            // 另一个容器 id
  type: 'record',                   // 关键：record 才会渲染进度条/倍速控件
  prefixUrl: WS_PLAYER_PREFIX,      // 与实时预览共用同一套解码库
  protocol: location.protocol === 'https:' ? 'wss' : 'ws',
  config: { num: 1, maxNum: 16, showControl: true },
  receiveMessageFromWSPlayer: (method, data, err) => {
    if (method === 'recordSuccess') console.log('回放开始')
    if (method === 'recordError') console.warn('回放失败', err)
    if (method === 'recordFinish') console.log('回放结束')
    if (method === 'switchStartTime') console.log('拖到', data.timeStamp) // 秒级时间戳
  },
})`,
  },
  {
    title: '后端准备两个接口',
    desc: 'records 与 rtsp 都来自平台接口；rtsp 必须取「时间形式回放」并在 30 秒内用掉',
    code: `// 1) 查询录像文件：/evo-apigw/admin/API/SS/Record/QueryRecords
//    → 返回 records: [{ startTime, endTime, ... }] 秒级时间戳
// 2) 获取回放流：   /evo-apigw/admin/API/SS/Playback/StartPlaybackByTime
//    → 返回 { url, token }，拼成 rtsp://ip:9320/playback/pu/11?token=xxx
//    注意：返回多个 rtsp 时取其中任意一个即可

// ws 端口与实时预览不同：ws://平台ip:9320 / wss://平台ip:9322
const playback = await api.startPlaybackByTime({ channelId, startTime, endTime })
const records = await api.queryRecords({ channelId, startTime, endTime })`,
  },
  {
    title: '发起回放：recordByUrl',
    desc: 'records 不传窗口会提示「无法拖动进度条」（错误码 107）',
    code: `recordPlayer.recordByUrl({
  wsURL,                     // ws://ip:9320 或 wss://ip:9322
  rtspURL,                   // 时间形式回放的 rtsp，已拼 token
  channelId: '1000006$0',    // 通道编码
  records,                   // 录像段列表，原样传入
  selectIndex: 0,            // 窗口号，从 0 开始
  startTime,                 // 可选，秒级时间戳；不传则从 records 截取
  endTime,                   // 可选，秒级时间戳
  playRecordByTime: true,    // 默认 true，拖拽异常时传 false
})`,
  },
  {
    title: '暂停 / 继续 / 倍速 / 跳转',
    desc: '都按窗口号操作：0.125 0.25 0.5 1 1.25 1.5 2 4 8',
    code: `recordPlayer.pause(0)              // 暂停
recordPlayer.play(0)               // 继续（仅暂停后有效）
recordPlayer.playSpeed(2, 0)       // 2 倍速；高倍速可能无音频
recordPlayer.jumpPlayByTime(startTime, 0, true) // 直接 seek 到指定时间
recordPlayer.close(0)              // 关闭窗口，重播要重新 recordByUrl`,
  },
  {
    title: '拖拽进度条：必须重新取流',
    desc: 'switchStartTime 只给时间戳，不给你新地址；要拿新时间戳重新请求 rtsp（新 token）再播',
    code: `case 'switchStartTime': {
  // data.timeStamp 为秒级时间戳（乘 1000 才是毫秒）
  // data.channelData 里带着原样的 records
  const { url, token } = await api.startPlaybackByTime({
    channelId, startTime: data.timeStamp, endTime,
  })
  recordPlayer.recordByUrl({
    wsURL,
    rtspURL: \`\${url}?token=\${token}\`, // 旧 token 已失效，必须换新的
    channelId,
    records: data.channelData.records,
    selectIndex: data.selectIndex,
    playRecordByTime: false,          // 拖拽后这条必须是 false，否则会跳回起点
  })
  break
}`,
  },
  {
    title: '离开页面销毁两个实例',
    desc: '回放实例同样持有 worker 与 WebGL 上下文，别忘了一起释放',
    code: `onBeforeUnmount(() => {
  recordPlayer.destroy()
  realPlayer?.destroy()   // 同页有实时预览的话
})`,
  },
]

export const notes: NoteItem[] = [
  {
    title: '回放不是实时预览换个地址',
    body: '必须用 `type: \'record\'` 的实例，否则底部不会出现进度条、倍速、暂停这些回放控件，`recordByUrl` 也不会生效。实时预览实例只认 `realByUrl`。',
  },
  {
    title: '回放端口与实时预览不同',
    body: '实时预览 ws 9100 / wss 9102；回放 ws `9320` / wss `9322`（示例 rtsp 里常见 `/playback/pu/...`）。用错端口典型现象是 ws 401/404，或一直停在「正在连接」再超时。以接口返回的 rtsp 里的 ip 和端口为准最稳。',
  },
  {
    title: '两边地址必须指向同一台流媒体',
    body: '`wsURL` 的 ip:port 要与回放 rtsp 里的那台服务器一致。分布式部署、端口映射、反向代理场景最容易只改了一个，结果就是有信令没画面。',
  },
  {
    title: 'records 必传，否则不能拖拽',
    body: 'records 就是查询录像接口返回的数组，原样传入，结构里至少要有 `startTime` / `endTime`（秒级时间戳）。不传时窗口会提示「当前未传 records 录像文件, 将无法拖动进度条」（错误码 107），但画面还能播。',
  },
  {
    title: 'startTime / endTime 建议显式传',
    body: '单位是秒级时间戳（`new Date().getTime() / 1000`）。不传时播放器会从 records 里推算，跨天、多段录像时容易和实际录像段错位，表现为进度条总长不对。',
  },
  {
    title: 'token 30 秒且只能播一次',
    body: '回放 rtsp 的 token 同样 30 秒过期、用过即废。页面停留很久后点「开始回放」，或者拖动进度条，都必须重新调取流接口换新 token，不能复用页面上次的地址。',
  },
  {
    title: '拖拽后必须重新取流',
    body: '`switchStartTime` 只在拖动进度条时触发，回调只给秒级时间戳和原 channels 数据，不会替你再拉流。正确做法是拿新时间点重新请求「时间形式回放」接口，再调 `recordByUrl`，并且 `playRecordByTime` 要传 `false`，否则画面会跳回起点。',
  },
  {
    title: 'playRecordByTime 什么时候传 false',
    body: '默认 true（按时间点回放）。只有「拖拽进度条不生效 / 跳回起点 / 卡在某一帧」时才传 `false`，此时播放器按文件顺序回放，拖拽由你自己重新拉流保证。',
  },
  {
    title: '无录像时段会直接报错',
    body: '拖到没有录像的时间段、或查询到的录像段已被覆盖，会触发 `recordError`（错误码 201 未查询到录像文件）。交互上要做「该时段暂无录像」的提示，而不是一直转圈。',
  },
  {
    title: '回放结束要处理 recordFinish',
    body: '一段录像播完触发 `recordFinish`，播放器停住但窗口还在。要么提示用户已播完、要么自动跳到下一段或关闭窗口，否则看起来像卡死。',
  },
  {
    title: '倍速有 9 档，音频可能跟不上',
    body: '支持 `0.125 0.25 0.5 1 1.25 1.5 2 4 8`。高倍速时音频可能被丢弃或异常（错误码 204「x 倍速无法播放音频」），对讲/音频核对场景请回到 1 倍速。',
  },
  {
    title: '分屏回放要逐窗口传参',
    body: '每个窗口独立 `selectIndex`、独立的 records 与 rtsp；同一个通道播放多个时段，也要按窗口分别调用。切换分屏数量前先 `close()`，否则窗口号会错位。',
  },
  {
    title: '时间戳单位别混',
    body: '接口与播放器统一用「秒」。`switchStartTime` 返回的也是秒，需要毫秒要乘 1000。混用会导致进度条长度差 1000 倍、或直接跳到 1970 年。',
  },
  {
    title: '部署与浏览器限制同实时预览',
    body: 'https 页面必须 wss 且证书可信；服务器要认 `.wasm` / `.data` 的 MIME；多线程需要 COOP/COEP 响应头，否则回退单线程；单页 WebGL 上限 16 个，回放窗口也算在内。',
  },
  {
    title: '本地 https 与协议切换',
    body: '`npm run dev:https` 起自签 https（`.env.https` 里 `VITE_HTTPS=1`），页面变 https 后默认回放地址自动切成 `wss://ip:9322`。协议以 ws 地址为准：http 页面手填 `wss://` 也能用，播放前检测到协议变化会自动重建 record 实例并重新排队回放请求。',
  },
]
