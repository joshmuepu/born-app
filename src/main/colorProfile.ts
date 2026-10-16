/**
 * colorProfile.ts — turn pixels from a photo's own colour space (usually Display P3 on an iPhone) into sRGB.
 *
 * HEIC decoding gives raw pixel values and leaves the colour profile to the caller; without this step a
 * P3 photo looks washed out. Handles the profiles phones and cameras actually use ("matrix/TRC" ICC profiles:
 * Display P3, Adobe RGB, sRGB, ...) and the CICP "nclx" tag some Android phones write. Profiles it cannot read
 * (lookup-table / CMYK) are reported as null and the pixels are left alone — never guessed at.
 * Pure functions on plain buffers, no Electron, so they are unit-tested directly.
 */

type Mat3 = [number, number, number, number, number, number, number, number, number]

export interface ColorTransform {
  /** 256-entry table: 8-bit value in the source encoding → linear light (0..1) */
  lin: [Float32Array, Float32Array, Float32Array]
  /** linear source RGB → linear sRGB */
  m: Mat3
  /** true if applying it would change nothing visible (profile is sRGB already) */
  identity: boolean
  label: string
}

// XYZ (D50) → linear sRGB (Bradford-adapted; inverse of the sRGB colorant matrix in the ICC spec)
const XYZ_D50_TO_SRGB: Mat3 = [3.1338561, -1.6168667, -0.4906146, -0.9787684, 1.9161415, 0.033454, 0.0719453, -0.2289914, 1.4052427]
// Display P3 (D65, sRGB curve) → linear sRGB
const P3_TO_SRGB: Mat3 = [1.2249401, -0.2249404, 0, -0.0420569, 1.0420571, 0, -0.0196376, -0.0786361, 1.0982735]

const mul = (a: Mat3, b: Mat3): Mat3 => {
  const r = new Array(9).fill(0) as Mat3
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j]
  return r
}

const srgbToLinear = (v: number): number => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
const linearToSrgb = (v: number): number => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)

function curveTable(fn: (x: number) => number): Float32Array {
  const t = new Float32Array(256)
  for (let i = 0; i < 256; i++) t[i] = Math.min(1, Math.max(0, fn(i / 255)))
  return t
}

const s15 = (b: Buffer, o: number): number => b.readInt32BE(o) / 65536

/** ICC parametric curve types 0–4 */
function paraFn(b: Buffer, o: number): ((x: number) => number) | null {
  const type = b.readUInt16BE(o + 8)
  const n = [1, 3, 4, 5, 7][type]
  if (n === undefined) return null
  const p: number[] = []
  for (let i = 0; i < n; i++) p.push(s15(b, o + 12 + i * 4))
  const [g, a = 1, bb = 0, c = 0, d = 0, e = 0, f = 0] = p
  switch (type) {
    case 0: return (x) => Math.pow(x, g)
    case 1: return (x) => (x >= -bb / a ? Math.pow(a * x + bb, g) : 0)
    case 2: return (x) => (x >= -bb / a ? Math.pow(a * x + bb, g) + c : c)
    case 3: return (x) => (x >= d ? Math.pow(a * x + bb, g) : c * x)
    default: return (x) => (x >= d ? Math.pow(a * x + bb, g) + e : c * x + f)
  }
}

function readCurve(b: Buffer, off: number, size: number): Float32Array | null {
  if (off + 12 > b.length || off + size > b.length) return null
  const sig = b.toString('latin1', off, off + 4)
  if (sig === 'curv') {
    const n = b.readUInt32BE(off + 8)
    if (n === 0) return curveTable((x) => x)
    if (n === 1) return curveTable((x) => Math.pow(x, b.readUInt16BE(off + 12) / 256))
    if (off + 12 + n * 2 > b.length) return null
    return curveTable((x) => {
      const pos = x * (n - 1)
      const i = Math.min(n - 2, Math.floor(pos))
      const f = pos - i
      const a = b.readUInt16BE(off + 12 + i * 2) / 65535
      const c = b.readUInt16BE(off + 12 + (i + 1) * 2) / 65535
      return a + (c - a) * f
    })
  }
  if (sig === 'para') {
    const fn = paraFn(b, off)
    return fn ? curveTable(fn) : null
  }
  return null
}

/** Read an ICC profile (matrix/TRC kind). Returns null for anything else. */
export function transformFromIcc(icc: Buffer): ColorTransform | null {
  try {
    if (icc.length < 132 || icc.toString('latin1', 36, 40) !== 'acsp') return null
    if (icc.toString('latin1', 16, 20) !== 'RGB ') return null
    const count = icc.readUInt32BE(128)
    if (count > 200) return null
    const tags = new Map<string, { off: number; size: number }>()
    for (let i = 0; i < count; i++) {
      const o = 132 + i * 12
      tags.set(icc.toString('latin1', o, o + 4), { off: icc.readUInt32BE(o + 4), size: icc.readUInt32BE(o + 8) })
    }
    const xyz = (name: string): [number, number, number] | null => {
      const t = tags.get(name)
      if (!t || t.off + 20 > icc.length || icc.toString('latin1', t.off, t.off + 4) !== 'XYZ ') return null
      return [s15(icc, t.off + 8), s15(icc, t.off + 12), s15(icc, t.off + 16)]
    }
    const r = xyz('rXYZ'), g = xyz('gXYZ'), b = xyz('bXYZ')
    if (!r || !g || !b) return null
    const lin: ColorTransform['lin'] = [null as never, null as never, null as never]
    ;(['rTRC', 'gTRC', 'bTRC'] as const).forEach((n, i) => {
      const t = tags.get(n)
      lin[i] = (t && readCurve(icc, t.off, t.size)) as Float32Array
    })
    if (!lin[0] || !lin[1] || !lin[2]) return null
    const colorants: Mat3 = [r[0], g[0], b[0], r[1], g[1], b[1], r[2], g[2], b[2]]
    const m = mul(XYZ_D50_TO_SRGB, colorants)
    return finish(lin, m, 'icc')
  } catch {
    return null
  }
}

/** CICP/"nclx" colour description. Only Display P3 (primaries 12) needs work; sRGB/BT.709 (1) and unspecified (2) do not. */
export function transformFromNclx(primaries: number, transfer: number): ColorTransform | null {
  if (transfer !== 13 && transfer !== 1 && transfer !== 2 && transfer !== 6) return null // PQ / HLG (HDR) are not handled
  const lin: ColorTransform['lin'] = [curveTable(srgbToLinear), curveTable(srgbToLinear), curveTable(srgbToLinear)]
  if (primaries === 12) return finish(lin, P3_TO_SRGB, 'p3')
  return null
}

function finish(lin: ColorTransform['lin'], m: Mat3, label: string): ColorTransform {
  const ident = [1, 0, 0, 0, 1, 0, 0, 0, 1]
  const nearIdentity = m.every((v, i) => Math.abs(v - ident[i]) < 0.006)
  const srgbCurve = curveTable(srgbToLinear)
  let curveIsSrgb = true
  for (let c = 0; c < 3; c++) for (let i = 0; i < 256; i += 15) if (Math.abs(lin[c][i] - srgbCurve[i]) > 0.004) curveIsSrgb = false
  return { lin, m, identity: nearIdentity && curveIsSrgb, label }
}

let encodeLut: Uint8Array | null = null
function encoder(): Uint8Array {
  if (encodeLut) return encodeLut
  const t = new Uint8Array(4096)
  for (let i = 0; i < 4096; i++) t[i] = Math.round(Math.min(1, Math.max(0, linearToSrgb(i / 4095))) * 255)
  return (encodeLut = t)
}

/** Convert RGBA8 pixels in place from the source space to sRGB. Alpha untouched. */
export function applyToSrgb(rgba: Uint8Array | Uint8ClampedArray, t: ColorTransform): void {
  if (t.identity) return
  const [lr, lg, lb] = t.lin
  const [a, b, c, d, e, f, g, h, i] = t.m
  const enc = encoder()
  for (let p = 0; p < rgba.length; p += 4) {
    const r = lr[rgba[p]], gg = lg[rgba[p + 1]], bb = lb[rgba[p + 2]]
    const R = a * r + b * gg + c * bb
    const G = d * r + e * gg + f * bb
    const B = g * r + h * gg + i * bb
    rgba[p] = enc[(Math.min(1, Math.max(0, R)) * 4095 + 0.5) | 0]
    rgba[p + 1] = enc[(Math.min(1, Math.max(0, G)) * 4095 + 0.5) | 0]
    rgba[p + 2] = enc[(Math.min(1, Math.max(0, B)) * 4095 + 0.5) | 0]
  }
}

/** Find the colour description a HEIC file carries: an embedded ICC profile (iPhones) or CICP nclx (some Androids). */
export function colorFromHeic(file: Buffer): ColorTransform | null {
  let from = 0
  for (let n = 0; n < 8; n++) {
    const at = file.indexOf('colr', from, 'latin1')
    if (at < 4) return null
    from = at + 4
    const size = file.readUInt32BE(at - 4)
    if (size < 12 || at - 4 + size > file.length) continue
    const type = file.toString('latin1', at + 4, at + 8)
    if (type === 'prof' || type === 'rICC') {
      const t = transformFromIcc(file.subarray(at + 8, at - 4 + size))
      if (t) return t
    } else if (type === 'nclx' && size >= 18) {
      const t = transformFromNclx(file.readUInt16BE(at + 8), file.readUInt16BE(at + 10))
      if (t) return t
    }
  }
  return null
}
