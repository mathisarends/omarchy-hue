// Reading what huego prints: `--json` output, the event stream, errors on
// stderr and exit codes.

import { cleanId, cleanName, clampPercent, isRecord, parseJson } from "./input.ts"

export const MAX_GROUPS = 64
export const MAX_SCENES = 512

export type GroupKind = "home" | "room" | "zone"
export type Status = "loading" | "ok" | "missing" | "notConfigured" | "unreachable" | "error"

/** A room, a zone or the whole home. */
export interface Group {
  id: string
  name: string
  on: boolean
  /** 0-100, or -1 when the bridge did not say. */
  brightness: number
  lightsOn: number
  lightsTotal: number
}

export interface Scene {
  id: string
  name: string
  /** Name of the room or zone the scene belongs to. */
  group: string
  active: boolean
}

export interface HueError {
  code: string
  message: string
}

/** One key per group, shared by optimistic state and the keyboard cursor. */
export function groupKey(kind: GroupKind, id: string): string {
  return kind === "home" ? "home" : `${kind}:${id}`
}

export function emptyGroup(): Group {
  return { id: "", name: "", on: false, brightness: -1, lightsOn: 0, lightsTotal: 0 }
}

export function parseGroup(raw: unknown): Group | null {
  if (!isRecord(raw)) {
    return null
  }
  const lights = Array.isArray(raw.lights) ? raw.lights : []
  return {
    id: cleanId(raw.id),
    name: cleanName(raw.name),
    on: raw.on === true,
    brightness: typeof raw.brightness === "number" ? clampPercent(raw.brightness) : -1,
    lightsOn: lights.filter((light) => isRecord(light) && light.on === true).length,
    lightsTotal: lights.length,
  }
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name)
}

/** `huego room list --json` and `huego zone list --json`, sorted by name. */
export function parseGroups(text: string): Group[] {
  const list = parseJson(text)
  if (!Array.isArray(list)) {
    return []
  }
  return list
    .map(parseGroup)
    .filter((group): group is Group => group !== null && group.id !== "" && group.name !== "")
    .slice(0, MAX_GROUPS)
    .sort(byName)
}

/** `huego home get --json`. */
export function parseHome(text: string): Group {
  return parseGroup(parseJson(text)) ?? emptyGroup()
}

function parseScene(raw: unknown): Scene | null {
  if (!isRecord(raw)) {
    return null
  }
  const id = cleanId(raw.id)
  const name = cleanName(raw.name)
  if (!id || !name) {
    return null
  }
  const active = typeof raw.status === "string" && raw.status !== "" && raw.status !== "inactive"
  return { id, name, group: cleanName(raw.group), active }
}

/** `huego scene list --json`, sorted by name. */
export function parseScenes(text: string): Scene[] {
  const list = parseJson(text)
  if (!Array.isArray(list)) {
    return []
  }
  return list
    .map(parseScene)
    .filter((scene): scene is Scene => scene !== null)
    .slice(0, MAX_SCENES)
    .sort(byName)
}

export function scenesFor(scenes: Scene[], groupName: string): Scene[] {
  const key = groupName.toLowerCase()
  return scenes.filter((scene) => scene.group.toLowerCase() === key)
}

/**
 * What a line from `huego events --json` means for the panel: "scenes" when
 * scenes, rooms or zones changed, "state" for any other event, "" for noise.
 */
export function eventKind(line: string): "scenes" | "state" | "" {
  const event = parseJson(line)
  if (!isRecord(event)) {
    return ""
  }
  return event.type === "scene" || event.type === "room" || event.type === "zone" ? "scenes" : "state"
}

// huego's exit codes, see its README. 127 comes from the launcher when the
// binary is missing.
const EXIT_STATUS: Record<number, Status> = {
  0: "ok",
  4: "notConfigured",
  5: "unreachable",
  127: "missing",
}

export function statusForExit(code: number): Status {
  return EXIT_STATUS[code] ?? "error"
}

/** huego prints errors as a JSON line on stderr; anything else falls back to the last line. */
export function parseError(stderr: string): HueError {
  const lines = stderr.split("\n").map((line) => line.trim()).filter((line) => line !== "")
  for (const line of lines.slice().reverse()) {
    const value = parseJson(line)
    if (isRecord(value) && typeof value.error === "string") {
      return { code: cleanName(value.code), message: cleanName(value.error) }
    }
  }
  return { code: "", message: cleanName(lines[lines.length - 1]) }
}
