// Building huego command lines and queueing them.

import { cleanName } from "./input.ts"
import type { Group, GroupKind } from "./huego.ts"

// Runs huego through sh so a missing binary exits 127 instead of failing to
// spawn, which Process reports without an exit code. Arguments travel as
// positional parameters and are never parsed by the shell.
//
// A bare name is also looked up in ~/.local/bin (where install.sh puts it) and
// the Go bin directory, because the shell may start with a shorter PATH than
// your terminal.
export const LAUNCH = [
  'case "$0" in */*) ;; *)',
  '  command -v "$0" >/dev/null 2>&1 ||',
  '  for dir in "$HOME/.local/bin" "${GOBIN:-${GOPATH:-$HOME/go}/bin}"; do',
  '    if [ -x "$dir/$0" ]; then exec "$dir/$0" "$@"; fi',
  '  done ;;',
  'esac',
  'command -v "$0" >/dev/null 2>&1 || exit 127',
  'exec "$0" "$@"',
].join("\n")

/** Pause after a command that changes a group. The bridge takes about one per second. */
export const GROUP_GAP_MS = 350
export const COMMAND_GAP_MS = 80

/** What the bar icon controls: the setting "home", "room:<name>" or "zone:<name>". */
export interface Target {
  kind: GroupKind
  name: string
}

export interface Command {
  /** Commands with the same key replace each other while they wait. */
  key: string
  args: string[]
  gap: number
}

export function parseTarget(value: unknown): Target {
  const match = /^(room|zone)\s*:\s*(.+)$/i.exec(String(value ?? "").trim())
  if (!match) {
    return { kind: "home", name: "" }
  }
  return { kind: match[1].toLowerCase() as GroupKind, name: cleanName(match[2]) }
}

/** Finds a room or zone by id or by name, ignoring case. */
export function findGroup(groups: Group[], name: string): Group | null {
  const key = name.trim().toLowerCase()
  if (!key) {
    return null
  }
  return groups.find((group) => group.id === key || group.name.toLowerCase() === key) ?? null
}

/** `huego <kind> <verb> [id] [extra...] --json`; the home takes no id. */
export function controlArgs(kind: GroupKind, id: string, verb: string, extra: string[] = []): string[] {
  const target = kind === "home" ? [] : [id]
  return [kind, verb, ...target, ...extra, "--json"]
}

export function fadeArgs(seconds: number): string[] {
  return seconds > 0 ? ["-t", String(Math.round(seconds * 10) / 10)] : []
}

/** Takes a scene id or a qualified name such as "Living room/Relax". */
export function sceneArgs(scene: string, fadeSeconds: number): string[] {
  return ["scene", "activate", scene, ...fadeArgs(fadeSeconds), "--json"]
}

/** Adds a command; a waiting command with the same key is replaced in place. */
export function enqueue(queue: Command[], command: Command): Command[] {
  const index = command.key ? queue.findIndex((queued) => queued.key === command.key) : -1
  if (index < 0) {
    return [...queue, command]
  }
  const next = queue.slice()
  next[index] = command
  return next
}
