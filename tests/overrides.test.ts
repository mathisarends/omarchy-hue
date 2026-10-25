import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { emptyGroup } from "../src/huego.ts"
import { OVERRIDE_MS, liveState, nudgedBrightness, pruneOverrides, withOverride } from "../src/overrides.ts"

describe("optimistic state", () => {
  const office = { ...emptyGroup(), id: "o", name: "Office", on: false, brightness: 40 }

  it("wins over the bridge while it lasts", () => {
    const overrides = withOverride({}, ["room:o"], { on: true, brightness: 80 }, 1000)
    assert.deepEqual(liveState(office, overrides["room:o"]), { on: true, brightness: 80, scene: "" })
    assert.deepEqual(liveState(office, undefined), { on: false, brightness: 40, scene: "" })
  })

  it("merges patches and expires", () => {
    let overrides = withOverride({}, ["home", "room:o"], { on: false }, 0)
    overrides = withOverride(overrides, ["room:o"], { brightness: 10 }, 1000)
    assert.deepEqual(overrides["room:o"], { on: false, brightness: 10, until: 1000 + OVERRIDE_MS })
    assert.deepEqual(Object.keys(pruneOverrides(overrides, OVERRIDE_MS + 1)), ["room:o"])
  })

  it("handles a group that is not known yet", () => {
    assert.deepEqual(liveState(null, undefined), { on: false, brightness: -1, scene: "" })
  })
})

describe("nudgedBrightness", () => {
  it("steps and clamps", () => {
    assert.equal(nudgedBrightness({ on: true, brightness: 50, scene: "" }, 5), 55)
    assert.equal(nudgedBrightness({ on: true, brightness: 98, scene: "" }, 5), 100)
    assert.equal(nudgedBrightness({ on: true, brightness: 3, scene: "" }, -5), 1)
  })

  it("brightens from off, but does not dim what is off", () => {
    assert.equal(nudgedBrightness({ on: false, brightness: 50, scene: "" }, 5), 5)
    assert.equal(nudgedBrightness({ on: false, brightness: 50, scene: "" }, -5), null)
  })

  it("treats an unknown brightness as full", () => {
    assert.equal(nudgedBrightness({ on: true, brightness: -1, scene: "" }, -5), 95)
  })
})
