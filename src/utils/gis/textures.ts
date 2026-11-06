/**
 * 运行时生成贴图，避免为示例引入二进制资源
 * - 天气特效：雨 / 雪 / 沙尘 / 云
 * - 点位图标：可配置颜色的定位图钉
 */

type ParticleKind = 'rain' | 'snow' | 'sand' | 'cloud'

const cache = new Map<string, string>()

function createCanvas(size: number) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  return canvas
}

function drawParticle(kind: ParticleKind, size = 64): string {
  const canvas = createCanvas(size)
  const ctx = canvas.getContext('2d')!
  const c = size / 2

  if (kind === 'rain') {
    // 细长竖线 + 两端渐隐
    const g = ctx.createLinearGradient(0, 0, 0, size)
    g.addColorStop(0, 'rgba(200,230,255,0)')
    g.addColorStop(0.5, 'rgba(200,230,255,0.95)')
    g.addColorStop(1, 'rgba(200,230,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(c - 1, 0, 2, size)
  } else if (kind === 'snow') {
    const g = ctx.createRadialGradient(c, c, 0, c, c, c)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.45, 'rgba(255,255,255,0.85)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(c, c, c, 0, Math.PI * 2)
    ctx.fill()
  } else if (kind === 'sand') {
    const g = ctx.createRadialGradient(c, c, 0, c, c, c)
    g.addColorStop(0, 'rgba(214,184,124,0.95)')
    g.addColorStop(0.5, 'rgba(198,166,106,0.55)')
    g.addColorStop(1, 'rgba(198,166,106,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(c, c, c, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // 云：多个柔和圆斑叠加
    for (let i = 0; i < 6; i++) {
      const x = c + (Math.random() - 0.5) * size * 0.6
      const y = c + (Math.random() - 0.5) * size * 0.4
      const r = size * (0.18 + Math.random() * 0.22)
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, 'rgba(255,255,255,0.55)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  return canvas.toDataURL('image/png')
}

/** 获取天气粒子贴图（dataURL，按类型缓存） */
export function getParticleTexture(kind: ParticleKind): string {
  const hit = cache.get(kind)
  if (hit) return hit
  const url = drawParticle(kind)
  cache.set(kind, url)
  return url
}

/** 定位图钉（SVG dataURL），用于 billboard */
export function getPinIcon(color = '#2563eb', size = 32): string {
  const key = `pin:${color}:${size}`
  const hit = cache.get(key)
  if (hit) return hit
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 40">
    <path d="M16 1C8.3 1 2 7.2 2 14.9 2 25.2 16 39 16 39s14-13.8 14-24.1C30 7.2 23.7 1 16 1Z"
      fill="${color}" stroke="#ffffff" stroke-width="2"/>
    <circle cx="16" cy="14.6" r="5.2" fill="#ffffff"/>
  </svg>`
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  cache.set(key, url)
  return url
}
