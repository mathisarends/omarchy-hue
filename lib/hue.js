.pragma library

// Generated from src/*.ts by `npm run build`. Edit the sources, not this file.

// ---- src/input.ts ----

// Cleaning untrusted input. Room, scene and favorite names come from the
// bridge and from the user's file; ids end up in huego's argv.
var MAX_NAME = 64;
// Newlines, tabs and the other C0 control characters, plus DEL.
// eslint-disable-next-line no-control-regex -- matching them is the point
var CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** One line of plain text, at most MAX_NAME characters. */
function cleanName(value) {
    const text = String(value !== null && value !== void 0 ? value : "").replace(CONTROL_CHARS, " ").trim();
    return text.length > MAX_NAME ? text.slice(0, MAX_NAME - 1) + "…" : text;
}
/** A bridge id, or "" when it holds anything but letters, digits, ".", "_" and "-". */
function cleanId(value) {
    const id = String(value !== null && value !== void 0 ? value : "");
    return /^[A-Za-z0-9._-]{1,64}$/.test(id) ? id : "";
}
function parseJson(text) {
    try {
        return JSON.parse(text);
    }
    catch (_a) {
        return undefined;
    }
}
function clampPercent(value) {
    const n = Math.round(value);
    if (!isFinite(n)) {
        return 0;
    }
    return Math.max(0, Math.min(100, n));
}

// ---- src/commands.ts ----

// Building huego command lines and queueing them.
// Runs huego through sh so a missing binary exits 127 instead of failing to
// spawn, which Process reports without an exit code. Arguments travel as
// positional parameters and are never parsed by the shell.
//
// A bare name is also looked up in ~/.local/bin (where install.sh puts it) and
// the Go bin directory, because the shell may start with a shorter PATH than
// your terminal.
var LAUNCH = [
    'case "$0" in */*) ;; *)',
    '  command -v "$0" >/dev/null 2>&1 ||',
    '  for dir in "$HOME/.local/bin" "${GOBIN:-${GOPATH:-$HOME/go}/bin}"; do',
    '    if [ -x "$dir/$0" ]; then exec "$dir/$0" "$@"; fi',
    '  done ;;',
    'esac',
    'command -v "$0" >/dev/null 2>&1 || exit 127',
    'exec "$0" "$@"',
].join("\n");
/** Pause after a command that changes a group. The bridge takes about one per second. */
var GROUP_GAP_MS = 350;
var COMMAND_GAP_MS = 80;
function parseTarget(value) {
    const match = /^(room|zone)\s*:\s*(.+)$/i.exec(String(value !== null && value !== void 0 ? value : "").trim());
    if (!match) {
        return { kind: "home", name: "" };
    }
    return { kind: match[1].toLowerCase(), name: cleanName(match[2]) };
}
/** Finds a room or zone by id or by name, ignoring case. */
function findGroup(groups, name) {
    var _a;
    const key = name.trim().toLowerCase();
    if (!key) {
        return null;
    }
    return (_a = groups.find((group) => group.id === key || group.name.toLowerCase() === key)) !== null && _a !== void 0 ? _a : null;
}
/** `huego <kind> <verb> [id] [extra...] --json`; the home takes no id. */
function controlArgs(kind, id, verb, extra = []) {
    const target = kind === "home" ? [] : [id];
    return [kind, verb, ...target, ...extra, "--json"];
}
function fadeArgs(seconds) {
    return seconds > 0 ? ["-t", String(Math.round(seconds * 10) / 10)] : [];
}
/** Takes a scene id or a qualified name such as "Living room/Relax". */
function sceneArgs(scene, fadeSeconds) {
    return ["scene", "activate", scene, ...fadeArgs(fadeSeconds), "--json"];
}
/** Adds a command; a waiting command with the same key is replaced in place. */
function enqueue(queue, command) {
    const index = command.key ? queue.findIndex((queued) => queued.key === command.key) : -1;
    if (index < 0) {
        return [...queue, command];
    }
    const next = queue.slice();
    next[index] = command;
    return next;
}

// ---- src/huego.ts ----

// Reading what huego prints: `--json` output, the event stream, errors on
// stderr and exit codes.
var MAX_GROUPS = 64;
var MAX_SCENES = 512;
/** One key per group, shared by optimistic state and the keyboard cursor. */
function groupKey(kind, id) {
    return kind === "home" ? "home" : `${kind}:${id}`;
}
function emptyGroup() {
    return { id: "", name: "", on: false, brightness: -1, lightsOn: 0, lightsTotal: 0 };
}
function parseGroup(raw) {
    if (!isRecord(raw)) {
        return null;
    }
    const lights = Array.isArray(raw.lights) ? raw.lights : [];
    return {
        id: cleanId(raw.id),
        name: cleanName(raw.name),
        on: raw.on === true,
        brightness: typeof raw.brightness === "number" ? clampPercent(raw.brightness) : -1,
        lightsOn: lights.filter((light) => isRecord(light) && light.on === true).length,
        lightsTotal: lights.length,
    };
}
function byName(a, b) {
    return a.name.localeCompare(b.name);
}
/** `huego room list --json` and `huego zone list --json`, sorted by name. */
function parseGroups(text) {
    const list = parseJson(text);
    if (!Array.isArray(list)) {
        return [];
    }
    return list
        .map(parseGroup)
        .filter((group) => group !== null && group.id !== "" && group.name !== "")
        .slice(0, MAX_GROUPS)
        .sort(byName);
}
/** `huego home get --json`. */
function parseHome(text) {
    var _a;
    return (_a = parseGroup(parseJson(text))) !== null && _a !== void 0 ? _a : emptyGroup();
}
function parseScene(raw) {
    if (!isRecord(raw)) {
        return null;
    }
    const id = cleanId(raw.id);
    const name = cleanName(raw.name);
    if (!id || !name) {
        return null;
    }
    const active = typeof raw.status === "string" && raw.status !== "" && raw.status !== "inactive";
    return { id, name, group: cleanName(raw.group), active };
}
/** `huego scene list --json`, sorted by name. */
function parseScenes(text) {
    const list = parseJson(text);
    if (!Array.isArray(list)) {
        return [];
    }
    return list
        .map(parseScene)
        .filter((scene) => scene !== null)
        .slice(0, MAX_SCENES)
        .sort(byName);
}
function scenesFor(scenes, groupName) {
    const key = groupName.toLowerCase();
    return scenes.filter((scene) => scene.group.toLowerCase() === key);
}
/**
 * What a line from `huego events --json` means for the panel: "scenes" when
 * scenes, rooms or zones changed, "state" for any other event, "" for noise.
 */
function eventKind(line) {
    const event = parseJson(line);
    if (!isRecord(event)) {
        return "";
    }
    return event.type === "scene" || event.type === "room" || event.type === "zone" ? "scenes" : "state";
}
// huego's exit codes, see its README. 127 comes from the launcher when the
// binary is missing.
var EXIT_STATUS = {
    0: "ok",
    4: "notConfigured",
    5: "unreachable",
    127: "missing",
};
function statusForExit(code) {
    var _a;
    return (_a = EXIT_STATUS[code]) !== null && _a !== void 0 ? _a : "error";
}
/** huego prints errors as a JSON line on stderr; anything else falls back to the last line. */
function parseError(stderr) {
    const lines = stderr.split("\n").map((line) => line.trim()).filter((line) => line !== "");
    for (const line of lines.slice().reverse()) {
        const value = parseJson(line);
        if (isRecord(value) && typeof value.error === "string") {
            return { code: cleanName(value.code), message: cleanName(value.error) };
        }
    }
    return { code: "", message: cleanName(lines[lines.length - 1]) };
}

// ---- src/cursor.ts ----

// The panel's cursor, shared by keyboard and mouse. Each place it can stop
// has an id:
//
//   status:<i>               a setup button while huego is not connected
//   target                   the brightness slider of the bar target
//   fav:<i> / favedit        a favorite, or "add favorites" when there are none
//   group:<kind>:<id>        a room or zone row
//   slider:<kind>:<id>       the brightness slider of an open row
//   scene:<kind>:<id>:<i>    a scene of an open row
//
// Group ids never contain ":" (see cleanId), so splitting is safe.
/** Every stop, top to bottom. */
function cursorStops(layout) {
    if (!layout.connected) {
        return Array.from({ length: layout.statusActions }, (_, i) => `status:${i}`);
    }
    const stops = ["target"];
    if (layout.favorites > 0) {
        for (let i = 0; i < layout.favorites; i++) {
            stops.push(`fav:${i}`);
        }
    }
    else {
        stops.push("favedit");
    }
    const sections = [["room", layout.rooms], ["zone", layout.zones]];
    for (const [kind, groups] of sections) {
        for (const group of groups) {
            const key = groupKey(kind, group.id);
            stops.push(`group:${key}`);
            if (key === layout.expandedKey) {
                stops.push(`slider:${key}`);
                scenesFor(layout.scenes, group.name).forEach((_, i) => stops.push(`scene:${key}:${i}`));
            }
        }
    }
    return stops;
}
function parseStop(stop) {
    const parts = stop.split(":");
    const type = parts[0];
    switch (type) {
        case "group":
        case "slider":
            return { type, kind: parts[1], id: parts[2], index: -1 };
        case "scene":
            return { type, kind: parts[1], id: parts[2], index: Number(parts[3]) };
        case "fav":
        case "status":
            return { type, kind: "", id: "", index: Number(parts[1]) };
        case "target":
        case "favedit":
            return { type, kind: "", id: "", index: -1 };
        default:
            return { type: "", kind: "", id: "", index: -1 };
    }
}
/** Keeps the cursor where it was; falls back to the row it belonged to, then to the top. */
function clampStop(stops, current) {
    var _a;
    if (stops.includes(current)) {
        return current;
    }
    const stop = parseStop(current);
    const row = stop.kind ? `group:${stop.kind}:${stop.id}` : "";
    if (row && stops.includes(row)) {
        return row;
    }
    return (_a = stops[0]) !== null && _a !== void 0 ? _a : "";
}
/** j/k: one stop down or up, stopping at the ends. */
function stepStop(stops, current, delta) {
    var _a;
    const index = stops.indexOf(current);
    if (index < 0) {
        return (_a = stops[0]) !== null && _a !== void 0 ? _a : "";
    }
    return stops[Math.max(0, Math.min(stops.length - 1, index + delta))];
}
/** h/l along a row of buttons (scenes, favorites, setup); stays put at the ends. */
function sideStop(stops, current, delta) {
    const split = current.lastIndexOf(":");
    const index = Number(current.slice(split + 1));
    if (split < 0 || !isFinite(index)) {
        return current;
    }
    const next = current.slice(0, split + 1) + String(index + delta);
    return stops.includes(next) ? next : current;
}
/** Stops where h/l change brightness instead of moving. */
function adjustsBrightness(stop) {
    return stop.type === "target" || stop.type === "group" || stop.type === "slider";
}

// ---- src/favorites.ts ----

// The favorites file: one "Label = huego arguments" per line, # for comments.
var MAX_FAVORITES = 48;
var MAX_COMMANDS = 8;
// huego commands a favorite may run. setup, events and completion are
// interactive or long-running and make no sense behind a button.
var FAVORITE_COMMANDS = ["light", "room", "zone", "home", "scene", "smart-scene", "automation", "sensor", "api"];
/**
 * Splits one line into argv the way a shell would for plain words and
 * quotes, without expansion of any kind. A bare ";" starts the next command.
 * Returns null when a quote is left open.
 */
function tokenize(line) {
    const commands = [];
    let words = [];
    let word = "";
    let inWord = false;
    let quote = "";
    const endWord = () => {
        if (inWord) {
            words.push(word);
        }
        word = "";
        inWord = false;
    };
    const endCommand = () => {
        endWord();
        if (words.length > 0) {
            commands.push(words);
        }
        words = [];
    };
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        const next = line[i + 1];
        if (quote) {
            if (c === quote) {
                quote = "";
            }
            else if (quote === '"' && c === "\\" && (next === '"' || next === "\\")) {
                word += next;
                i++;
            }
            else {
                word += c;
            }
        }
        else if (c === '"' || c === "'") {
            quote = c;
            inWord = true;
        }
        else if (c === "\\" && next !== undefined) {
            word += next;
            inWord = true;
            i++;
        }
        else if (c === ";") {
            endCommand();
        }
        else if (c === " " || c === "\t") {
            endWord();
        }
        else {
            word += c;
            inWord = true;
        }
    }
    if (quote) {
        return null;
    }
    endCommand();
    return commands;
}
function withoutHuego(command) {
    return command[0] === "huego" ? command.slice(1) : command;
}
/** Lines that do not parse, or run anything but FAVORITE_COMMANDS, are skipped. */
function parseFavorites(text) {
    var _a, _b;
    const favorites = [];
    const lines = text.split("\n");
    for (let i = 0; i < lines.length && favorites.length < MAX_FAVORITES; i++) {
        const line = lines[i].trim();
        const eq = line.indexOf("=");
        if (line.startsWith("#") || eq <= 0) {
            continue;
        }
        const label = cleanName(line.slice(0, eq));
        const commands = (_b = (_a = tokenize(line.slice(eq + 1))) === null || _a === void 0 ? void 0 : _a.map(withoutHuego)) !== null && _b !== void 0 ? _b : [];
        const allowed = commands.every((command) => FAVORITE_COMMANDS.includes(command[0]));
        if (label && allowed && commands.length > 0 && commands.length <= MAX_COMMANDS) {
            favorites.push({ label, commands, line: i + 1 });
        }
    }
    return favorites;
}
function findFavorite(favorites, label) {
    var _a;
    const key = label.trim().toLowerCase();
    return (_a = favorites.find((favorite) => favorite.label.toLowerCase() === key)) !== null && _a !== void 0 ? _a : null;
}
/** huego argv for one command of a favorite. */
function favoriteArgs(command) {
    return command.includes("--json") ? command.slice() : [...command, "--json"];
}
var FAVORITES_TEMPLATE = [
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
].join("\n");

// ---- src/glyphs.ts ----

// Material Design icons from the Nerd Font, spelled as code points so no
// editor or patch tool can strip them.
var Glyph = {
    bulb: String.fromCodePoint(0xF0335),
    bulbOff: String.fromCodePoint(0xF0336),
    palette: String.fromCodePoint(0xF03D8),
    pencil: String.fromCodePoint(0xF03EB),
    alert: String.fromCodePoint(0xF05D6),
    chevronDown: String.fromCodePoint(0xF0140),
    chevronRight: String.fromCodePoint(0xF0142),
};

// ---- src/keymap.ts ----

// Panel shortcuts. Every action can be rebound in the widget's settings:
//
//   "keys": { "down": "j Down", "allOff": "a ctrl+o", "favorites": "1 2 3" }
//
// A binding is a list of keys separated by spaces. A key is a single
// character ("j", "A", "?") or a named key ("Down", "Space", "F5"), with
// optional "ctrl+", "alt+", "super+" or "shift+" in front. Characters match
// what they type, so "A" already means Shift+a.
//
// Escape and Tab are not rebindable: every Omarchy panel closes on Escape and
// moves to the next panel on Tab.
var DEFAULT_KEYS = {
    down: "j Down",
    up: "k Up",
    left: "h Left",
    right: "l Right",
    first: "g Home",
    last: "G End",
    activate: "Return Enter Space",
    expand: "o s",
    close: "q",
    allOff: "a",
    allOn: "A",
    refresh: "r",
    editFavorites: "e",
    favorites: "1 2 3 4 5 6 7 8 9",
};
var MAX_KEYS_PER_BINDING = 12;
// Qt key codes (Qt::Key) for the keys that have names.
var NAMED_KEYS = {
    Backspace: 0x01000003,
    Return: 0x01000004,
    Enter: 0x01000005,
    Insert: 0x01000006,
    Delete: 0x01000007,
    Home: 0x01000010,
    End: 0x01000011,
    Left: 0x01000012,
    Up: 0x01000013,
    Right: 0x01000014,
    Down: 0x01000015,
    PageUp: 0x01000016,
    PageDown: 0x01000017,
    Space: 0x20,
    F1: 0x01000030,
    F2: 0x01000031,
    F3: 0x01000032,
    F4: 0x01000033,
    F5: 0x01000034,
    F6: 0x01000035,
    F7: 0x01000036,
    F8: 0x01000037,
    F9: 0x01000038,
    F10: 0x01000039,
    F11: 0x0100003a,
    F12: 0x0100003b,
};
var ALIASES = {
    del: "Delete",
    pgup: "PageUp",
    pgdown: "PageDown",
};
// Qt modifier bits (Qt::KeyboardModifier), in the order they are written.
var MODIFIERS = [
    ["ctrl", 0x04000000],
    ["alt", 0x08000000],
    ["super", 0x10000000],
    ["shift", 0x02000000],
];
var MODIFIER_ALIASES = { control: "ctrl", meta: "super", win: "super", cmd: "super" };
var NAME_BY_LOWERCASE = new Map(Object.keys(NAMED_KEYS).map((name) => [name.toLowerCase(), name]));
var NAME_BY_CODE = new Map(Object.entries(NAMED_KEYS).map(([name, code]) => [code, name]));
function hasKey(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}
function namedKey(word) {
    var _a, _b;
    const lower = word.toLowerCase();
    return (_b = (_a = ALIASES[lower]) !== null && _a !== void 0 ? _a : NAME_BY_LOWERCASE.get(lower)) !== null && _b !== void 0 ? _b : "";
}
function withModifiers(modifiers, key) {
    const prefix = MODIFIERS.filter(([name]) => modifiers.has(name)).map(([name]) => `${name}+`);
    return prefix.join("") + key;
}
/** "ctrl+shift+Down" -> ["ctrl", "shift"] and "Down"; the key itself may be "+". */
function splitKey(spec) {
    const split = spec.length > 1 ? spec.lastIndexOf("+", spec.length - 2) : -1;
    return {
        modifiers: split < 0 ? [] : spec.slice(0, split).split("+"),
        key: spec.slice(split + 1),
    };
}
/** Canonical form of one key from a binding, or "" when it is not a key. */
function normalizeKey(spec) {
    const { modifiers: parts, key } = splitKey(spec);
    const modifiers = new Set(parts.map((part) => {
        var _a;
        const lower = part.toLowerCase();
        return (_a = MODIFIER_ALIASES[lower]) !== null && _a !== void 0 ? _a : lower;
    }));
    if (key === "" || [...modifiers].some((name) => !MODIFIERS.some(([known]) => known === name))) {
        return "";
    }
    if (key.length > 1) {
        const name = namedKey(key);
        return name === "" ? "" : withModifiers(modifiers, name);
    }
    // Shift on a character is part of the character: "shift+a" is "A".
    const character = modifiers.delete("shift") ? key.toUpperCase() : key;
    return withModifiers(modifiers, character);
}
function isPrintable(text) {
    return text.length === 1 && text > " " && text !== "\u007f";
}
/** The canonical key of a key press, in the same form normalizeKey() gives. */
function keyOfEvent(code, text, modifiers) {
    const held = new Set(MODIFIERS.filter(([, bit]) => (modifiers & bit) !== 0).map(([name]) => name));
    const named = NAME_BY_CODE.get(code);
    if (named !== undefined) {
        return withModifiers(held, named);
    }
    // Ctrl+letter types a control character, so fall back to the key code,
    // which Qt gives as the uppercase letter.
    let character = text;
    if (!isPrintable(character)) {
        if (code <= 0x20 || code >= 0x7f) {
            return "";
        }
        const fromCode = String.fromCharCode(code);
        character = held.has("shift") ? fromCode.toUpperCase() : fromCode.toLowerCase();
    }
    held.delete("shift");
    return withModifiers(held, character);
}
/** The keys of one binding, in canonical form and without repeats. */
function parseBinding(value) {
    if (typeof value !== "string") {
        return [];
    }
    const keys = value.split(/\s+/).map(normalizeKey).filter((key) => key !== "");
    return [...new Set(keys)].slice(0, MAX_KEYS_PER_BINDING);
}
/** Builds the keymap from the "keys" setting; actions left out keep their defaults. */
function parseKeymap(setting) {
    var _a;
    var _b;
    const custom = setting !== null && typeof setting === "object" ? setting : {};
    const keysOf = (binding) => parseBinding(hasKey(custom, binding) ? custom[binding] : DEFAULT_KEYS[binding]);
    const keymap = { actions: {}, favorites: {} };
    for (const binding of Object.keys(DEFAULT_KEYS)) {
        if (binding === "favorites") {
            continue;
        }
        for (const key of keysOf(binding)) {
            // When two actions claim a key, the first one keeps it.
            (_a = (_b = keymap.actions)[key]) !== null && _a !== void 0 ? _a : (_b[key] = binding);
        }
    }
    keysOf("favorites").forEach((key, index) => {
        // An action wins over a favorite slot on the same key.
        if (!hasKey(keymap.actions, key)) {
            keymap.favorites[key] = index;
        }
    });
    return keymap;
}
function lookupKey(keymap, key) {
    if (hasKey(keymap.actions, key)) {
        return { type: "action", action: keymap.actions[key] };
    }
    if (hasKey(keymap.favorites, key)) {
        return { type: "favorite", index: keymap.favorites[key] };
    }
    return { type: "none" };
}
// How keys read in the panel. "Return" is the key everyone calls Enter.
var DISPLAY_NAMES = { Return: "Enter" };
/** The first key bound to an action, written for people: "Ctrl+o", "j", "". */
function keyLabel(keymap, action) {
    var _a, _b;
    const key = (_a = Object.keys(keymap.actions).find((candidate) => keymap.actions[candidate] === action)) !== null && _a !== void 0 ? _a : "";
    const { modifiers, key: name } = splitKey(key);
    const prefix = modifiers.map((modifier) => `${modifier[0].toUpperCase()}${modifier.slice(1)}+`);
    return prefix.join("") + ((_b = DISPLAY_NAMES[name]) !== null && _b !== void 0 ? _b : name);
}
var HINTS = [
    [["down", "up"], "hint.move"],
    [["left", "right"], "hint.brightness"],
    [["activate"], "hint.toggle"],
    [["expand"], "hint.scenes"],
    [["allOff"], "hint.allOff"],
];
/** The hint line at the bottom of the panel; actions without a key are left out. */
function keyHints(keymap) {
    return HINTS
        .map(([actions, label]) => ({
        keys: actions.map((action) => keyLabel(keymap, action)).filter((key) => key !== "").join("/"),
        label,
    }))
        .filter((hint) => hint.keys !== "");
}
/** The key that runs a favorite, written for people, or "". */
function favoriteKeyLabel(keymap, index) {
    var _a;
    const key = (_a = Object.keys(keymap.favorites).find((candidate) => keymap.favorites[candidate] === index)) !== null && _a !== void 0 ? _a : "";
    return key.length === 1 ? key : "";
}

// ---- src/overrides.ts ----

// Optimistic state. A change shows up in the panel the moment it is asked
// for and wins over what the bridge reports until the bridge has caught up.
var OVERRIDE_MS = 3500;
function liveState(group, override) {
    var _a, _b, _c, _d, _e;
    return {
        on: (_b = (_a = override === null || override === void 0 ? void 0 : override.on) !== null && _a !== void 0 ? _a : group === null || group === void 0 ? void 0 : group.on) !== null && _b !== void 0 ? _b : false,
        brightness: (_d = (_c = override === null || override === void 0 ? void 0 : override.brightness) !== null && _c !== void 0 ? _c : group === null || group === void 0 ? void 0 : group.brightness) !== null && _d !== void 0 ? _d : -1,
        scene: (_e = override === null || override === void 0 ? void 0 : override.scene) !== null && _e !== void 0 ? _e : "",
    };
}
function withOverride(overrides, keys, patch, now) {
    const next = Object.assign({}, overrides);
    for (const key of keys) {
        next[key] = Object.assign(Object.assign(Object.assign({}, next[key]), patch), { until: now + OVERRIDE_MS });
    }
    return next;
}
function pruneOverrides(overrides, now) {
    const next = {};
    for (const key of Object.keys(overrides)) {
        if (overrides[key].until > now) {
            next[key] = overrides[key];
        }
    }
    return next;
}
/** Brightness after a step of delta percent; "on at unknown brightness" counts as full. */
function nudgedBrightness(state, delta) {
    if (!state.on && delta < 0) {
        return null;
    }
    const base = !state.on ? 0 : state.brightness < 0 ? 100 : state.brightness;
    return Math.max(1, Math.min(100, base + delta));
}
