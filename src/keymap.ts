// Panel shortcuts. Every action can be rebound in the widget's settings:
//
//   "keys": { "down": "j Down", "allOff": "a ctrl+o", "favorites": "1 2 3" }
//
// A binding is a list of keys separated by spaces. A key is a single
// character ("j", "A", "?") or a named key ("Down", "Space", "F5"), with
// optional "ctrl+", "alt+", "super+" or "shift+" in front. Characters match
// what they type, so "A" already means Shift+a.
//
// Escape and Tab are not rebindable: every Omarchy panel closes on Escape and
// moves to the next panel on Tab.

export type Action =
  | "down" | "up" | "left" | "right" | "first" | "last"
  | "activate" | "expand" | "close"
  | "allOff" | "allOn" | "refresh" | "editFavorites"

/** "favorites" is special: its n-th key runs the n-th favorite. */
export type Binding = Action | "favorites"

export const DEFAULT_KEYS: Readonly<Record<Binding, string>> = {
  down: "j Down",
  up: "k Up",
  left: "h Left",
  right: "l Right",
  first: "g Home",
  last: "G End",
  activate: "Return Enter Space",
  expand: "o s",
  close: "q",
  allOff: "a",
  allOn: "A",
  refresh: "r",
  editFavorites: "e",
  favorites: "1 2 3 4 5 6 7 8 9",
}

export const MAX_KEYS_PER_BINDING = 12

// Qt key codes (Qt::Key) for the keys that have names.
const NAMED_KEYS: Readonly<Record<string, number>> = {
  Backspace: 0x01000003,
  Return: 0x01000004,
  Enter: 0x01000005,
  Insert: 0x01000006,
  Delete: 0x01000007,
  Home: 0x01000010,
  End: 0x01000011,
  Left: 0x01000012,
  Up: 0x01000013,
  Right: 0x01000014,
  Down: 0x01000015,
  PageUp: 0x01000016,
  PageDown: 0x01000017,
  Space: 0x20,
  F1: 0x01000030,
  F2: 0x01000031,
  F3: 0x01000032,
  F4: 0x01000033,
  F5: 0x01000034,
  F6: 0x01000035,
  F7: 0x01000036,
  F8: 0x01000037,
  F9: 0x01000038,
  F10: 0x01000039,
  F11: 0x0100003a,
  F12: 0x0100003b,
}

const ALIASES: Readonly<Record<string, string>> = {
  del: "Delete",
  pgup: "PageUp",
  pgdown: "PageDown",
}

// Qt modifier bits (Qt::KeyboardModifier), in the order they are written.
const MODIFIERS: readonly (readonly [string, number])[] = [
  ["ctrl", 0x04000000],
  ["alt", 0x08000000],
  ["super", 0x10000000],
  ["shift", 0x02000000],
]

const MODIFIER_ALIASES: Readonly<Record<string, string>> = { control: "ctrl", meta: "super", win: "super", cmd: "super" }

const NAME_BY_LOWERCASE = new Map(Object.keys(NAMED_KEYS).map((name) => [name.toLowerCase(), name]))
const NAME_BY_CODE = new Map(Object.entries(NAMED_KEYS).map(([name, code]) => [code, name]))

function hasKey(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key)
}

function namedKey(word: string): string {
  const lower = word.toLowerCase()
  return ALIASES[lower] ?? NAME_BY_LOWERCASE.get(lower) ?? ""
}

function withModifiers(modifiers: Set<string>, key: string): string {
  const prefix = MODIFIERS.filter(([name]) => modifiers.has(name)).map(([name]) => `${name}+`)
  return prefix.join("") + key
}

/** "ctrl+shift+Down" -> ["ctrl", "shift"] and "Down"; the key itself may be "+". */
function splitKey(spec: string): { modifiers: string[]; key: string } {
  const split = spec.length > 1 ? spec.lastIndexOf("+", spec.length - 2) : -1
  return {
    modifiers: split < 0 ? [] : spec.slice(0, split).split("+"),
    key: spec.slice(split + 1),
  }
}

/** Canonical form of one key from a binding, or "" when it is not a key. */
export function normalizeKey(spec: string): string {
  const { modifiers: parts, key } = splitKey(spec)
  const modifiers = new Set(parts.map((part) => {
    const lower = part.toLowerCase()
    return MODIFIER_ALIASES[lower] ?? lower
  }))
  if (key === "" || [...modifiers].some((name) => !MODIFIERS.some(([known]) => known === name))) {
    return ""
  }

  if (key.length > 1) {
    const name = namedKey(key)
    return name === "" ? "" : withModifiers(modifiers, name)
  }
  // Shift on a character is part of the character: "shift+a" is "A".
  const character = modifiers.delete("shift") ? key.toUpperCase() : key
  return withModifiers(modifiers, character)
}

function isPrintable(text: string): boolean {
  return text.length === 1 && text > " " && text !== "\u007f"
}

/** The canonical key of a key press, in the same form normalizeKey() gives. */
export function keyOfEvent(code: number, text: string, modifiers: number): string {
  const held = new Set(MODIFIERS.filter(([, bit]) => (modifiers & bit) !== 0).map(([name]) => name))
  const named = NAME_BY_CODE.get(code)
  if (named !== undefined) {
    return withModifiers(held, named)
  }

  // Ctrl+letter types a control character, so fall back to the key code,
  // which Qt gives as the uppercase letter.
  let character = text
  if (!isPrintable(character)) {
    if (code <= 0x20 || code >= 0x7f) {
      return ""
    }
    const fromCode = String.fromCharCode(code)
    character = held.has("shift") ? fromCode.toUpperCase() : fromCode.toLowerCase()
  }
  held.delete("shift")
  return withModifiers(held, character)
}

/** The keys of one binding, in canonical form and without repeats. */
export function parseBinding(value: unknown): string[] {
  if (typeof value !== "string") {
    return []
  }
  const keys = value.split(/\s+/).map(normalizeKey).filter((key) => key !== "")
  return [...new Set(keys)].slice(0, MAX_KEYS_PER_BINDING)
}

export interface Keymap {
  /** Canonical key -> action. */
  actions: Record<string, Action>
  /** Canonical key -> favorite index. */
  favorites: Record<string, number>
}

/** Builds the keymap from the "keys" setting; actions left out keep their defaults. */
export function parseKeymap(setting: unknown): Keymap {
  const custom = setting !== null && typeof setting === "object" ? setting as Record<string, unknown> : {}
  const keysOf = (binding: Binding): string[] =>
    parseBinding(hasKey(custom, binding) ? custom[binding] : DEFAULT_KEYS[binding])

  const keymap: Keymap = { actions: {}, favorites: {} }
  for (const binding of Object.keys(DEFAULT_KEYS) as Binding[]) {
    if (binding === "favorites") {
      continue
    }
    for (const key of keysOf(binding)) {
      // When two actions claim a key, the first one keeps it.
      keymap.actions[key] ??= binding
    }
  }
  keysOf("favorites").forEach((key, index) => {
    // An action wins over a favorite slot on the same key.
    if (!hasKey(keymap.actions, key)) {
      keymap.favorites[key] = index
    }
  })
  return keymap
}

export type KeyResult =
  | { type: "action"; action: Action }
  | { type: "favorite"; index: number }
  | { type: "none" }

export function lookupKey(keymap: Keymap, key: string): KeyResult {
  if (hasKey(keymap.actions, key)) {
    return { type: "action", action: keymap.actions[key] }
  }
  if (hasKey(keymap.favorites, key)) {
    return { type: "favorite", index: keymap.favorites[key] }
  }
  return { type: "none" }
}

// How keys read in the panel. "Return" is the key everyone calls Enter.
const DISPLAY_NAMES: Readonly<Record<string, string>> = { Return: "Enter" }

/** The first key bound to an action, written for people: "Ctrl+o", "j", "". */
export function keyLabel(keymap: Keymap, action: Action): string {
  const key = Object.keys(keymap.actions).find((candidate) => keymap.actions[candidate] === action) ?? ""
  const { modifiers, key: name } = splitKey(key)
  const prefix = modifiers.map((modifier) => `${modifier[0].toUpperCase()}${modifier.slice(1)}+`)
  return prefix.join("") + (DISPLAY_NAMES[name] ?? name)
}

export interface KeyHint {
  /** "j/k" */
  keys: string
  /** Translation key of what the keys do. */
  label: string
}

const HINTS: readonly (readonly [readonly Action[], string])[] = [
  [["down", "up"], "hint.move"],
  [["left", "right"], "hint.brightness"],
  [["activate"], "hint.toggle"],
  [["expand"], "hint.scenes"],
  [["allOff"], "hint.allOff"],
]

/** The hint line at the bottom of the panel; actions without a key are left out. */
export function keyHints(keymap: Keymap): KeyHint[] {
  return HINTS
    .map(([actions, label]) => ({
      keys: actions.map((action) => keyLabel(keymap, action)).filter((key) => key !== "").join("/"),
      label,
    }))
    .filter((hint) => hint.keys !== "")
}

/** The key that runs a favorite, written for people, or "". */
export function favoriteKeyLabel(keymap: Keymap, index: number): string {
  const key = Object.keys(keymap.favorites).find((candidate) => keymap.favorites[candidate] === index) ?? ""
  return key.length === 1 ? key : ""
}
