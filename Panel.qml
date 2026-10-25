import QtQuick
import Quickshell
import qs.Commons
import qs.Commons as Commons
import qs.Ui
import "lib/hue.js" as Hue
import "ui"

// Philips Hue in the Omarchy bar, powered by the huego CLI.
//
// This file wires the parts together: settings, the bar icon and the panel.
//   ui/HueBridge.qml     runs huego and holds what the bridge reported
//   ui/PanelContent.qml  draws the panel and handles its keys
//   src/*.ts             the logic behind both, bundled into lib/hue.js
Panel {
  id: root

  ipcTarget: "mathisarends.hue"
  // HueIpc registers the IPC target, and only on the leading instance.
  manageIpc: false

  // ---- Settings (manifest.json describes them) ----

  readonly property string huego: String(setting("huego", "huego") || "").trim() || "huego"
  readonly property var target: Hue.parseTarget(setting("target", "home"))
  readonly property int step: Util.clamp(Math.round(Number(setting("step", 5)) || 5), 1, 25)
  readonly property real fade: Math.max(0, Number(setting("transition", 0)) || 0)
  readonly property bool showPercent: setting("showPercent", false) === true
  readonly property bool showZones: setting("showZones", true) !== false
  readonly property bool showHints: setting("showHints", true) !== false
  readonly property var keymap: Hue.parseKeymap(setting("keys", null))
  readonly property string favoritesPath: expandHome(String(setting("favoritesFile", "") || "").trim())
    || configHome + "/omarchy/hue/favorites.conf"

  readonly property string homeDir: Quickshell.env("HOME") || ""
  readonly property string configHome: Quickshell.env("XDG_CONFIG_HOME") || homeDir + "/.config"

  function expandHome(path) {
    if (path === "~" || path.startsWith("~/")) {
      return homeDir + path.slice(1)
    }
    return path
  }

  // ---- Theme ----

  readonly property color fg: bar ? bar.foreground : Commons.Color.foreground
  readonly property color muted: Qt.darker(fg, 1.4)
  readonly property color urgent: bar ? bar.urgent : Commons.Color.urgent
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family

  // ---- Text ----

  Commons.Translations {
    id: strings
    directory: Qt.resolvedUrl("i18n")
  }

  function t(key) {
    return strings.t(key)
  }

  function tn(key, count) {
    return strings.tn(key, count)
  }

  function number(value) {
    return Commons.I18n.formatNumber(value)
  }

  // ---- Parts ----

  readonly property var bridge: hueBridge
  readonly property var favorites: favoritesFile
  readonly property var cursor: panelCursor

  Leadership {
    id: leadership
    widget: root
  }

  HueBridge {
    id: hueBridge
    huego: root.huego
    showZones: root.showZones
    fade: root.fade
    leader: leadership.leader
    fastRetry: root.opened
    genericError: root.t("error.generic")
    onSnapshotTaken: leadership.share(hueBridge.snapshot())
  }

  FavoritesFile {
    id: favoritesFile
    path: root.favoritesPath
    onEditorOpened: root.close()
  }

  PanelCursor {
    id: panelCursor
    stops: Hue.cursorStops({
      connected: hueBridge.connected,
      statusActions: root.setupActions.length,
      favorites: favoritesFile.entries.length,
      rooms: hueBridge.rooms,
      zones: root.showZones ? hueBridge.zones : [],
      scenes: hueBridge.scenes,
      expandedKey: root.expandedKey,
    })
  }

  HueIpc {
    widget: root
    enabled: leadership.leader
  }

  // ---- What the bar icon controls ----

  readonly property var targetGroup: target.kind === "home"
    ? hueBridge.home
    : Hue.findGroup(target.kind === "zone" ? hueBridge.zones : hueBridge.rooms, target.name)
  readonly property var targetState: hueBridge.live(target.kind, targetGroup)
  readonly property string targetLabel: target.kind === "home"
    ? t("target.home")
    : (targetGroup ? targetGroup.name : target.name)
  readonly property bool targetMissing: hueBridge.connected && target.kind !== "home" && !targetGroup

  function allOff() {
    hueBridge.setPower("home", hueBridge.home, false)
  }

  function allOn() {
    hueBridge.setPower("home", hueBridge.home, true)
  }

  function toggleTarget() {
    hueBridge.togglePower(target.kind, targetGroup)
  }

  function nudgeTarget(delta) {
    hueBridge.nudge(target.kind, targetGroup, delta)
  }

  function runFavorite(index) {
    hueBridge.runFavorite(favoritesFile.entries[index] || null)
  }

  function editFavorites() {
    favoritesFile.edit()
  }

  // ---- The open room or zone ----

  property string expandedKey: ""

  function toggleExpanded(key) {
    expandedKey = expandedKey === key ? "" : key
    if (expandedKey !== "") {
      // Scenes change rarely; look again whenever a row opens.
      hueBridge.scenesStale = true
    }
  }

  // ---- Setup: what to offer while huego is not connected ----

  readonly property var setupActions: ({
    missing: ["install", "retry"],
    notConfigured: ["pair", "retry"],
    unreachable: ["retry"],
    error: ["retry"],
  })[hueBridge.status] || []

  readonly property bool needsSetup: setupActions.length > 0
  readonly property string statusTitle: needsSetup ? t("status." + hueBridge.status + ".title") : ""
  readonly property string statusText: needsSetup ? t("status." + hueBridge.status + ".detail") : ""

  function runSetupAction(index) {
    switch (setupActions[index]) {
    case "install":
      presentInTerminal("bash " + Util.shellQuote(pluginFile("install.sh")) + " --huego-only")
      break
    case "pair":
      presentInTerminal(Util.shellQuote(huego) + " setup")
      break
    case "retry":
      hueBridge.retry()
      break
    }
  }

  function pluginFile(name) {
    return decodeURIComponent(String(Qt.resolvedUrl(name)).replace(/^file:\/\//, ""))
  }

  function presentInTerminal(command) {
    Quickshell.execDetached(["omarchy-launch-floating-terminal-with-presentation", command])
    root.close()
  }

  // ---- Tooltip ----

  readonly property string tooltip: {
    if (hueBridge.status === "loading") {
      return t("meta.loading")
    }
    if (!hueBridge.connected) {
      return statusTitle
    }
    if (targetMissing) {
      return t("target.notFound").arg(target.name)
    }
    if (!targetState.on) {
      return t("tooltip.off").arg(targetLabel)
    }
    if (targetState.brightness < 0) {
      return t("tooltip.on").arg(targetLabel)
    }
    return t("tooltip.brightness").arg(targetLabel).arg(number(targetState.brightness))
  }

  // ---- Shared with the instances on other monitors (see ui/Leadership.qml) ----

  function snapshot() {
    return hueBridge.snapshot()
  }

  function adoptSnapshot(snapshot) {
    hueBridge.adopt(snapshot)
  }

  function scheduleElection() {
    leadership.scheduleElection()
  }

  // ---- Bar icon ----

  property real wheelAccumulator: 0

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  BarIconButton {
    id: button

    anchors.fill: parent
    bar: root.bar
    text: hueBridge.connected && root.targetState.on ? Hue.Glyph.bulb : Hue.Glyph.bulbOff
    dimmed: !hueBridge.connected || root.targetMissing
    labelText: root.showPercent && hueBridge.connected && root.targetState.on && root.targetState.brightness >= 0
      ? root.number(root.targetState.brightness) + "%"
      : ""
    tooltipText: root.tooltip

    // Left opens the panel, right switches the target, middle turns all off.
    onPressed: function(mouseButton) {
      if (mouseButton === Qt.RightButton) {
        root.toggleTarget()
      } else if (mouseButton === Qt.MiddleButton) {
        root.allOff()
      } else {
        root.toggle()
      }
    }

    onWheelMoved: function(delta) {
      const wheel = Util.wheelSteps(root.wheelAccumulator, delta)
      root.wheelAccumulator = wheel.remainder
      if (wheel.steps !== 0) {
        root.nudgeTarget(wheel.steps * root.step)
      }
    }
  }

  // ---- Panel ----

  function reveal(item) {
    if (panel.loadedContent) {
      panel.loadedContent.reveal(item)
    }
  }

  onOpenedChanged: {
    if (!opened) {
      return
    }
    hueBridge.refresh(true)
    favoritesFile.reload()
    panelCursor.reset(hueBridge.connected ? "target" : "")
  }

  KeyboardPanel {
    id: panel

    anchorItem: button
    owner: root
    bar: root.bar
    open: root.opened
    focusTarget: panel.loadedContent
    contentWidth: panel.fittedContentWidth(Style.space(400))
    contentHeight: panel.fittedContentHeight(panel.loadedContentHeight, Style.space(640))

    content: PanelContent {
      widget: root
    }
  }
}
