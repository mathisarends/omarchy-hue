// Optimistic state. A change shows up in the panel the moment it is asked
// for and wins over what the bridge reports until the bridge has caught up.

import type { Group } from "./huego.ts"

export const OVERRIDE_MS = 3500

export interface Override {
  on?: boolean
  brightness?: number
  scene?: string
  until: number
}

/** Keyed by groupKey(). */
export type Overrides = Record<string, Override>

export interface LiveState {
  on: boolean
  /** 0-100, or -1 when unknown. */
  brightness: number
  /** Id of the scene just activated, or "". */
  scene: string
}

export function liveState(group: Group | null, override: Override | undefined): LiveState {
  return {
    on: override?.on ?? group?.on ?? false,
    brightness: override?.brightness ?? group?.brightness ?? -1,
    scene: override?.scene ?? "",
  }
}

export function withOverride(overrides: Overrides, keys: string[], patch: Omit<Override, "until">, now: number): Overrides {
  const next: Overrides = { ...overrides }
  for (const key of keys) {
    next[key] = { ...next[key], ...patch, until: now + OVERRIDE_MS }
  }
  return next
}

export function pruneOverrides(overrides: Overrides, now: number): Overrides {
  const next: Overrides = {}
  for (const key of Object.keys(overrides)) {
    if (overrides[key].until > now) {
      next[key] = overrides[key]
    }
  }
  return next
}

/** Brightness after a step of delta percent; "on at unknown brightness" counts as full. */
export function nudgedBrightness(state: LiveState, delta: number): number | null {
  if (!state.on && delta < 0) {
    return null
  }
  const base = !state.on ? 0 : state.brightness < 0 ? 100 : state.brightness
  return Math.max(1, Math.min(100, base + delta))
}
