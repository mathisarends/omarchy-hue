// lib/hue.js is what QML actually loads. Run it the way QML does, as one
// script, and check it exposes every export of src/ under the same name.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { createContext, runInContext } from "node:vm"

import * as commands from "../src/commands.ts"
import * as cursor from "../src/cursor.ts"
import * as favorites from "../src/favorites.ts"
import * as glyphs from "../src/glyphs.ts"
import * as huego from "../src/huego.ts"
import * as input from "../src/input.ts"
import * as keymap from "../src/keymap.ts"
import * as overrides from "../src/overrides.ts"

const modules = { commands, cursor, favorites, glyphs, huego, input, keymap, overrides }

function loadLibrary(): Record<string, unknown> {
  const source = readFileSync(new URL("../lib/hue.js", import.meta.url), "utf8")
  assert.match(source, /^\.pragma library\n/)
  const context = createContext({})
  runInContext(source.replace(/^\.pragma library\n/, ""), context)
  return context
}

describe("lib/hue.js", () => {
  const library = loadLibrary()

  for (const [name, module] of Object.entries(modules)) {
    it(`exposes everything ${name}.ts exports`, () => {
      for (const [key, value] of Object.entries(module)) {
        assert.equal(typeof library[key], typeof value, `${name}.ts: ${key}`)
      }
    })
  }

  it("runs", () => {
    const parseFavorites = library.parseFavorites as typeof favorites.parseFavorites
    const template = library.FAVORITES_TEMPLATE as string
    assert.equal(parseFavorites(template).length, 2)
  })

  it("spells every glyph as one code point", () => {
    for (const [name, glyph] of Object.entries(library.Glyph as Record<string, string>)) {
      assert.equal([...glyph].length, 1, name)
    }
  })
})
