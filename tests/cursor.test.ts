import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { adjustsBrightness, clampStop, cursorStops, parseStop, sideStop, stepStop } from "../src/cursor.ts"
import type { PanelLayout } from "../src/cursor.ts"
import { parseGroups, parseScenes } from "../src/huego.ts"

const rooms = parseGroups(JSON.stringify([
  { id: "k", name: "Kitchen", on: true, lights: [] },
  { id: "o", name: "Office", on: false, lights: [] },
]))
const scenes = parseScenes(JSON.stringify([
  { id: "s1", name: "Relax", group: "Office" },
  { id: "s2", name: "Bright", group: "Office" },
]))

function layout(patch: Partial<PanelLayout> = {}): PanelLayout {
  return { connected: true, statusActions: 0, favorites: 2, rooms, zones: [], scenes, expandedKey: "", ...patch }
}

describe("cursorStops", () => {
  it("lists target, favorites and rows top to bottom", () => {
    assert.deepEqual(cursorStops(layout()), ["target", "fav:0", "fav:1", "group:room:k", "group:room:o"])
  })

  it("adds the slider and scenes of the open row", () => {
    assert.deepEqual(cursorStops(layout({ favorites: 0, expandedKey: "room:o" })), [
      "target", "favedit", "group:room:k", "group:room:o", "slider:room:o", "scene:room:o:0", "scene:room:o:1",
    ])
  })

  it("offers only the setup buttons while not connected", () => {
    assert.deepEqual(cursorStops(layout({ connected: false, statusActions: 2 })), ["status:0", "status:1"])
  })
})

describe("parseStop", () => {
  it("reads every kind of stop", () => {
    assert.deepEqual(parseStop("scene:room:o:1"), { type: "scene", kind: "room", id: "o", index: 1 })
    assert.deepEqual(parseStop("group:zone:z"), { type: "group", kind: "zone", id: "z", index: -1 })
    assert.deepEqual(parseStop("fav:3"), { type: "fav", kind: "", id: "", index: 3 })
    assert.deepEqual(parseStop("target"), { type: "target", kind: "", id: "", index: -1 })
    assert.deepEqual(parseStop("bogus"), { type: "", kind: "", id: "", index: -1 })
  })

  it("knows where h/l change brightness", () => {
    assert.equal(adjustsBrightness(parseStop("slider:room:o")), true)
    assert.equal(adjustsBrightness(parseStop("scene:room:o:0")), false)
  })
})

describe("moving the cursor", () => {
  const stops = cursorStops(layout({ expandedKey: "room:o" }))

  it("steps and stops at the ends", () => {
    assert.equal(stepStop(stops, "target", -1), "target")
    assert.equal(stepStop(stops, "target", 1), "fav:0")
    assert.equal(stepStop(stops, "missing", 1), "target")
  })

  it("walks along a row of buttons", () => {
    assert.equal(sideStop(stops, "scene:room:o:0", 1), "scene:room:o:1")
    assert.equal(sideStop(stops, "scene:room:o:1", 1), "scene:room:o:1")
    assert.equal(sideStop(stops, "target", 1), "target")
  })

  it("falls back to the row when its scenes close", () => {
    const closed = cursorStops(layout())
    assert.equal(clampStop(closed, "scene:room:o:1"), "group:room:o")
    assert.equal(clampStop(closed, "group:room:gone"), "target")
    assert.equal(clampStop([], "target"), "")
  })
})
