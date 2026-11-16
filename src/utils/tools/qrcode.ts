/**
 * 二维码矩阵生成器（纯前端，无第三方依赖）
 * 算法参考 ISO/IEC 18004 与 Kazuhiko Arase 的 qrcode-generator 实现思路：
 * 字节模式编码 → Reed-Solomon 纠错 → 交织 → 排布 → 8 种掩码择优。
 * 支持版本 1-20（容量足够日常 URL / 文本），纠错等级 L / M / Q / H。
 */

export type EccLevel = 'L' | 'M' | 'Q' | 'H'

export interface QrMatrix {
  /** 每边模块数 */
  size: number
  /** true 表示深色模块 */
  modules: boolean[][]
  version: number
  ecc: EccLevel
}

/* ---------------- GF(256) ---------------- */
const EXP_TABLE: number[] = new Array(256).fill(0)
const LOG_TABLE: number[] = new Array(256).fill(0)
for (let i = 0; i < 8; i++) EXP_TABLE[i] = 1 << i
for (let i = 8; i < 256; i++) {
  EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8]
}
for (let i = 0; i < 255; i++) LOG_TABLE[EXP_TABLE[i]] = i

function gexp(n: number) {
  let v = n
  while (v < 0) v += 255
  while (v >= 256) v -= 255
  return EXP_TABLE[v]
}

function glog(n: number) {
  if (n < 1) throw new Error(`glog(${n})`)
  return LOG_TABLE[n]
}

/** 多项式（系数从高位到低位） */
class Poly {
  num: number[]

  constructor(num: number[], shift = 0) {
    let offset = 0
    while (offset < num.length && num[offset] === 0) offset++
    this.num = new Array(num.length - offset + shift).fill(0)
    for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset]
  }

  get(index: number) {
    return this.num[index]
  }

  getLength() {
    return this.num.length
  }

  multiply(e: Poly): Poly {
    const num = new Array(this.getLength() + e.getLength() - 1).fill(0)
    for (let i = 0; i < this.getLength(); i++) {
      for (let j = 0; j < e.getLength(); j++) {
        num[i + j] ^= gexp(glog(this.get(i)) + glog(e.get(j)))
      }
    }
    return new Poly(num, 0)
  }

  mod(e: Poly): Poly {
    if (this.getLength() - e.getLength() < 0) return this
    const ratio = glog(this.get(0)) - glog(e.get(0))
    const num = [...this.num]
    for (let i = 0; i < e.getLength(); i++) {
      num[i] ^= gexp(glog(e.get(i)) + ratio)
    }
    return new Poly(num, 0).mod(e)
  }
}

/* ---------------- 常量表 ---------------- */
const ECC_INDEX: Record<EccLevel, number> = { L: 0, M: 1, Q: 2, H: 3 }
/** 格式信息里的纠错等级编码 */
const ECC_BITS: Record<EccLevel, number> = { L: 1, M: 0, Q: 3, H: 2 }

/** 每个版本依次为 L / M / Q / H，每组三个数：块数、总码字数、数据码字数 */
const RS_BLOCK_TABLE: number[][][] = [
  [[1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9]],
  [[1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16]],
  [[1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13]],
  [[1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9]],
  [[1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12]],
  [[2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15]],
  [[2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14]],
  [[2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15]],
  [[2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13]],
  [[2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16]],
  [[4, 101, 81], [1, 80, 50, 4, 81, 51], [4, 50, 22, 4, 51, 23], [3, 36, 12, 8, 37, 13]],
  [[2, 116, 92, 2, 117, 93], [6, 58, 36, 2, 59, 37], [4, 46, 20, 6, 47, 21], [7, 42, 14, 4, 43, 15]],
  [[4, 133, 107], [8, 59, 37, 1, 60, 38], [8, 44, 20, 4, 45, 21], [12, 33, 11, 4, 34, 12]],
  [[3, 145, 115, 1, 146, 116], [4, 64, 40, 5, 65, 41], [11, 36, 16, 5, 37, 17], [11, 36, 12, 5, 37, 13]],
  [[5, 109, 87, 1, 110, 88], [5, 65, 41, 5, 66, 42], [5, 54, 24, 7, 55, 25], [11, 36, 12, 7, 37, 13]],
  [[5, 122, 98, 1, 123, 99], [7, 73, 45, 3, 74, 46], [15, 43, 19, 2, 44, 20], [3, 45, 15, 13, 46, 16]],
  [[1, 135, 107, 5, 136, 108], [10, 74, 46, 1, 75, 47], [1, 50, 22, 15, 51, 23], [2, 42, 14, 17, 43, 15]],
  [[5, 150, 120, 1, 151, 121], [9, 69, 43, 4, 70, 44], [17, 50, 22, 1, 51, 23], [2, 42, 14, 19, 43, 15]],
  [[3, 141, 113, 4, 142, 114], [3, 70, 44, 11, 71, 45], [17, 47, 21, 4, 48, 22], [9, 39, 13, 16, 40, 14]],
  [[3, 135, 107, 5, 136, 108], [3, 67, 41, 13, 68, 42], [15, 54, 24, 5, 55, 25], [15, 43, 15, 10, 44, 16]],
]

/** 版本 1-20 的校正图案中心坐标 */
const ALIGNMENT_POS: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
]

/* ---------------- BCH ---------------- */
const G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | 1
const G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | 1
const G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1) | 1

function bchDigit(data: number) {
  let digit = 0
  let d = data
  while (d !== 0) {
    digit++
    d >>>= 1
  }
  return digit
}

function getBCHTypeInfo(data: number) {
  let d = data << 10
  while (bchDigit(d) - bchDigit(G15) >= 0) d ^= G15 << (bchDigit(d) - bchDigit(G15))
  return ((data << 10) | d) ^ G15_MASK
}

function getBCHTypeNumber(data: number) {
  let d = data << 12
  while (bchDigit(d) - bchDigit(G18) >= 0) d ^= G18 << (bchDigit(d) - bchDigit(G18))
  return (data << 12) | d
}

/* ---------------- 数据处理 ---------------- */
class BitBuffer {
  buffer: number[] = []
  length = 0

  get(index: number) {
    return ((this.buffer[Math.floor(index / 8)] >>> (7 - (index % 8))) & 1) === 1
  }

  put(num: number, len: number) {
    for (let i = 0; i < len; i++) this.putBit(((num >>> (len - i - 1)) & 1) === 1)
  }

  putBit(bit: boolean) {
    const bufIndex = Math.floor(this.length / 8)
    if (this.buffer.length <= bufIndex) this.buffer.push(0)
    if (bit) this.buffer[bufIndex] |= 0x80 >>> (this.length % 8)
    this.length++
  }
}

interface RSBlock {
  totalCount: number
  dataCount: number
}

function getRSBlocks(version: number, ecc: EccLevel): RSBlock[] {
  const flat = RS_BLOCK_TABLE[version - 1][ECC_INDEX[ecc]]
  const blocks: RSBlock[] = []
  for (let i = 0; i < flat.length; i += 3) {
    const count = flat[i]
    const total = flat[i + 1]
    const data = flat[i + 2]
    for (let k = 0; k < count; k++) blocks.push({ totalCount: total, dataCount: data })
  }
  return blocks
}

function getLengthInBits(version: number) {
  return version < 10 ? 8 : 16
}

function createData(version: number, ecc: EccLevel, bytes: number[]): number[] {
  const rsBlocks = getRSBlocks(version, ecc)
  const buffer = new BitBuffer()
  const totalDataCount = rsBlocks.reduce((s, b) => s + b.dataCount, 0)
  const capacityBits = totalDataCount * 8

  buffer.put(4, 4) // 字节模式 0100
  buffer.put(bytes.length, getLengthInBits(version))
  bytes.forEach((b) => buffer.put(b, 8))

  if (buffer.length > capacityBits) throw new Error('内容过长')
  if (buffer.length + 4 <= capacityBits) buffer.put(0, 4)
  while (buffer.length % 8 !== 0) buffer.putBit(false)
  while (buffer.length < capacityBits) {
    buffer.put(0xec, 8)
    if (buffer.length >= capacityBits) break
    buffer.put(0x11, 8)
  }

  // 分块 → 纠错 → 交织
  let offset = 0
  const dcData: number[][] = []
  const ecData: number[][] = []
  let maxDc = 0
  let maxEc = 0
  for (const block of rsBlocks) {
    const dcCount = block.dataCount
    const ecCount = block.totalCount - dcCount
    maxDc = Math.max(maxDc, dcCount)
    maxEc = Math.max(maxEc, ecCount)

    const dc = buffer.buffer.slice(offset, offset + dcCount)
    offset += dcCount

    let rsPoly = new Poly([1], 0)
    for (let i = 0; i < ecCount; i++) rsPoly = rsPoly.multiply(new Poly([1, gexp(i)], 0))

    const rawPoly = new Poly(dc, rsPoly.getLength() - 1)
    const modPoly = rawPoly.mod(rsPoly)

    dcData.push(dc)
    const ec: number[] = new Array(ecCount).fill(0)
    for (let i = 0; i < ecCount; i++) {
      const idx = i + modPoly.getLength() - ecCount
      ec[i] = idx >= 0 ? modPoly.get(idx) : 0
    }
    ecData.push(ec)
  }

  const totalCodeCount = rsBlocks.reduce((s, b) => s + b.totalCount, 0)
  const data: number[] = new Array(totalCodeCount).fill(0)
  let index = 0
  for (let i = 0; i < maxDc; i++) {
    for (let r = 0; r < rsBlocks.length; r++) {
      if (i < dcData[r].length) data[index++] = dcData[r][i]
    }
  }
  for (let i = 0; i < maxEc; i++) {
    for (let r = 0; r < rsBlocks.length; r++) {
      if (i < ecData[r].length) data[index++] = ecData[r][i]
    }
  }
  return data
}

/* ---------------- 矩阵排布 ---------------- */
function maskPattern(mask: number, i: number, j: number): boolean {
  switch (mask) {
    case 0:
      return (i + j) % 2 === 0
    case 1:
      return i % 2 === 0
    case 2:
      return j % 3 === 0
    case 3:
      return (i + j) % 3 === 0
    case 4:
      return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0
    case 5:
      return ((i * j) % 2) + ((i * j) % 3) === 0
    case 6:
      return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0
    case 7:
      return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0
    default:
      return false
  }
}

class QrBuilder {
  size: number
  modules: (boolean | null)[][]

  constructor(public version: number, public ecc: EccLevel, public text: string) {
    this.size = version * 4 + 17
    this.modules = Array.from({ length: this.size }, () => new Array(this.size).fill(null))
  }

  private setupProbe(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || this.size <= row + r) continue
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || this.size <= col + c) continue
        const dark =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        this.modules[row + r][col + c] = dark
      }
    }
  }

  private setupTiming() {
    for (let i = 8; i < this.size - 8; i++) {
      if (this.modules[i][6] === null) this.modules[i][6] = i % 2 === 0
      if (this.modules[6][i] === null) this.modules[6][i] = i % 2 === 0
    }
  }

  private setupAlignment() {
    const pos = ALIGNMENT_POS[this.version - 1] || []
    for (const row of pos) {
      for (const col of pos) {
        if (this.modules[row][col] !== null) continue
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            this.modules[row + r][col + c] = Math.max(Math.abs(r), Math.abs(c)) !== 1
          }
        }
      }
    }
  }

  private setupTypeInfo(test: boolean, mask: number) {
    const data = (ECC_BITS[this.ecc] << 3) | mask
    const bits = getBCHTypeInfo(data)

    for (let i = 0; i < 15; i++) {
      const mod = !test && ((bits >> i) & 1) === 1
      if (i < 6) this.modules[i][8] = mod
      else if (i < 8) this.modules[i + 1][8] = mod
      else this.modules[this.size - 15 + i][8] = mod
    }
    for (let i = 0; i < 15; i++) {
      const mod = !test && ((bits >> i) & 1) === 1
      if (i < 8) this.modules[8][this.size - i - 1] = mod
      else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod
      else this.modules[8][15 - i - 1] = mod
    }
    this.modules[this.size - 8][8] = !test
  }

  private setupVersionInfo(test: boolean) {
    if (this.version < 7) return
    const bits = getBCHTypeNumber(this.version)
    for (let i = 0; i < 18; i++) {
      const mod = !test && ((bits >> i) & 1) === 1
      this.modules[Math.floor(i / 3)][(i % 3) + this.size - 8 - 3] = mod
      this.modules[(i % 3) + this.size - 8 - 3][Math.floor(i / 3)] = mod
    }
  }

  private mapData(data: number[], mask: number) {
    let inc = -1
    let row = this.size - 1
    let bitIndex = 7
    let byteIndex = 0

    for (let col = this.size - 1; col > 0; col -= 2) {
      if (col === 6) col--
      for (;;) {
        for (let c = 0; c < 2; c++) {
          if (this.modules[row][col - c] === null) {
            let dark = false
            if (byteIndex < data.length) dark = ((data[byteIndex] >>> bitIndex) & 1) === 1
            if (maskPattern(mask, row, col - c)) dark = !dark
            this.modules[row][col - c] = dark
            bitIndex--
            if (bitIndex === -1) {
              byteIndex++
              bitIndex = 7
            }
          }
        }
        row += inc
        if (row < 0 || this.size <= row) {
          row -= inc
          inc = -inc
          break
        }
      }
    }
  }

  private lostPoint(): number {
    let lost = 0
    const size = this.size

    // 规则一：同色连续块
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        let same = 0
        const dark = this.modules[row][col]
        for (let r = -1; r <= 1; r++) {
          if (row + r < 0 || size <= row + r) continue
          for (let c = -1; c <= 1; c++) {
            if (col + c < 0 || size <= col + c) continue
            if (r === 0 && c === 0) continue
            if (dark === this.modules[row + r][col + c]) same++
          }
        }
        if (same > 5) lost += 3 + same - 5
      }
    }
    // 规则二：2x2 同色
    for (let row = 0; row < size - 1; row++) {
      for (let col = 0; col < size - 1; col++) {
        let count = 0
        if (this.modules[row][col]) count++
        if (this.modules[row + 1][col]) count++
        if (this.modules[row][col + 1]) count++
        if (this.modules[row + 1][col + 1]) count++
        if (count === 0 || count === 4) lost += 3
      }
    }
    // 规则三：类似定位图案的 1:1:3:1:1
    const pattern = (get: (k: number) => boolean | null) => {
      let count = 0
      for (let k = 0; k < 7; k++) {
        if (get(k) === null) return 0
      }
      if (get(0) && !get(1) && get(2) && get(3) && get(4) && !get(5) && get(6)) count++
      return count
    }
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size - 6; col++) lost += pattern((k) => this.modules[row][col + k]) * 40
    }
    for (let col = 0; col < size; col++) {
      for (let row = 0; row < size - 6; row++) lost += pattern((k) => this.modules[row + k][col]) * 40
    }
    // 规则四：深色比例
    let darkCount = 0
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) if (this.modules[row][col]) darkCount++
    }
    const ratio = Math.abs((100 * darkCount) / size / size - 50) / 5
    lost += ratio * 10
    return lost
  }

  private makeImpl(test: boolean, mask: number, data: number[]) {
    this.modules = Array.from({ length: this.size }, () => new Array(this.size).fill(null))
    this.setupProbe(0, 0)
    this.setupProbe(this.size - 7, 0)
    this.setupProbe(0, this.size - 7)
    this.setupAlignment()
    this.setupTiming()
    this.setupTypeInfo(test, mask)
    this.setupVersionInfo(test)
    this.mapData(data, mask)
  }

  build(): boolean[][] {
    const bytes = Array.from(new TextEncoder().encode(this.text))
    const data = createData(this.version, this.ecc, bytes)

    let bestMask = 0
    let bestLost = Infinity
    for (let mask = 0; mask < 8; mask++) {
      this.makeImpl(true, mask, data)
      const lost = this.lostPoint()
      if (lost < bestLost) {
        bestLost = lost
        bestMask = mask
      }
    }
    this.makeImpl(false, bestMask, data)
    return this.modules.map((row) => row.map((m) => !!m))
  }
}

/** 根据内容长度自动选择最小可用版本 */
export function createQrMatrix(text: string, ecc: EccLevel = 'M'): QrMatrix {
  const bytes = new TextEncoder().encode(text)
  let version = 0
  for (let v = 1; v <= 20; v++) {
    const blocks = getRSBlocks(v, ecc)
    const dataCount = blocks.reduce((s, b) => s + b.dataCount, 0)
    const capacity = dataCount * 8
    const need = 4 + getLengthInBits(v) + bytes.length * 8
    if (need <= capacity) {
      version = v
      break
    }
  }
  if (!version) throw new Error(`内容过长（${bytes.length} 字节），请缩短或降低纠错等级`)

  const builder = new QrBuilder(version, ecc, text)
  const modules = builder.build()
  return { size: modules.length, modules, version, ecc }
}
