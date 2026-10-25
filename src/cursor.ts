// The panel's cursor, shared by keyboard and mouse. Each place it can stop
// has an id:
//
//   status:<i>               a setup button while huego is not connected
//   target                   the brightness slider of the bar target
//   fav:<i> / favedit        a favorite, or "add favorites" when there are none
//   group:<kind>:<id>        a room or zone row
//   slider:<kind>:<id>       the brightness slider of an open row
//   scene:<kind>:<id>:<i>    a scene of an open row
//
// Group ids never contain ":" (see cleanId), so splitting is safe.

import { groupKey, scenesFor } from "./huego.ts"
import type { Group, GroupKind, Scene } from "./huego.ts"

export type StopType = "status" | "target" | "fav" | "favedit" | "group" | "slider" | "scene" | ""

export interface Stop {
  type: StopType
  kind: GroupKind | ""
  id: string
  index: number
}

export interface PanelLayout {
  connected: boolean
  statusActions: number
  favorites: number
  rooms: Group[]
  zones: Group[]
  scenes: Scene[]
  /** groupKey() of the open row, or "". */
  expandedKey: string
}

/** Every stop, top to bottom. */
export function cursorStops(layout: PanelLayout): string[] {
  if (!layout.connected) {
    return Array.from({ length: layout.statusActions }, (_, i) => `status:${i}`)
  }

  const stops = ["target"]
  if (layout.favorites > 0) {
    for (let i = 0; i < layout.favorites; i++) {
      stops.push(`fav:${i}`)
    }
  } else {
    stops.push("favedit")
  }

  const sections: [GroupKind, Group[]][] = [["room", layout.rooms], ["zone", layout.zones]]
  for (const [kind, groups] of sections) {
    for (const group of groups) {
      const key = groupKey(kind, group.id)
      stops.push(`group:${key}`)
      if (key === layout.expandedKey) {
        stops.push(`slider:${key}`)
        scenesFor(layout.scenes, group.name).forEach((_, i) => stops.push(`scene:${key}:${i}`))
      }
    }
  }
  return stops
}

export function parseStop(stop: string): Stop {
  const parts = stop.split(":")
  const type = parts[0] as StopType
  switch (type) {
    case "group":
    case "slider":
      return { type, kind: parts[1] as GroupKind, id: parts[2], index: -1 }
    case "scene":
      return { type, kind: parts[1] as GroupKind, id: parts[2], index: Number(parts[3]) }
    case "fav":
    case "status":
      return { type, kind: "", id: "", index: Number(parts[1]) }
    case "target":
    case "favedit":
      return { type, kind: "", id: "", index: -1 }
    default:
      return { type: "", kind: "", id: "", index: -1 }
  }
}

/** Keeps the cursor where it was; falls back to the row it belonged to, then to the top. */
export function clampStop(stops: string[], current: string): string {
  if (stops.includes(current)) {
    return current
  }
  const stop = parseStop(current)
  const row = stop.kind ? `group:${stop.kind}:${stop.id}` : ""
  if (row && stops.includes(row)) {
    return row
  }
  return stops[0] ?? ""
}

/** j/k: one stop down or up, stopping at the ends. */
export function stepStop(stops: string[], current: string, delta: number): string {
  const index = stops.indexOf(current)
  if (index < 0) {
    return stops[0] ?? ""
  }
  return stops[Math.max(0, Math.min(stops.length - 1, index + delta))]
}

/** h/l along a row of buttons (scenes, favorites, setup); stays put at the ends. */
export function sideStop(stops: string[], current: string, delta: number): string {
  const split = current.lastIndexOf(":")
  const index = Number(current.slice(split + 1))
  if (split < 0 || !isFinite(index)) {
    return current
  }
  const next = current.slice(0, split + 1) + String(index + delta)
  return stops.includes(next) ? next : current
}

/** Stops where h/l change brightness instead of moving. */
export function adjustsBrightness(stop: Stop): boolean {
  return stop.type === "target" || stop.type === "group" || stop.type === "slider"
}
