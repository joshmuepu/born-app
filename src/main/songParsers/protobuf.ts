/**
 * protobuf.ts — a tiny schema-less protobuf wire-format reader.
 * Enough to walk a ProPresenter 7 document and pull out the fields we need.
 */

export interface PbField {
  wire: number
  /** varint / 32 / 64 → number; length-delimited → Buffer */
  value: number | bigint | Buffer
}

export type PbMessage = Map<number, PbField[]>

function readVarint(buf: Buffer, pos: number): [bigint, number] {
  let result = 0n
  let shift = 0n
  let p = pos
  while (p < buf.length) {
    const b = buf[p++]
    result |= BigInt(b & 0x7f) << shift
    if ((b & 0x80) === 0) break
    shift += 7n
  }
  return [result, p]
}

/** Parse one length-delimited protobuf message into fieldNumber → occurrences. */
export function decodeMessage(buf: Buffer): PbMessage {
  const out: PbMessage = new Map()
  let pos = 0
  while (pos < buf.length) {
    const [tag, next] = readVarint(buf, pos)
    pos = next
    const field = Number(tag >> 3n)
    const wire = Number(tag & 7n)
    if (field === 0) break

    let value: PbField['value']
    if (wire === 0) {
      const [v, p] = readVarint(buf, pos)
      value = v
      pos = p
    } else if (wire === 1) {
      value = buf.readBigUInt64LE(pos)
      pos += 8
    } else if (wire === 5) {
      value = buf.readUInt32LE(pos)
      pos += 4
    } else if (wire === 2) {
      const [len, p] = readVarint(buf, pos)
      const l = Number(len)
      value = buf.subarray(p, p + l)
      pos = p + l
    } else {
      break // unknown wire type — give up on the rest
    }

    if (!out.has(field)) out.set(field, [])
    out.get(field)!.push({ wire, value })
  }
  return out
}

/** All length-delimited values for a field, as sub-messages. */
export function subs(msg: PbMessage, field: number): Buffer[] {
  return (msg.get(field) ?? [])
    .filter((f) => Buffer.isBuffer(f.value))
    .map((f) => f.value as Buffer)
}

/** First length-delimited value for a field, decoded as UTF-8 text. */
export function str(msg: PbMessage, field: number): string | undefined {
  const f = (msg.get(field) ?? []).find((x) => Buffer.isBuffer(x.value))
  return f ? (f.value as Buffer).toString('utf8') : undefined
}
