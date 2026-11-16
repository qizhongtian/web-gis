/** 颜色转换与对比度计算（HEX / RGB / HSL / HSV / CMYK） */

export interface RGB {
  r: number
  g: number
  b: number
  a?: number
}

export interface HSL {
  h: number
  s: number
  l: number
}

export interface HSV {
  h: number
  s: number
  v: number
}

const clamp = (n: number, min = 0, max = 255) => Math.min(max, Math.max(min, n))
const round = (n: number) => Math.round(n)

export function parseColor(input: string): RGB | null {
  const s = (input || '').trim().toLowerCase()
  if (!s) return null
  let m = /^#([0-9a-f]{3,8})$/.exec(s)
  if (m) {
    let hex = m[1]
    if (hex.length === 3 || hex.length === 4) hex = hex.split('').map((c) => c + c).join('')
    if (hex.length !== 6 && hex.length !== 8) return null
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    }
  }
  m = /^rgba?\(\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s)
  if (m) {
    const toNum = (v: string, max: number) => (v.endsWith('%') ? (parseFloat(v) / 100) * max : parseFloat(v))
    const a = m[4] ? (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])) : 1
    return {
      r: clamp(round(toNum(m[1], 255))),
      g: clamp(round(toNum(m[2], 255))),
      b: clamp(round(toNum(m[3], 255))),
      a: Math.min(1, Math.max(0, a)),
    }
  }
  m = /^hsla?\(\s*([\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s)
  if (m) {
    const rgb = hslToRgb({ h: parseFloat(m[1]), s: parseFloat(m[2]), l: parseFloat(m[3]) })
    const a = m[4] ? (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])) : 1
    return { ...rgb, a: Math.min(1, Math.max(0, a)) }
  }
  return null
}

export function rgbToHex({ r, g, b }: RGB): string {
  return `#${[r, g, b].map((v) => clamp(round(v)).toString(16).padStart(2, '0')).join('')}`
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rr:
        h = (gg - bb) / d + (gg < bb ? 6 : 0)
        break
      case gg:
        h = (bb - rr) / d + 2
        break
      default:
        h = (rr - gg) / d + 4
    }
    h /= 6
  }
  return { h: h * 360, s: s * 100, l: l * 100 }
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const hh = ((h % 360) + 360) % 360 / 360
  const ss = Math.min(100, Math.max(0, s)) / 100
  const ll = Math.min(100, Math.max(0, l)) / 100
  if (ss === 0) {
    const v = Math.round(ll * 255)
    return { r: v, g: v, b: v }
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss
  const p = 2 * ll - q
  return {
    r: Math.round(hue2rgb(p, q, hh + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hh) * 255),
    b: Math.round(hue2rgb(p, q, hh - 1 / 3) * 255),
  }
}

export function rgbToHsv({ r, g, b }: RGB): HSV {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const d = max - min
  let h = 0
  if (d !== 0) {
    switch (max) {
      case rr:
        h = ((gg - bb) / d) % 6
        break
      case gg:
        h = (bb - rr) / d + 2
        break
      default:
        h = (rr - gg) / d + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 }
}

export function rgbToCmyk({ r, g, b }: RGB) {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const k = 1 - Math.max(rr, gg, bb)
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 }
  const c = (1 - rr - k) / (1 - k)
  const m = (1 - gg - k) / (1 - k)
  const y = (1 - bb - k) / (1 - k)
  return { c: c * 100, m: m * 100, y: y * 100, k: k * 100 }
}

/** 相对亮度（WCAG） */
export function relativeLuminance({ r, g, b }: RGB): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** 对比度（1 ~ 21） */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** 黑白文字对比，自动返回可读性更高的前景色 */
export function readableText(rgb: RGB): string {
  return contrastRatio(rgb, { r: 255, g: 255, b: 255 }) >= 4.5 ? '#ffffff' : '#111827'
}

/** 与白色 / 黑色混合，生成从浅到深的色阶 */
export function toneScale(rgb: RGB, steps = 10): { hex: string; weight: number }[] {
  const list: { hex: string; weight: number }[] = []
  for (let i = 1; i <= steps; i++) {
    const t = i / (steps + 1)
    list.push({
      hex: rgbToHex({
        r: rgb.r + (255 - rgb.r) * (1 - t),
        g: rgb.g + (255 - rgb.g) * (1 - t),
        b: rgb.b + (255 - rgb.b) * (1 - t),
      }),
      weight: Math.round((1 - t) * 100),
    })
  }
  return list
}

/** 线性插值混色 */
export function mixColor(a: RGB, b: RGB, t: number): RGB {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  }
}

export function randomHex(): string {
  return rgbToHex({ r: Math.random() * 255, g: Math.random() * 255, b: Math.random() * 255 })
}
