// Bundles tsc's output (build/*.js, one ES module per src/*.ts) into
// lib/hue.js, the QML JavaScript library the widget imports as `Hue`.
//
// QML libraries cannot import modules, so the modules are concatenated in
// dependency order: imports are dropped, `export` goes, and top-level
// const/let become var, which is what QML reads from a library. All modules
// then share one scope, so a name declared twice fails the build.
//
//   node scripts/build.mjs           write lib/hue.js
//   node scripts/build.mjs --verify  fail if lib/hue.js is out of date

import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"

const BUILD_DIR = "build"
const TARGET = "lib/hue.js"

const IMPORT = /^import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"\.\/([\w-]+)\.js";?\n/gm
const DECLARATION = /^(?:export\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm

function readModules() {
  const modules = new Map()
  for (const file of readdirSync(BUILD_DIR).filter((name) => name.endsWith(".js")).sort()) {
    const name = basename(file, ".js")
    const source = readFileSync(join(BUILD_DIR, file), "utf8")
    const imports = [...source.matchAll(IMPORT)]
    for (const [statement, names] of imports) {
      if (/\bas\b/.test(names)) {
        throw new Error(`${name}.ts: renamed imports cannot be bundled: ${statement.trim()}`)
      }
    }
    modules.set(name, { name, source, dependencies: imports.map((match) => match[2]) })
  }
  return modules
}

function dependencyOrder(modules) {
  const ordered = []
  const state = new Map()
  const visit = (name, path) => {
    if (state.get(name) === "done") {
      return
    }
    if (state.get(name) === "visiting") {
      throw new Error(`import cycle: ${[...path, name].join(" -> ")}`)
    }
    const module = modules.get(name)
    if (!module) {
      throw new Error(`${path.at(-1)}.ts imports ./${name}.ts, which does not exist`)
    }
    state.set(name, "visiting")
    for (const dependency of module.dependencies) {
      visit(dependency, [...path, name])
    }
    state.set(name, "done")
    ordered.push(module)
  }
  for (const name of modules.keys()) {
    visit(name, [])
  }
  return ordered
}

function toLibraryCode(module) {
  const code = module.source
    .replace(IMPORT, "")
    .replace(/^export\s+(?:const|let|var)\s+/gm, "var ")
    .replace(/^(?:const|let)\s+/gm, "var ")
    .replace(/^export\s+function\s+/gm, "function ")
    .replace(/^export\s*\{\s*\};?\n/gm, "")
    .trim()
  const leftover = code.match(/^(?:export|import)\b.*$/m)
  if (leftover) {
    throw new Error(`${module.name}.ts: cannot bundle: ${leftover[0]}`)
  }
  return code
}

function bundle() {
  const declaredIn = new Map()
  const parts = []
  for (const module of dependencyOrder(readModules())) {
    for (const [, name] of module.source.matchAll(DECLARATION)) {
      if (declaredIn.has(name)) {
        throw new Error(`"${name}" is declared in both ${declaredIn.get(name)}.ts and ${module.name}.ts`)
      }
      declaredIn.set(name, module.name)
    }
    parts.push(`// ---- src/${module.name}.ts ----\n\n${toLibraryCode(module)}\n`)
  }
  const header = [
    ".pragma library",
    "",
    "// Generated from src/*.ts by `npm run build`. Edit the sources, not this file.",
    "",
    "",
  ].join("\n")
  return header + parts.join("\n")
}

function readOrEmpty(path) {
  try {
    return readFileSync(path, "utf8")
  } catch {
    return ""
  }
}

const output = bundle()

if (process.argv.includes("--verify")) {
  if (readOrEmpty(TARGET) !== output) {
    console.error(`${TARGET} is out of date. Run \`npm run build\`.`)
    process.exit(1)
  }
  console.log(`${TARGET} is up to date.`)
} else {
  writeFileSync(TARGET, output)
  console.log(`Wrote ${TARGET}.`)
}
