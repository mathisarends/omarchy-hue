# Hue for Omarchy

Philips Hue in the [Omarchy](https://omarchy.org) bar. One bulb icon, one
keyboard-first panel: switch rooms and zones, set brightness, pick scenes and
run your own favorites without touching the mouse.

It is a native omarchy-shell plugin (QML) and talks to the bridge through
[huego](https://github.com/mathisarends/huego), a small Hue CLI. Changes made
anywhere else, like the Hue app, a switch or a sensor, show up live.

- **Bar icon**: click to open the panel, scroll for brightness, right click to switch on or off, middle click for all off
- **Panel**: every room and zone with on/off and a summary; open one for its brightness and scenes
- **Favorites**: your own one-key shortcuts from a plain text file
- **Keyboard**: everything has a key, and every key can be changed
- **Global shortcuts**: control the lights from Hyprland without opening the panel
- Follows your Omarchy theme, works with multiple monitors, English and German

## Install

### One command

```sh
curl -fsSL https://raw.githubusercontent.com/mathisarends/omarchy-hue/main/install.sh | bash
```

This installs **[huego v0.2.0](https://github.com/mathisarends/huego/releases/tag/v0.2.0)**
to `~/.local/bin` (checksum-verified) and adds the widget with
`omarchy plugin add`.

### Step by step

1. Install huego, pinned to [v0.2.0](https://github.com/mathisarends/huego/releases/tag/v0.2.0).
   Use either the release binary:

   ```sh
   curl -fsSL -o /tmp/huego.tar.gz \
     https://github.com/mathisarends/huego/releases/download/v0.2.0/huego_linux_amd64.tar.gz
   tar -xzf /tmp/huego.tar.gz -C /tmp huego
   install -m 0755 /tmp/huego ~/.local/bin/huego
   ```

   (On ARM, use `huego_linux_arm64.tar.gz`.) Or build it with Go:

   ```sh
   go install github.com/mathisarends/huego@v0.2.0
   ```

2. Pair it with your bridge. Press the link button on the bridge, then run:

   ```sh
   huego setup
   ```

3. Add the widget:

   ```sh
   omarchy plugin add https://github.com/mathisarends/omarchy-hue
   ```

If huego is missing or the bridge isn't paired yet, the panel tells you and
offers an **Install huego** or **Pair bridge** button.

## Keys

Open the panel by clicking the bulb, or with a global shortcut (see below).

| Key | Action |
| --- | --- |
| `j` `k` / arrows | move up and down |
| `h` `l` / arrows | brightness on a slider, otherwise move sideways |
| `g` `G` / Home End | first / last |
| Enter / Space | switch on or off, activate a scene or favorite |
| `o` `s` | show a room's brightness and scenes |
| `1` … `9` | run favorite 1 to 9 |
| `a` / `A` | all lights off / on |
| `r` | refresh |
| `e` | edit favorites |
| `q` / Esc | close |
| Tab | move to the next panel |

### Changing keys

Add a `keys` object to the widget's settings. You only need to list the actions
you want to change; the others keep their default. Each value is a list of
keys separated by spaces.

```jsonc
// ~/.config/omarchy/shell.json, in bar.layout
{
  "id": "mathisarends.hue",
  "keys": {
    "allOff": "x ctrl+a",
    "refresh": "F5",
    "favorites": "1 2 3 4"
  }
}
```

| Action | Default |
| --- | --- |
| `down` | `j Down` |
| `up` | `k Up` |
| `left` | `h Left` |
| `right` | `l Right` |
| `first` | `g Home` |
| `last` | `G End` |
| `activate` | `Return Enter Space` |
| `expand` | `o s` |
| `close` | `q` |
| `allOff` | `a` |
| `allOn` | `A` |
| `refresh` | `r` |
| `editFavorites` | `e` |
| `favorites` | `1 2 3 4 5 6 7 8 9` (one key per favorite, in order) |

Key names:
- Any single character.
- `Return`, `Enter`, `Space`, `Backspace`, `Delete`, `Insert`, `Home`, `End`, `PageUp`, `PageDown`, the arrows `Up` `Down` `Left` `Right`, and `F1` to `F12`.
- Modifiers: `ctrl+`, `alt+`, `super+` and `shift+`.

Uppercase letters mean Shift, so `A` is the same as `shift+a`. Set an action to
`""` to turn it off. Escape and Tab always keep their meaning.

The hint line at the bottom of the panel always shows your current keys. Hide
it with `"showHints": false`.

## Global shortcuts

The widget answers IPC as `mathisarends.hue`, so Hyprland can control it
directly. Add binds to `~/.config/hypr/bindings.lua`:

```lua
o.bind("SUPER + ALT + H", "Hue panel", "omarchy-shell mathisarends.hue toggle")
o.bind("SUPER + ALT + O", "Lights off", "omarchy-shell mathisarends.hue allOff")
o.bind("SUPER + ALT + L", "Toggle lights", "omarchy-shell mathisarends.hue toggleTarget")
o.bind("SUPER + ALT + UP", "Brighter", "omarchy-shell mathisarends.hue brighten 10")
o.bind("SUPER + ALT + DOWN", "Dimmer", "omarchy-shell mathisarends.hue dim 10")
o.bind("SUPER + ALT + M", "Movie lights", "omarchy-shell mathisarends.hue favorite Movie")
```

| Method | What it does |
| --- | --- |
| `toggle`, `open`, `close` | the panel (`show` and `hide` work too) |
| `allOff`, `allOn` | every light |
| `toggleTarget` | switch the bar icon's target on or off |
| `brighten <n>`, `dim <n>` | change the target's brightness by n % (default: `step`) |
| `scene <name>` | activate a scene, by name or as `Room/Scene` |
| `favorite <label>` | run a favorite by its label |
| `refresh` | read everything from the bridge again |
| `state` | the target's state as JSON, for scripts |

Use the plain command form shown above. The `{ ipc = "…" }` shorthand splits at
the first dot, which doesn't fit this plugin's id.

## Favorites

Favorites live in `~/.config/omarchy/hue/favorites.conf`. Press `e` in the
panel to open the file; it is created with examples the first time. Saving the
file updates the panel immediately.

```ini
# Label = huego arguments; separate several commands with ;
Good night = home off -t 10
Movie      = scene activate "Living room/Dimmed" -t 2
Focus      = room on Office -b 100 ; room temperature Office 5000
Warm desk  = light color "Desk Lamp" warm_white -b 60
```

Anything huego can do works here, see `huego --help`. The first nine favorites
get the keys `1` to `9`.

## Settings

Set these on the widget's entry in `~/.config/omarchy/shell.json`, or in the
bar's widget settings.

| Setting | Default | |
| --- | --- | --- |
| `target` | `home` | what the bar icon controls: `home`, `room:<name>` or `zone:<name>` |
| `step` | `5` | brightness step for scroll, arrow keys and IPC (1 to 25) |
| `transition` | `0` | fade time in seconds; 0 uses the bridge default |
| `showPercent` | `false` | show the brightness next to the icon |
| `showZones` | `true` | list zones below the rooms |
| `showHints` | `true` | show the key hint line |
| `favoritesFile` | `""` | another favorites file |
| `huego` | `huego` | name or path of the huego binary |
| `keys` | `{}` | key overrides, see [Changing keys](#changing-keys) |

```jsonc
{
  "id": "mathisarends.hue",
  "target": "room:Office",
  "step": 10,
  "showPercent": true
}
```

## How it works

omarchy-shell plugins are QML, so that is what the panel is made of. The
logic is written in TypeScript (`src/`) and bundled into one QML JavaScript
library, `lib/hue.js`.

All Hue traffic goes through huego. The widget:
- runs short commands like `huego room list --json`;
- keeps one `huego events --json` stream open for live updates;
- reads huego's exit codes to tell "not installed", "not paired" and "unreachable" apart.

With several monitors, one instance talks to the bridge and shares its
state with the others.

```
Panel.qml           settings, bar icon, panel
ui/HueBridge.qml    runs huego, holds the bridge state
ui/PanelContent.qml the panel and its keys
ui/*.qml            one file per part of the panel
src/*.ts            parsing, commands, keymap, cursor; tested with node --test
i18n/*.json         translations
```

## Development

You need Node 24.

```sh
npm install
npm run build   # src/*.ts  ->  lib/hue.js
npm run check   # types, lint, tests, and that lib/hue.js is up to date
```

Edit `src/`, never `lib/hue.js` directly. `lib/hue.js` is committed because
`omarchy plugin add` installs straight from git. The lint enforces braces on
every block, in TypeScript and in QML.

To try local changes, add the repo folder as a plugin:

```sh
omarchy plugin add ~/code/omarchy-hue
```

## License

[MIT](LICENSE)
