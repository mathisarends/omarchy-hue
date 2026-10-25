import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { FAVORITES_TEMPLATE, favoriteArgs, findFavorite, parseFavorites, tokenize } from "../src/favorites.ts"

describe("tokenize", () => {
  it("splits words and honours quotes", () => {
    assert.deepEqual(tokenize('scene activate "Living room/Relax" -t 2'), [["scene", "activate", "Living room/Relax", "-t", "2"]])
    assert.deepEqual(tokenize("light color 'Desk Lamp' '#ff8800'"), [["light", "color", "Desk Lamp", "#ff8800"]])
    assert.deepEqual(tokenize('room on "Kids\\" room"'), [["room", "on", 'Kids" room']])
    assert.deepEqual(tokenize('room on ""'), [["room", "on", ""]])
  })

  it("splits commands on ;", () => {
    assert.deepEqual(tokenize("room on Office -b 100 ; room temperature Office 5000"), [
      ["room", "on", "Office", "-b", "100"],
      ["room", "temperature", "Office", "5000"],
    ])
  })

  it("rejects an open quote", () => {
    assert.equal(tokenize('room on "unterminated'), null)
  })

  it("never expands anything", () => {
    assert.deepEqual(tokenize("home off $(reboot) `id` && x | y"), [["home", "off", "$(reboot)", "`id`", "&&", "x", "|", "y"]])
  })
})

describe("parseFavorites", () => {
  const favorites = parseFavorites([
    "# comment",
    "",
    "Good night = home off -t 10",
    'Movie = huego scene activate "Living room/Dimmed"',
    'Broken = room on "oops',
    "Sneaky = setup --ip 1.2.3.4",
    "Half sneaky = home on ; events",
    "No equals sign",
    " = home on",
    "Bare = huego",
    "Two = home on ; room off Kitchen",
  ].join("\n"))

  it("keeps only lines that parse and run allowed commands", () => {
    assert.deepEqual(favorites.map((favorite) => favorite.label), ["Good night", "Movie", "Two"])
  })

  it("drops a leading huego and remembers the line", () => {
    assert.deepEqual(favorites[1].commands, [["scene", "activate", "Living room/Dimmed"]])
    assert.equal(favorites[1].line, 4)
    assert.equal(favorites[2].commands.length, 2)
  })

  it("finds a favorite by label, ignoring case", () => {
    assert.equal(findFavorite(favorites, "good NIGHT")?.line, 3)
    assert.equal(findFavorite(favorites, "nope"), null)
  })

  it("parses the starter file", () => {
    assert.equal(parseFavorites(FAVORITES_TEMPLATE).length, 2)
  })
})

describe("favoriteArgs", () => {
  it("asks for JSON once", () => {
    assert.deepEqual(favoriteArgs(["home", "off"]), ["home", "off", "--json"])
    assert.deepEqual(favoriteArgs(["home", "off", "--json"]), ["home", "off", "--json"])
  })
})
