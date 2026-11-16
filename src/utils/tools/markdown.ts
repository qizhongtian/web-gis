/**
 * 轻量 Markdown 渲染器（无第三方依赖）
 * 支持：标题 / 段落 / 粗斜体 / 删除线 / 行内代码 / 代码块 / 引用 / 有序无序列表 /
 *      任务列表 / 表格 / 分割线 / 链接 / 图片 / 自动链接。
 * 安全策略：先转义 HTML，再解析 Markdown 语法；链接只放行 http(s)、mailto、相对路径与 data:image。
 */

export interface MarkdownHeading {
  level: number
  text: string
  id: string
}

export interface MarkdownResult {
  html: string
  headings: MarkdownHeading[]
  /** 中文字符 + 英文单词 */
  words: number
  /** 原始字符数（不含换行） */
  chars: number
}

const CODE_PLACEHOLDER = '\u0000CODE\u0000'

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function safeUrl(url: string) {
  const u = url.trim().replace(/^<|>$/g, '')
  if (/^(https?:|mailto:|tel:|data:image\/)/i.test(u)) return u
  if (/^(javascript|vbscript|data:text\/html)/i.test(u)) return '#'
  if (/^[./#]/.test(u) || !/^[a-z][a-z0-9+.-]*:/i.test(u)) return u
  return '#'
}

function inline(text: string): string {
  // 行内代码先占位，避免内部内容被当作强调语法
  const codes: string[] = []
  let s = text.replace(/`([^`\n]+)`/g, (_, code: string) => {
    codes.push(code)
    return `${CODE_PLACEHOLDER}${codes.length - 1}${CODE_PLACEHOLDER}`
  })

  // 图片
  s = s.replace(
    /!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\s*\)/g,
    (_, alt: string, url: string, title?: string) =>
      `<img src="${safeUrl(url)}" alt="${alt}"${title ? ` title="${title}"` : ''} loading="lazy" />`,
  )
  // 链接
  s = s.replace(
    /\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\s*\)/g,
    (_, label: string, url: string, title?: string) =>
      `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer"${title ? ` title="${title}"` : ''}>${label}</a>`,
  )
  // 自动链接
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_, pre: string, url: string) => {
    const clean = url.replace(/[.,;:!?]+$/, '')
    return `${pre}<a href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>`
  })

  s = s
    .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')

  // 行内代码还原
  s = s.replace(new RegExp(`${CODE_PLACEHOLDER}(\\d+)${CODE_PLACEHOLDER}`, 'g'), (_, i: string) => {
    return `<code>${escapeHtml(codes[Number(i)] ?? '')}</code>`
  })
  return s
}

function isTableSeparator(line: string) {
  return /^\s*\|?(\s*:?-{1,}:?\s*\|)+\s*:?-{1,}:?\s*\|?\s*$/.test(line)
}

function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((c) => c.trim())
}

/** 缩进列表解析：按缩进构造嵌套层级 */
interface ListItem {
  text: string
  indent: number
  ordered: boolean
  start: number
}

function buildList(items: ListItem[]): string {
  if (!items.length) return ''
  const baseIndent = items[0].indent
  const ordered = items[0].ordered
  let html = ordered ? `<ol${items[0].start !== 1 ? ` start="${items[0].start}"` : ''}>` : '<ul>'
  let i = 0
  while (i < items.length) {
    const item = items[i]
    // 收集更深缩进的子项
    const children: ListItem[] = []
    let j = i + 1
    while (j < items.length && items[j].indent > item.indent) {
      children.push(items[j])
      j++
    }
    let body = inline(item.text)
    const task = /^\[([ xX])\]\s+/.exec(item.text)
    if (task) {
      const checked = task[1].toLowerCase() === 'x'
      body = `<label class="md-task"><input type="checkbox" disabled${checked ? ' checked' : ''} /> ${inline(
        item.text.replace(/^\[([ xX])\]\s+/, ''),
      )}</label>`
    }
    html += `<li>${body}${children.length ? buildList(children) : ''}</li>`
    i = j
  }
  html += ordered ? '</ol>' : '</ul>'
  return html
}

export function renderMarkdown(source: string): MarkdownResult {
  const lines = source.replace(/\r\n?/g, '\n').replace(/\t/g, '  ').split('\n')
  const out: string[] = []
  const headings: MarkdownHeading[] = []
  let i = 0
  let headingIndex = 0

  const startsBlock = (line: string) =>
    /^\s*(```|~~~)/.test(line) ||
    /^#{1,6}\s+/.test(line) ||
    /^\s*>\s?/.test(line) ||
    /^\s*([-*+]|\d+\.)\s+/.test(line) ||
    /^\s*(\*\s*){3,}$|^\s*(-\s*){3,}$|^\s*(_\s*){3,}$/.test(line) ||
    /^\s*\|.*\|\s*$/.test(line)

  while (i < lines.length) {
    const line = lines[i]

    // 代码块
    const fence = /^\s*(```|~~~)\s*([\w-]*)/.exec(line)
    if (fence) {
      const marker = fence[1]
      const lang = fence[2]
      const buf: string[] = []
      i++
      while (i < lines.length && !new RegExp(`^\\s*${marker}`).test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      i++ // 跳过结束围栏
      out.push(
        `<div class="md-code"><div class="md-code-bar"><span>${escapeHtml(lang || 'text')}</span></div><pre><code>${escapeHtml(
          buf.join('\n'),
        )}</code></pre></div>`,
      )
      continue
    }

    // 空行
    if (!line.trim()) {
      i++
      continue
    }

    // 标题
    const h = /^(#{1,6})\s+(.*?)\s*#*$/.exec(line)
    if (h) {
      const level = h[1].length
      const text = h[2]
      const id = `md-h-${headingIndex++}`
      headings.push({ level, text: text.replace(/[*_`~]/g, ''), id })
      out.push(`<h${level} id="${id}">${inline(escapeHtml(text))}</h${level}>`)
      i++
      continue
    }

    // 分割线
    if (/^\s*((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(line)) {
      out.push('<hr />')
      i++
      continue
    }

    // 引用（递归解析内部内容）
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && (/^\s*>\s?/.test(lines[i]) || !lines[i].trim())) {
        if (!lines[i].trim() && i + 1 < lines.length && !/^\s*>\s?/.test(lines[i + 1])) break
        buf.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      out.push(`<blockquote>${renderMarkdown(buf.join('\n')).html}</blockquote>`)
      continue
    }

    // 表格
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitRow(line)
      const aligns = splitRow(lines[i + 1]).map((c) => {
        const left = c.startsWith(':')
        const right = c.endsWith(':')
        if (left && right) return 'center'
        if (right) return 'right'
        return left ? 'left' : ''
      })
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i]))
        i++
      }
      const th = header
        .map((c, idx) => `<th${aligns[idx] ? ` style="text-align:${aligns[idx]}"` : ''}>${inline(escapeHtml(c))}</th>`)
        .join('')
      const tb = rows
        .map(
          (r) =>
            `<tr>${header
              .map(
                (_, idx) =>
                  `<td${aligns[idx] ? ` style="text-align:${aligns[idx]}"` : ''}>${inline(
                    escapeHtml(r[idx] ?? ''),
                  )}</td>`,
              )
              .join('')}</tr>`,
        )
        .join('')
      out.push(`<div class="md-table"><table><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table></div>`)
      continue
    }

    // 列表
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const items: ListItem[] = []
      while (i < lines.length) {
        const cur = lines[i]
        const m = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(cur)
        if (m) {
          items.push({
            indent: m[1].length,
            ordered: /\d/.test(m[2]),
            start: /\d/.test(m[2]) ? parseInt(m[2], 10) : 1,
            text: m[3],
          })
          i++
          continue
        }
        // 列表项的续行
        if (cur.trim() && /^\s{2,}/.test(cur) && items.length) {
          items[items.length - 1].text += ` ${cur.trim()}`
          i++
          continue
        }
        break
      }
      out.push(buildList(items))
      continue
    }

    // 段落
    const buf: string[] = []
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) {
      buf.push(lines[i])
      i++
    }
    if (buf.length) {
      const text = buf.join('\n').replace(/ {2,}\n|\\\n/g, '<br />')
      out.push(`<p>${text.split('\n').map((s) => inline(escapeHtml(s))).join(' ')}</p>`)
    } else {
      // 兜底：单行无法归类时按原文输出，避免死循环
      out.push(`<p>${inline(escapeHtml(line))}</p>`)
      i++
    }
  }

  const plain = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*`~\-|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const cjk = (plain.match(/[\u4e00-\u9fa5]/g) || []).length
  const latin = (plain.match(/[A-Za-z0-9_]+/g) || []).length

  return {
    html: out.join('\n'),
    headings,
    words: cjk + latin,
    chars: source.replace(/\s/g, '').length,
  }
}
