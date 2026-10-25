import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { controlArgs, enqueue, fadeArgs, findGroup, parseTarget, sceneArgs } from "../src/commands.ts"
import type { Command } from "../src/commands.ts"
import { parseGroups } from "../src/huego.ts"

describe("parseTarget", () => {
  it("reads home, rooms and zones", () => {
    assert.deepEqual(parseTarget("home"), { kind: "home", name: "" })
    assert.deepEqual(parseTarget(""), { kind: "home", name: "" })
    assert.deepEqual(parseTarget(undefined), { kind: "home", name: "" })
    assert.deepEqual(parseTarget("Room: Living room"), { kind: "room", name: "Living room" })
    assert.deepEqual(parseTarget("zone:Upstairs"), { kind: "zone", name: "Upstairs" })
  })
})

describe("findGroup", () => {
  const rooms = parseGroups(JSON.stringify([{ id: "abc", name: "Living room", on: true, lights: [] }]))

  it("matches by name, ignoring case, or by id", () => {
    assert.equal(findGroup(rooms, "living ROOM")?.id, "abc")
    assert.equal(findGroup(rooms, "abc")?.id, "abc")
    assert.equal(findGroup(rooms, "Kitchen"), null)
    assert.equal(findGroup(rooms, ""), null)
  })
})

describe("command lines", () => {
  it("leave the id out for the home", () => {
    assert.deepEqual(controlArgs("home", "ignored", "off", fadeArgs(3)), ["home", "off", "-t", "3", "--json"])
    assert.deepEqual(controlArgs("room", "abc", "brightness", ["40"]), ["room", "brightness", "abc", "40", "--json"])
  })

  it("fade only when asked to", () => {
    assert.deepEqual(fadeArgs(0), [])
    assert.deepEqual(fadeArgs(1.25), ["-t", "1.3"])
    assert.deepEqual(sceneArgs("Office/Relax", 0), ["scene", "activate", "Office/Relax", "--json"])
  })
})

describe("enqueue", () => {
  const command = (key: string, value: string): Command => ({ key, args: [value], gap: 0 })

  it("replaces a waiting command with the same key in place", () => {
    let queue = enqueue([], command("room:a", "10"))
    queue = enqueue(queue, command("room:b", "20"))
    queue = enqueue(queue, command("room:a", "30"))
    assert.deepEqual(queue.map((queued) => queued.args[0]), ["30", "20"])
  })

  it("never merges commands without a key", () => {
    const queue = enqueue(enqueue([], command("", "1")), command("", "2"))
    assert.equal(queue.length, 2)
  })
})
