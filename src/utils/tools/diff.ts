/** 行级文本比对：LCS 动态规划 + 并排 / 统一视图生成（无第三方依赖） */

export type DiffOpType = 'equal' | 'del' | 'add'

export interface DiffOp {
  type: DiffOpType
  text: string
  /** 左侧行号（add 为空） */
  aNo?: number
  /** 右侧行号（del 为空） */
  bNo?: number
}

export interface SideRow {
  kind: 'equal' | 'replace' | 'del' | 'add'
  leftNo?: number
  leftText?: string
  rightNo?: number
  rightText?: string
}

export interface DiffStats {
  added: number
  removed: number
  unchanged: number
}

export interface DiffOptions {
  ignoreCase?: boolean
  ignoreWhitespace?: boolean
}

const MAX_CELLS = 4_000_000

/** 计算行级差异（超过安全规模时退化为逐行比较，避免页面卡死） */
export function diffLines(aText: string, bText: string, opts: DiffOptions = {}): DiffOp[] {
  const a = aText.replace(/\r\n?/g, '\n').split('\n')
  const b = bText.replace(/\r\n?/g, '\n').split('\n')
  // 末尾空行不计入比较，避免「文件末尾换行」产生无意义差异
  if (a.length > 1 && a[a.length - 1] === '') a.pop()
  if (b.length > 1 && b[b.length - 1] === '') b.pop()

  const norm = (s: string) => {
    let r = s
    if (opts.ignoreWhitespace) r = r.replace(/\s+/g, ' ').trim()
    if (opts.ignoreCase) r = r.toLowerCase()
    return r
  }
  const na = a.map(norm)
  const nb = b.map(norm)

  if (na.length * nb.length > MAX_CELLS) return fallbackDiff(a, b, na, nb)

  const n = na.length
  const m = nb.length
  // dp[i][j] = na[i..] 与 nb[j..] 的 LCS 长度
  const dp = new Uint32Array((n + 1) * (m + 1))
  const at = (i: number, j: number) => i * (m + 1) + j
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[at(i, j)] =
        na[i] === nb[j] ? dp[at(i + 1, j + 1)] + 1 : Math.max(dp[at(i + 1, j)], dp[at(i, j + 1)])
    }
  }

  const ops: DiffOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (na[i] === nb[j]) {
      ops.push({ type: 'equal', text: a[i], aNo: i + 1, bNo: j + 1 })
      i++
      j++
    } else if (dp[at(i + 1, j)] >= dp[at(i, j + 1)]) {
      ops.push({ type: 'del', text: a[i], aNo: i + 1 })
      i++
    } else {
      ops.push({ type: 'add', text: b[j], bNo: j + 1 })
      j++
    }
  }
  while (i < n) ops.push({ type: 'del', text: a[i], aNo: i + 1 }), i++
  while (j < m) ops.push({ type: 'add', text: b[j], bNo: j + 1 }), j++
  return ops
}

function fallbackDiff(a: string[], b: string[], na: string[], nb: string[]): DiffOp[] {
  const ops: DiffOp[] = []
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    if (i < a.length && i < b.length && na[i] === nb[i]) {
      ops.push({ type: 'equal', text: a[i], aNo: i + 1, bNo: i + 1 })
    } else {
      if (i < a.length) ops.push({ type: 'del', text: a[i], aNo: i + 1 })
      if (i < b.length) ops.push({ type: 'add', text: b[i], bNo: i + 1 })
    }
  }
  return ops
}

export function diffStats(ops: DiffOp[]): DiffStats {
  return ops.reduce<DiffStats>(
    (s, op) => {
      if (op.type === 'add') s.added++
      else if (op.type === 'del') s.removed++
      else s.unchanged++
      return s
    },
    { added: 0, removed: 0, unchanged: 0 },
  )
}

/** 连续删除 + 连续新增合并成「替换」行，供并排视图左右对齐 */
export function toSideBySide(ops: DiffOp[]): SideRow[] {
  const rows: SideRow[] = []
  let i = 0
  while (i < ops.length) {
    const op = ops[i]
    if (op.type === 'equal') {
      rows.push({ kind: 'equal', leftNo: op.aNo, leftText: op.text, rightNo: op.bNo, rightText: op.text })
      i++
      continue
    }
    const dels: DiffOp[] = []
    const adds: DiffOp[] = []
    while (i < ops.length && ops[i].type === 'del') dels.push(ops[i++])
    while (i < ops.length && ops[i].type === 'add') adds.push(ops[i++])
    const max = Math.max(dels.length, adds.length)
    for (let k = 0; k < max; k++) {
      const d = dels[k]
      const a = adds[k]
      if (d && a) {
        rows.push({ kind: 'replace', leftNo: d.aNo, leftText: d.text, rightNo: a.bNo, rightText: a.text })
      } else if (d) {
        rows.push({ kind: 'del', leftNo: d.aNo, leftText: d.text })
      } else {
        rows.push({ kind: 'add', rightNo: a.bNo, rightText: a.text })
      }
    }
  }
  return rows
}

/** 生成标准 unified diff 文本（带 3 行上下文） */
export function toUnifiedPatch(
  ops: DiffOp[],
  fileNameA = 'a.txt',
  fileNameB = 'b.txt',
  context = 3,
): string {
  // 标记需要输出的 op 下标
  const keep = new Set<number>()
  ops.forEach((op, idx) => {
    if (op.type === 'equal') return
    for (let k = Math.max(0, idx - context); k <= Math.min(ops.length - 1, idx + context); k++) keep.add(k)
  })
  if (!keep.size) return ''

  const lines: string[] = [`--- ${fileNameA}`, `+++ ${fileNameB}`]
  const indices = [...keep].sort((x, y) => x - y)

  // 连续片段形成一个 hunk
  const hunks: number[][] = []
  for (const idx of indices) {
    const cur = hunks[hunks.length - 1]
    if (cur && idx === cur[cur.length - 1] + 1) cur.push(idx)
    else hunks.push([idx])
  }

  for (const hunk of hunks) {
    const start = hunk[0]
    const aStart = ops.slice(0, start).filter((o) => o.type !== 'add').length + 1
    const bStart = ops.slice(0, start).filter((o) => o.type !== 'del').length + 1
    const aCount = hunk.filter((k) => ops[k].type !== 'add').length
    const bCount = hunk.filter((k) => ops[k].type !== 'del').length
    lines.push(`@@ -${aStart},${aCount} +${bStart},${bCount} @@`)
    for (const k of hunk) {
      const op = ops[k]
      lines.push(`${op.type === 'add' ? '+' : op.type === 'del' ? '-' : ' '}${op.text}`)
    }
  }
  return lines.join('\n')
}
