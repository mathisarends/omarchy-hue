// Cleaning untrusted input. Room, scene and favorite names come from the
// bridge and from the user's file; ids end up in huego's argv.

export const MAX_NAME = 64

// Newlines, tabs and the other C0 control characters, plus DEL.
// eslint-disable-next-line no-control-regex -- matching them is the point
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** One line of plain text, at most MAX_NAME characters. */
export function cleanName(value: unknown): string {
  const text = String(value ?? "").replace(CONTROL_CHARS, " ").trim()
  return text.length > MAX_NAME ? text.slice(0, MAX_NAME - 1) + "…" : text
}

/** A bridge id, or "" when it holds anything but letters, digits, ".", "_" and "-". */
export function cleanId(value: unknown): string {
  const id = String(value ?? "")
  return /^[A-Za-z0-9._-]{1,64}$/.test(id) ? id : ""
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export function clampPercent(value: number): number {
  const n = Math.round(value)
  if (!isFinite(n)) {
    return 0
  }
  return Math.max(0, Math.min(100, n))
}
