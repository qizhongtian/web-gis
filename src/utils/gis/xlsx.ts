/**
 * 轻量 xlsx 读写（不引入第三方依赖）
 * - 读取：解析 zip（store / deflate-raw）+ 首个工作表，返回纯文本二维数组
 * - 写入：生成最小可用的单表 xlsx（ZIP 采用 store 方式，Excel 可正常打开）
 *
 * 只服务于「点表导入 / 导出」这类简单场景：不处理样式、公式、日期格式。
 */

export type XlsxCell = string | number | null | undefined
export type XlsxRow = XlsxCell[]

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/* ---------------- 通用工具 ---------------- */

/** 列下标（0 起）转 Excel 列字母 */
function columnLetter(index: number): string {
  let n = index
  let text = ''
  while (n >= 0) {
    text = String.fromCharCode(65 + (n % 26)) + text
    n = Math.floor(n / 26) - 1
  }
  return text
}

/** Excel 列字母（如 AA12）转列下标 */
function columnIndex(ref: string): number {
  const letters = ref.replace(/[^A-Za-z]/g, '').toUpperCase()
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/* ---------------- ZIP 写入 ---------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

interface ZipEntry {
  name: string
  data: Uint8Array
}

/** 生成未压缩（store）的 zip 包，兼容 Excel 等 Office 软件 */
function zipStore(entries: ZipEntry[]): Uint8Array {
  const now = new Date()
  const dosTime
    = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)
  const dosDate
    = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()

  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const crc = crc32(entry.data)

    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0x0800, true)
    lv.setUint16(8, 0, true)
    lv.setUint16(10, dosTime, true)
    lv.setUint16(12, dosDate, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, entry.data.length, true)
    lv.setUint32(22, entry.data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true)
    local.set(nameBytes, 30)

    const central = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, dosTime, true)
    cv.setUint16(14, dosDate, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, entry.data.length, true)
    cv.setUint32(24, entry.data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    central.set(nameBytes, 46)

    localParts.push(local, entry.data)
    centralParts.push(central)
    offset += local.length + entry.data.length
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  const output = new Uint8Array(offset + centralSize + end.length)
  let pos = 0
  for (const part of [...localParts, ...centralParts, end]) {
    output.set(part, pos)
    pos += part.length
  }
  return output
}

/* ---------------- XLSX 写入 ---------------- */

/** 生成单工作表 xlsx 文件 */
export function buildXlsxBlob(rows: XlsxRow[], sheetName = 'Sheet1'): Blob {
  const sheetData = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) => {
          if (value === null || value === undefined || value === '') return ''
          const ref = `${columnLetter(colIndex)}${rowIndex + 1}`
          if (typeof value === 'number' && Number.isFinite(value)) {
            return `<c r="${ref}"><v>${value}</v></c>`
          }
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(
            String(value),
          )}</t></is></c>`
        })
        .join('')
      return `<row r="${rowIndex + 1}">${cells}</row>`
    })
    .join('')

  const files: ZipEntry[] = [
    {
      name: '[Content_Types].xml',
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
      ),
    },
    {
      name: '_rels/.rels',
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
      ),
    },
    {
      name: 'xl/workbook.xml',
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
      ),
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetData}</sheetData></worksheet>`,
      ),
    },
  ]

  const bytes = zipStore(files)
  return new Blob([bytes as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/* ---------------- XLSX 读取 ---------------- */

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const Decompress = (globalThis as any).DecompressionStream
  if (!Decompress) {
    throw new Error('当前浏览器不支持解压 xlsx，请改用 .csv 文件')
  }
  const stream = new Blob([data as unknown as BlobPart])
    .stream()
    .pipeThrough(new Decompress('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** 解析 zip 包，返回「文件名 -> 解压后内容」 */
async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = -1
  const minPos = Math.max(0, bytes.length - 22 - 0xffff)
  for (let i = bytes.length - 22; i >= minPos; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('文件不是有效的 xlsx（zip 结构缺失）')

  const count = view.getUint16(eocd + 10, true)
  let pointer = view.getUint32(eocd + 16, true)
  const files = new Map<string, Uint8Array>()

  for (let i = 0; i < count; i++) {
    if (pointer + 46 > bytes.length || view.getUint32(pointer, true) !== 0x02014b50) break
    const method = view.getUint16(pointer + 10, true)
    const compressedSize = view.getUint32(pointer + 20, true)
    const nameLength = view.getUint16(pointer + 28, true)
    const extraLength = view.getUint16(pointer + 30, true)
    const commentLength = view.getUint16(pointer + 32, true)
    const localOffset = view.getUint32(pointer + 42, true)
    const name = decoder.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength))

    if (localOffset + 30 <= bytes.length && view.getUint32(localOffset, true) === 0x04034b50) {
      const localNameLength = view.getUint16(localOffset + 26, true)
      const localExtraLength = view.getUint16(localOffset + 28, true)
      const start = localOffset + 30 + localNameLength + localExtraLength
      const raw = bytes.subarray(start, start + compressedSize)
      files.set(name, method === 0 ? raw : await inflateRaw(raw))
    }

    pointer += 46 + nameLength + extraLength + commentLength
  }
  return files
}

function nodeText(node: Element | undefined): string {
  return node?.textContent ?? ''
}

function parseSharedStrings(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const items = doc.getElementsByTagName('si')
  const list: string[] = []
  for (let i = 0; i < items.length; i++) {
    const texts = items[i].getElementsByTagName('t')
    let text = ''
    for (let j = 0; j < texts.length; j++) text += nodeText(texts[j])
    list.push(text)
  }
  return list
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const rowElements = doc.getElementsByTagName('row')
  const rows: string[][] = []

  for (let i = 0; i < rowElements.length; i++) {
    const cells = rowElements[i].getElementsByTagName('c')
    const row: string[] = []
    for (let j = 0; j < cells.length; j++) {
      const cell = cells[j]
      const ref = cell.getAttribute('r') || ''
      const index = ref ? columnIndex(ref) : j
      const type = cell.getAttribute('t')
      let value = ''
      if (type === 'inlineStr') {
        value = nodeText(cell.getElementsByTagName('t')[0])
      } else {
        const v = cell.getElementsByTagName('v')[0]
        value = nodeText(v)
        if (type === 's') value = shared[Number(value)] ?? ''
        else if (type === 'b') value = value === '1' ? 'TRUE' : 'FALSE'
      }
      while (row.length < index) row.push('')
      row[index] = value
    }
    rows.push(row.map((v) => v ?? ''))
  }
  return rows
}

/** 读取 xlsx 首个工作表，返回纯文本二维数组（已去掉完全空白行） */
export async function readXlsxRows(file: Blob): Promise<string[][]> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const files = await unzip(bytes)

  let sheetName = ''
  for (const name of files.keys()) {
    if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(name)) {
      sheetName = name
      break
    }
  }
  if (!sheetName) throw new Error('未在 xlsx 中找到工作表')

  const sharedFile = files.get('xl/sharedStrings.xml')
  const shared = sharedFile ? parseSharedStrings(decoder.decode(sharedFile)) : []
  const rows = parseSheet(decoder.decode(files.get(sheetName)!), shared)
  return rows.filter((row) => row.some((cell) => cell.trim() !== ''))
}

/** 简易 CSV 解析（支持引号包裹、逗号与换行） */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (ch !== '\r') cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((item) => item.some((v) => v.trim() !== ''))
}
