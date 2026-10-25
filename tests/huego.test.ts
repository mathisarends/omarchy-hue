import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { MAX_NAME } from "../src/input.ts"
import { eventKind, parseError, parseGroups, parseHome, parseScenes, scenesFor, statusForExit } from "../src/huego.ts"

describe("parseGroups", () => {
  it("counts lights and sorts by name", () => {
    const rooms = parseGroups(JSON.stringify([
      { id: "b", name: "Kitchen", on: false, lights: [{ id: "1", on: false }] },
      { id: "a", name: "Bedroom", on: true, brightness: 61.4, lights: [{ id: "2", on: true }, { id: "3", on: false }] },
    ]))
    assert.deepEqual(rooms, [
      { id: "a", name: "Bedroom", on: true, brightness: 61, lightsOn: 1, lightsTotal: 2 },
      { id: "b", name: "Kitchen", on: false, brightness: -1, lightsOn: 0, lightsTotal: 1 },
    ])
  })

  it("survives garbage", () => {
    assert.deepEqual(parseGroups("not json"), [])
    assert.deepEqual(parseGroups("null"), [])
    assert.deepEqual(parseGroups('{"a": 1}'), [])
    assert.deepEqual(parseGroups('[null, 3, "x"]'), [])
  })

  it("drops ids that could be read as anything but an id", () => {
    const rooms = parseGroups(JSON.stringify([
      { id: "x; rm -rf ~", name: "Evil", on: true, lights: [] },
      { id: "room:1", name: "Colon", on: true, lights: [] },
    ]))
    assert.deepEqual(rooms, [])
  })

  it("keeps markup as plain text and drops control characters", () => {
    const [room] = parseGroups(JSON.stringify([{ id: "a", name: '<img src="https://example.invalid/t">\n', on: true, lights: [] }]))
    assert.equal(room.name, '<img src="https://example.invalid/t">')
  })

  it("caps long names", () => {
    const [room] = parseGroups(JSON.stringify([{ id: "a", name: "x".repeat(500), on: true, lights: [] }]))
    assert.equal(room.name.length, MAX_NAME)
  })
})

describe("parseHome", () => {
  it("falls back to an empty, switched-off home", () => {
    assert.equal(parseHome("").on, false)
    assert.equal(parseHome("").lightsTotal, 0)
  })
})

describe("scenes", () => {
  const scenes = parseScenes(JSON.stringify([
    { id: "s1", name: "Relax", group: "Office", target: "Office/Relax", status: "static" },
    { id: "s2", name: "Bright", group: "Office", target: "Office/Bright", status: "inactive" },
    { id: "s3", name: "Relax", group: "Kitchen", target: "Kitchen/Relax" },
  ]))

  it("knows their room, ignoring case, and whether they are active", () => {
    const office = scenesFor(scenes, "office").map((scene) => [scene.name, scene.active])
    assert.deepEqual(office, [["Bright", false], ["Relax", true]])
  })

  it("survives garbage", () => {
    assert.deepEqual(parseScenes("[1, {}]"), [])
  })
})

describe("eventKind", () => {
  it("tells scene changes from state changes", () => {
    assert.equal(eventKind('{"type":"scene"}'), "scenes")
    assert.equal(eventKind('{"type":"room"}'), "scenes")
    assert.equal(eventKind('{"type":"grouped_light"}'), "state")
    assert.equal(eventKind("connected"), "")
  })
})

describe("exit codes and errors", () => {
  it("map exit codes to states", () => {
    assert.equal(statusForExit(0), "ok")
    assert.equal(statusForExit(4), "notConfigured")
    assert.equal(statusForExit(5), "unreachable")
    assert.equal(statusForExit(127), "missing")
    assert.equal(statusForExit(1), "error")
  })

  it("read the JSON error huego prints", () => {
    const error = parseError('warning\n{"error":"no room matches \\"Kitchn\\"","code":"not_found"}\n')
    assert.deepEqual(error, { code: "not_found", message: 'no room matches "Kitchn"' })
  })

  it("fall back to the last line", () => {
    assert.equal(parseError("first\nplain failure\n\n").message, "plain failure")
    assert.equal(parseError("").message, "")
  })
})
