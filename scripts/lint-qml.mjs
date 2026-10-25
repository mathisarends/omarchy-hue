// ESLint cannot read QML, so this holds the JavaScript inside *.qml files to
// the `curly: "all"` rule from eslint.config.mjs: every if, else, for and
// while body sits in braces.
//
//   node scripts/lint-qml.mjs [files...]   defaults to *.qml and ui/*.qml

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const DEFAULT_DIRS = [".", "ui"]

/** Where the comment or string starting at `i` ends, or -1 if none starts there. */
function skippedUntil(source, i) {
  const c = source[i]
  const next = source[i + 1]
  if (c === "/" && next === "/") {
    const end = source.indexOf("\n", i)
    return end < 0 ? source.length : end
  }
  if (c === "/" && next === "*") {
    const end = source.indexOf("*/", i + 2)
    return end < 0 ? source.length : end + 2
  }
  if (c === '"' || c === "'" || c === "`") {
    let end = i + 1
    while (end < source.length && source[end] !== c) {
      end += source[end] === "\\" ? 2 : 1
    }
    return Math.min(end + 1, source.length)
  }
  return -1
}

/** Blanks out comments and strings, keeping newlines so lines still match. */
function codeOnly(source) {
  let out = ""
  let i = 0
  while (i < source.length) {
    const end = skippedUntil(source, i)
    if (end < 0) {
      out += source[i]
      i += 1
    } else {
      out += source.slice(i, end).replace(/[^\n]/g, " ")
      i = end
    }
  }
  return out
}

function skipSpace(code, i) {
  while (i < code.length && /\s/.test(code[i])) {
    i += 1
  }
  return i
}

function closingParen(code, open) {
  let depth = 0
  for (let i = open; i < code.length; i++) {
    if (code[i] === "(") {
      depth += 1
    } else if (code[i] === ")") {
      depth -= 1
      if (depth === 0) {
        return i
      }
    }
  }
  return -1
}

function lineOf(code, index) {
  return code.slice(0, index).split("\n").length
}

/** Where the body of the keyword at `index` starts, or -1 if it has none to check. */
function bodyStart(code, word, index) {
  const after = skipSpace(code, index + word.length)
  if (word === "else") {
    const isElseIf = code.startsWith("if", after) && !/[\w$]/.test(code[after + 2] ?? "")
    return isElseIf ? -1 : after
  }
  if (code[after] !== "(") {
    return -1
  }
  const close = closingParen(code, after)
  return close < 0 ? -1 : skipSpace(code, close + 1)
}

/** Every if/else/for/while in `source` whose body is not a block. */
export function findBracelessBodies(source) {
  const code = codeOnly(source)
  const problems = []
  const keyword = /(?<![\w$.])(if|for|while|else)\b/g
  for (const match of code.matchAll(keyword)) {
    const word = match[1]
    const start = bodyStart(code, word, match.index)
    if (start >= 0 && code[start] !== "{") {
      problems.push({ line: lineOf(code, match.index), message: `"${word}" body needs braces` })
    }
  }
  return problems
}

function defaultTargets() {
  return DEFAULT_DIRS
    .filter((dir) => existsSync(dir))
    .flatMap((dir) => readdirSync(dir).filter((name) => name.endsWith(".qml")).map((name) => join(dir, name)))
}

function main(files) {
  const targets = files.length > 0 ? files : defaultTargets()
  let failed = 0
  for (const file of targets) {
    for (const problem of findBracelessBodies(readFileSync(file, "utf8"))) {
      console.error(`${file}:${problem.line}  ${problem.message}  (curly)`)
      failed += 1
    }
  }
  if (failed > 0) {
    console.error(`\n${failed} problem${failed === 1 ? "" : "s"}.`)
    process.exit(1)
  }
  console.log(`${targets.length} QML file${targets.length === 1 ? "" : "s"} clean.`)
}

if (import.meta.main) {
  main(process.argv.slice(2))
}
