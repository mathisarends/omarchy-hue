// The favorites file: one "Label = huego arguments" per line, # for comments.

import { cleanName } from "./input.ts"

export const MAX_FAVORITES = 48
export const MAX_COMMANDS = 8

// huego commands a favorite may run. setup, events and completion are
// interactive or long-running and make no sense behind a button.
export const FAVORITE_COMMANDS = ["light", "room", "zone", "home", "scene", "smart-scene", "automation", "sensor", "api"]

export interface Favorite {
  label: string
  /** One argv per command, run in order, without the leading "huego". */
  commands: string[][]
  line: number
}

/**
 * Splits one line into argv the way a shell would for plain words and
 * quotes, without expansion of any kind. A bare ";" starts the next command.
 * Returns null when a quote is left open.
 */
export function tokenize(line: string): string[][] | null {
  const commands: string[][] = []
  let words: string[] = []
  let word = ""
  let inWord = false
  let quote = ""

  const endWord = (): void => {
    if (inWord) {
      words.push(word)
    }
    word = ""
    inWord = false
  }

  const endCommand = (): void => {
    endWord()
    if (words.length > 0) {
      commands.push(words)
    }
    words = []
  }

  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    const next = line[i + 1]
    if (quote) {
      if (c === quote) {
        quote = ""
      } else if (quote === '"' && c === "\\" && (next === '"' || next === "\\")) {
        word += next
        i++
      } else {
        word += c
      }
    } else if (c === '"' || c === "'") {
      quote = c
      inWord = true
    } else if (c === "\\" && next !== undefined) {
      word += next
      inWord = true
      i++
    } else if (c === ";") {
      endCommand()
    } else if (c === " " || c === "\t") {
      endWord()
    } else {
      word += c
      inWord = true
    }
  }

  if (quote) {
    return null
  }
  endCommand()
  return commands
}

function withoutHuego(command: string[]): string[] {
  return command[0] === "huego" ? command.slice(1) : command
}

/** Lines that do not parse, or run anything but FAVORITE_COMMANDS, are skipped. */
export function parseFavorites(text: string): Favorite[] {
  const favorites: Favorite[] = []
  const lines = text.split("\n")
  for (let i = 0; i < lines.length && favorites.length < MAX_FAVORITES; i++) {
    const line = lines[i].trim()
    const eq = line.indexOf("=")
    if (line.startsWith("#") || eq <= 0) {
      continue
    }
    const label = cleanName(line.slice(0, eq))
    const commands = tokenize(line.slice(eq + 1))?.map(withoutHuego) ?? []
    const allowed = commands.every((command) => FAVORITE_COMMANDS.includes(command[0]))
    if (label && allowed && commands.length > 0 && commands.length <= MAX_COMMANDS) {
      favorites.push({ label, commands, line: i + 1 })
    }
  }
  return favorites
}

export function findFavorite(favorites: Favorite[], label: string): Favorite | null {
  const key = label.trim().toLowerCase()
  return favorites.find((favorite) => favorite.label.toLowerCase() === key) ?? null
}

/** huego argv for one command of a favorite. */
export function favoriteArgs(command: string[]): string[] {
  return command.includes("--json") ? command.slice() : [...command, "--json"]
}

export const FAVORITES_TEMPLATE = [
  "# Hue favorites for the Omarchy bar. Saving this file updates the panel.",
  "#",
  "# One favorite per line:   Label = huego arguments",
  "# Run several commands in a row by separating them with ;",
  "# Anything huego can do works, see `huego --help`. Some ideas:",
  "#",
  "# Good night  = home off -t 10",
  "# Movie       = scene activate \"Living room/Dimmed\" -t 2",
  "# Focus       = room on Office -b 100 ; room temperature Office 5000",
  "# Warm desk   = light color \"Desk Lamp\" warm_white -b 60",
  "",
  "All on      = home on -b 80 -t 1",
  "Good night  = home off -t 10",
  "",
].join("\n")
