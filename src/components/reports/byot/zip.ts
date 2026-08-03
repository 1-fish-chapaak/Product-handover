// ─── A minimal ZIP reader ───────────────────────────────────────────────────
//
// A .pptx is a ZIP of XML parts, so reading a deck starts with opening the zip.
// The browser already ships an inflater (DecompressionStream), so this is a
// central-directory walk plus a call to it — no dependency, nothing to keep up
// to date, and nothing in the bundle that is not used.
//
// Entries are read on demand. A deck carries its images inside the same zip and
// we never look at them, so decompressing everything up front would be most of
// the work for none of the answer.

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;
/** The zip comment can be 64 KB, so the end record sits at most that far back. */
const EOCD_SEARCH = 66_000;

type Entry = { name: string; method: number; compressed: number; size: number; localOffset: number };

export type Zip = {
  /** Every file path inside the archive, in central-directory order. */
  names: string[];
  has: (name: string) => boolean;
  /** Bytes of one entry, inflated if it needs it. Undefined when absent. */
  bytes: (name: string) => Promise<Uint8Array | undefined>;
  /** One entry as UTF-8 text. The XML parts of an Office file are all UTF-8. */
  text: (name: string) => Promise<string | undefined>;
};

/** Reads the central directory. Throws when the bytes are not a zip at all. */
export async function openZip(buf: ArrayBuffer): Promise<Zip> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // The end-of-central-directory record is last, after a comment of unknown
  // length, so it is found by scanning backwards for its signature.
  let eocd = -1;
  const from = Math.max(0, bytes.length - EOCD_SEARCH);
  for (let i = bytes.length - 22; i >= from; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not-a-zip');

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  // Zip64 parks 0xFFFFFFFF here as a "look elsewhere" marker. Office never
  // writes one for a file this size, so it is refused rather than half-read.
  if (p === 0xffffffff || count === 0xffff) throw new Error('zip64');

  const entries = new Map<string, Entry>();
  const names: string[] = [];
  for (let i = 0; i < count && p + 46 <= bytes.length; i++) {
    if (view.getUint32(p, true) !== CEN_SIG) break;
    const method = view.getUint16(p + 10, true);
    const compressed = view.getUint32(p + 20, true);
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (name && !name.endsWith('/')) {
      entries.set(name, { name, method, compressed, size, localOffset });
      names.push(name);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }

  const read = async (name: string): Promise<Uint8Array | undefined> => {
    const e = entries.get(name);
    if (!e) return undefined;
    // The local header repeats the name and extra fields, and only it says how
    // long they really are, so the data offset comes from here and not the
    // central directory.
    if (view.getUint32(e.localOffset, true) !== LOC_SIG) return undefined;
    const nameLen = view.getUint16(e.localOffset + 26, true);
    const extraLen = view.getUint16(e.localOffset + 28, true);
    const start = e.localOffset + 30 + nameLen + extraLen;
    const raw = bytes.subarray(start, start + (e.method === 0 ? e.size : e.compressed));
    if (e.method === 0) return raw;
    if (e.method !== 8) return undefined;                 // only stored and deflate
    if (typeof DecompressionStream === 'undefined') return undefined;
    // `deflate-raw` because a zip member carries no zlib wrapper.
    const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  };

  return {
    names,
    has: (name: string) => entries.has(name),
    bytes: read,
    text: async (name: string) => {
      const out = await read(name);
      return out === undefined ? undefined : new TextDecoder().decode(out);
    },
  };
}
