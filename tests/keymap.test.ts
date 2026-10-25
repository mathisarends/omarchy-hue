import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  DEFAULT_KEYS, favoriteKeyLabel, keyHints, keyLabel, keyOfEvent, lookupKey, normalizeKey, parseBinding, parseKeymap,
} from "../src/keymap.ts"

const CTRL = 0x04000000
const SHIFT = 0x02000000
const ALT = 0x08000000

describe("normalizeKey", () => {
  it("keeps characters as typed", () => {
    assert.equal(normalizeKey("j"), "j")
    assert.equal(normalizeKey("G"), "G")
    assert.equal(normalizeKey("?"), "?")
    assert.equal(normalizeKey("+"), "+")
    assert.equal(normalizeKey("ctrl++"), "ctrl++")
  })

  it("names keys whatever their case", () => {
    assert.equal(normalizeKey("down"), "Down")
    assert.equal(normalizeKey("PAGEUP"), "PageUp")
    assert.equal(normalizeKey("pgdown"), "PageDown")
    assert.equal(normalizeKey("f5"), "F5")
  })

  it("writes modifiers in one order", () => {
    assert.equal(normalizeKey("shift+ctrl+Down"), "ctrl+shift+Down")
    assert.equal(normalizeKey("Control+o"), "ctrl+o")
    assert.equal(normalizeKey("meta+h"), "super+h")
  })

  it("folds shift into characters", () => {
    assert.equal(normalizeKey("shift+a"), "A")
    assert.equal(normalizeKey("ctrl+shift+a"), "ctrl+A")
  })

  it("rejects what is not a key", () => {
    assert.equal(normalizeKey("Escape"), "")
    assert.equal(normalizeKey("Tab"), "")
    assert.equal(normalizeKey("hyper+a"), "")
    assert.equal(normalizeKey("ctrl+"), "")
    assert.equal(normalizeKey("jk"), "")
  })
})

describe("keyOfEvent", () => {
  it("reads characters from the text", () => {
    assert.equal(keyOfEvent(0x4a, "j", 0), "j")
    assert.equal(keyOfEvent(0x47, "G", SHIFT), "G")
  })

  it("reads named keys from the code", () => {
    assert.equal(keyOfEvent(0x01000015, "", 0), "Down")
    assert.equal(keyOfEvent(0x20, " ", 0), "Space")
    assert.equal(keyOfEvent(0x01000004, "\r", 0), "Return")
    assert.equal(keyOfEvent(0x01000015, "", CTRL | SHIFT), "ctrl+shift+Down")
  })

  it("reads ctrl+letter from the code", () => {
    assert.equal(keyOfEvent(0x4f, "\u000f", CTRL), "ctrl+o")
    assert.equal(keyOfEvent(0x4f, "\u000f", CTRL | SHIFT), "ctrl+O")
    assert.equal(keyOfEvent(0x41, "a", ALT), "alt+a")
  })

  it("matches what normalizeKey writes", () => {
    assert.equal(keyOfEvent(0x4f, "\u000f", CTRL), normalizeKey("Ctrl+o"))
    assert.equal(keyOfEvent(0x41, "A", SHIFT), normalizeKey("shift+a"))
  })

  it("ignores Escape, Tab and lone modifiers", () => {
    assert.equal(keyOfEvent(0x01000000, "\u001b", 0), "")
    assert.equal(keyOfEvent(0x01000001, "\t", 0), "")
    assert.equal(keyOfEvent(0x01000021, "", CTRL), "")
  })
})

describe("parseBinding", () => {
  it("splits on spaces and drops repeats and junk", () => {
    assert.deepEqual(parseBinding("j  Down j nope"), ["j", "Down"])
  })

  it("takes only strings", () => {
    assert.deepEqual(parseBinding(["j"]), [])
    assert.deepEqual(parseBinding(undefined), [])
  })
})

describe("parseKeymap", () => {
  it("binds the defaults", () => {
    const keymap = parseKeymap(undefined)
    assert.deepEqual(lookupKey(keymap, "j"), { type: "action", action: "down" })
    assert.deepEqual(lookupKey(keymap, "Down"), { type: "action", action: "down" })
    assert.deepEqual(lookupKey(keymap, "A"), { type: "action", action: "allOn" })
    assert.deepEqual(lookupKey(keymap, "3"), { type: "favorite", index: 2 })
    assert.deepEqual(lookupKey(keymap, "z"), { type: "none" })
  })

  it("replaces only the actions it names", () => {
    const keymap = parseKeymap({ down: "n", allOff: "ctrl+o" })
    assert.deepEqual(lookupKey(keymap, "n"), { type: "action", action: "down" })
    assert.deepEqual(lookupKey(keymap, "j"), { type: "none" })
    assert.deepEqual(lookupKey(keymap, "ctrl+o"), { type: "action", action: "allOff" })
    assert.deepEqual(lookupKey(keymap, "k"), { type: "action", action: "up" })
  })

  it("lets an empty binding turn an action off", () => {
    assert.deepEqual(lookupKey(parseKeymap({ allOff: "" }), "a"), { type: "none" })
  })

  it("gives a contested key to the first action and keeps actions over favorites", () => {
    const keymap = parseKeymap({ up: "j", favorites: "a s 1" })
    assert.deepEqual(lookupKey(keymap, "j"), { type: "action", action: "down" })
    assert.deepEqual(lookupKey(keymap, "a"), { type: "action", action: "allOff" })
    assert.deepEqual(lookupKey(keymap, "1"), { type: "favorite", index: 2 })
  })

  it("survives settings that are not an object", () => {
    assert.deepEqual(lookupKey(parseKeymap("j"), "j"), { type: "action", action: "down" })
    assert.deepEqual(lookupKey(parseKeymap(null), "j"), { type: "action", action: "down" })
  })

  it("has a valid default for every binding", () => {
    for (const [binding, keys] of Object.entries(DEFAULT_KEYS)) {
      assert.equal(parseBinding(keys).length, keys.split(" ").length, binding)
    }
  })
})

describe("labels", () => {
  it("shows the first key of an action", () => {
    const keymap = parseKeymap({ allOff: "ctrl+shift+Down a" })
    assert.equal(keyLabel(keymap, "down"), "j")
    assert.equal(keyLabel(keymap, "allOff"), "Ctrl+Shift+Down")
    assert.equal(keyLabel(parseKeymap({ refresh: "" }), "refresh"), "")
    assert.equal(keyLabel(keymap, "activate"), "Enter")
    assert.equal(keyLabel(parseKeymap({ allOn: "ctrl++" }), "allOn"), "Ctrl++")
  })

  it("lists hints for bound actions only", () => {
    assert.deepEqual(keyHints(parseKeymap({ expand: "", allOff: "", left: "Left", right: "Right" })), [
      { keys: "j/k", label: "hint.move" },
      { keys: "Left/Right", label: "hint.brightness" },
      { keys: "Enter", label: "hint.toggle" },
    ])
  })

  it("shows single-character favorite keys only", () => {
    const keymap = parseKeymap({ favorites: "1 F2" })
    assert.equal(favoriteKeyLabel(keymap, 0), "1")
    assert.equal(favoriteKeyLabel(keymap, 1), "")
    assert.equal(favoriteKeyLabel(keymap, 5), "")
  })
})
