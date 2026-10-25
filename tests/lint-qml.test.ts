import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { findBracelessBodies } from "../scripts/lint-qml.mjs"

const lines = (source: string): number[] => findBracelessBodies(source).map((problem) => problem.line)

describe("lint-qml", () => {
  it("accepts bodies in braces", () => {
    assert.deepEqual(lines("onClicked: {\n  if (a) {\n    b()\n  } else if (c) {\n    d()\n  } else {\n    e()\n  }\n}"), [])
    assert.deepEqual(lines("for (let i = 0; i < n; i++) {\n}\nwhile (x) {\n}"), [])
  })

  it("flags bodies without braces", () => {
    assert.deepEqual(lines("onClicked: if (a) b()"), [1])
    assert.deepEqual(lines("if (a) {\n  b()\n} else\n  c()"), [3])
    assert.deepEqual(lines("\nfor (const x of xs) use(x)\nwhile (f(g(x))) step()"), [2, 3])
  })

  it("ignores keywords inside strings and comments", () => {
    assert.deepEqual(lines('text: "if (x) y"\n// if (a) b()\n/* while (1) go() */'), [])
  })

  it("ignores properties that happen to share a name", () => {
    assert.deepEqual(lines("x: model.if\ny: elsewhere"), [])
  })
})
