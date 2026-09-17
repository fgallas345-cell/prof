// Génère icon-192.png et icon-512.png (PNG pur, sans dépendance) à partir d'un rendu vectoriel simplifié.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

function crc32(buf) {
  let c, crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x + 0.5, y + 0.5)
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- formes (coordonnées dans un carré 512) ---
const inRoundRect = (x, y, rx, ry, w, h, r) => {
  if (x < rx || x > rx + w || y < ry || y > ry + h) return false
  const cx = Math.max(rx + r, Math.min(x, rx + w - r)), cy = Math.max(ry + r, Math.min(y, ry + h - r))
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}
const distSeg = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}
const INDIGO = [37, 99, 235], WHITE = [255, 255, 255], LINE1 = [191, 219, 254], LINE2 = [219, 234, 254]

function render(size, maskable) {
  return png(size, (px, py) => {
    const x = (px / size) * 512, y = (py / size) * 512
    // fond : plein pour maskable, coins arrondis sinon
    if (!maskable && !inRoundRect(x, y, 0, 0, 512, 512, 112)) return [0, 0, 0, 0]
    let c = INDIGO
    const s = maskable ? 0.8 : 1, o = maskable ? 512 * 0.1 : 0 // zone sûre
    const T = (v) => o + v * s
    if (inRoundRect(x, y, T(112), T(128), 240 * s, 320 * s, 28 * s)) c = WHITE
    else if (inRoundRect(x, y, T(136), T(96), 240 * s, 320 * s, 28 * s)) c = [96, 141, 240]
    if (c === WHITE) {
      if (inRoundRect(x, y, T(160), T(176), 140 * s, 22 * s, 11 * s)) c = LINE1
      else if (inRoundRect(x, y, T(160), T(216), 90 * s, 22 * s, 11 * s)) c = LINE2
      const d = Math.min(distSeg(x, y, T(168), T(288), T(216), T(336)), distSeg(x, y, T(216), T(336), T(328), T(224)))
      if (d <= 17 * s) c = INDIGO
    }
    return [...c, 255]
  })
}

writeFileSync('public/icons/icon-192.png', render(192, false))
writeFileSync('public/icons/icon-512.png', render(512, false))
writeFileSync('public/icons/icon-maskable-512.png', render(512, true))
console.log('Icônes générées : public/icons/icon-192.png, icon-512.png, icon-maskable-512.png')
