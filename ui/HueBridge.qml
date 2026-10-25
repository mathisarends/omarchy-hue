import QtQuick
import Quickshell.Io
import "../lib/hue.js" as Hue

// Everything the widget knows about the bridge, and the only place that runs
// huego. Reads arrive as one snapshot. Writes wait in a queue that stays
// under the bridge's rate limit, and show up in the panel before they land.
Item {
  id: bridge
  visible: false

  // ---- Set by the widget ----
  property string huego: "huego"
  property bool showZones: true
  property real fade: 0
  property bool leader: false
  // Look again quickly while the panel is open, so pairing shows up at once.
  property bool fastRetry: false
  property string genericError: ""

  // ---- What the bridge reported ----
  property string status: "loading"
  property string statusDetail: ""
  property var home: Hue.emptyGroup()
  property var rooms: []
  property var zones: []
  property var scenes: []
  readonly property bool connected: status === "ok"

  // ---- What was asked for and not confirmed yet ----
  property var overrides: ({})
  property var queue: []
  property string lastError: ""

  // A full read finished. The leader hands it to the other bars.
  signal snapshotTaken()

  // ---- Groups ----

  function groupFor(kind, id) {
    if (kind === "home") {
      return home
    }
    const groups = kind === "zone" ? zones : rooms
    return groups.find((group) => group.id === id) || null
  }

  function keyOf(kind, group) {
    return Hue.groupKey(kind, group ? group.id : "")
  }

  /** On, brightness and scene, with changes still on their way shown as done. */
  function live(kind, group) {
    return Hue.liveState(group, overrides[keyOf(kind, group)])
  }

  function sceneActive(kind, group, scene) {
    const state = live(kind, group)
    return state.scene ? state.scene === scene.id : scene.active && state.on
  }

  // ---- Writes ----

  function canControl(kind, group) {
    return connected && (kind === "home" || Boolean(group))
  }

  function setPower(kind, group, on) {
    if (!canControl(kind, group)) {
      return
    }
    let keys = [keyOf(kind, group)]
    if (kind === "home") {
      keys = keys.concat(
        rooms.map((room) => Hue.groupKey("room", room.id)),
        zones.map((zone) => Hue.groupKey("zone", zone.id)))
    }
    showChange(keys, { on: on })
    send(keyOf(kind, group), Hue.controlArgs(kind, group.id, on ? "on" : "off", Hue.fadeArgs(fade)), Hue.GROUP_GAP_MS)
  }

  function togglePower(kind, group) {
    setPower(kind, group, !live(kind, group).on)
  }

  function setBrightness(kind, group, value) {
    if (!canControl(kind, group)) {
      return
    }
    const percent = Math.max(1, Hue.clampPercent(value))
    showChange([keyOf(kind, group)], { on: true, brightness: percent })
    send(keyOf(kind, group), Hue.controlArgs(kind, group.id, "brightness", [String(percent)]), Hue.GROUP_GAP_MS)
  }

  function nudge(kind, group, delta) {
    const next = Hue.nudgedBrightness(live(kind, group), delta)
    if (next !== null) {
      setBrightness(kind, group, next)
    }
  }

  function activateScene(kind, group, scene) {
    if (!canControl(kind, group) || !scene) {
      return
    }
    showChange([keyOf(kind, group)], { on: true, scene: scene.id })
    send(keyOf(kind, group), Hue.sceneArgs(scene.id, fade), Hue.GROUP_GAP_MS)
  }

  /** A scene by id or "Room/Scene", for IPC. */
  function activateSceneNamed(name) {
    if (!connected) {
      return false
    }
    send("", Hue.sceneArgs(String(name), fade), Hue.GROUP_GAP_MS)
    return true
  }

  function runFavorite(favorite) {
    if (!favorite) {
      return
    }
    for (const command of favorite.commands) {
      send("", Hue.favoriteArgs(command), Hue.GROUP_GAP_MS)
    }
  }

  function showChange(keys, patch) {
    overrides = Hue.withOverride(overrides, keys, patch, Date.now())
    overrideExpiry.restart()
  }

  function send(key, args, gap) {
    queue = Hue.enqueue(queue, { key: key, args: args, gap: gap })
    pump()
  }

  function pump() {
    if (runner.busy || gapTimer.running || queue.length === 0) {
      return
    }
    const next = queue[0]
    queue = queue.slice(1)
    gapTimer.interval = next.gap
    runner.start(next.args)
  }

  function flashError(message) {
    lastError = message
    errorClear.restart()
  }

  // ---- Reads ----

  property int pendingReads: 0
  property bool readAgain: false
  property bool scenesStale: true

  function refresh(withScenes) {
    if (withScenes) {
      scenesStale = true
    }
    if (pendingReads > 0) {
      readAgain = true
      return
    }
    const reads = [[homeCall, ["home", "get", "--json"]], [roomsCall, ["room", "list", "--json"]]]
    if (showZones) {
      reads.push([zonesCall, ["zone", "list", "--json"]])
    } else {
      zones = []
    }
    if (scenesStale) {
      scenesStale = false
      reads.push([scenesCall, ["scene", "list", "--json"]])
    }
    pendingReads = reads.length
    for (const [call, args] of reads) {
      if (!call.start(args)) {
        readDone()
      }
    }
  }

  function retry() {
    status = "loading"
    refresh(true)
  }

  function readDone() {
    pendingReads = Math.max(0, pendingReads - 1)
    if (pendingReads > 0) {
      return
    }
    if (leader) {
      snapshotTaken()
    }
    if (readAgain) {
      readAgain = false
      refresh(false)
    }
  }

  function handleEvent(line) {
    const kind = Hue.eventKind(line)
    if (kind === "") {
      return
    }
    if (kind === "scenes") {
      scenesStale = true
    }
    refreshDebounce.restart()
  }

  // ---- Sharing with the other bars ----

  function snapshot() {
    return { status: status, statusDetail: statusDetail, home: home, rooms: rooms, zones: zones, scenes: scenes }
  }

  function adopt(snapshot) {
    if (!snapshot || leader) {
      return
    }
    status = snapshot.status
    statusDetail = snapshot.statusDetail
    home = snapshot.home
    rooms = snapshot.rooms
    zones = snapshot.zones
    scenes = snapshot.scenes
  }

  // ---- Live updates: only the leader streams events ----

  function syncStream() {
    const wanted = leader && connected
    if (eventStream.running !== wanted) {
      eventStream.running = wanted
    }
  }

  onLeaderChanged: {
    syncStream()
    if (leader) {
      refresh(true)
    }
  }
  onConnectedChanged: syncStream()
  onShowZonesChanged: {
    if (leader) {
      refresh(false)
    }
  }
  onHuegoChanged: {
    if (leader) {
      refresh(true)
    }
  }

  // ---- Processes ----

  HueCall {
    id: homeCall
    huego: bridge.huego
    onDone: function(code, out, err) {
      const next = Hue.statusForExit(code)
      bridge.statusDetail = next === "ok" ? "" : Hue.parseError(err).message
      if (next === "ok") {
        bridge.home = Hue.parseHome(out)
      }
      bridge.status = next
      bridge.readDone()
    }
  }

  HueCall {
    id: roomsCall
    huego: bridge.huego
    onDone: function(code, out) {
      if (code === 0) {
        bridge.rooms = Hue.parseGroups(out)
      }
      bridge.readDone()
    }
  }

  HueCall {
    id: zonesCall
    huego: bridge.huego
    onDone: function(code, out) {
      if (code === 0) {
        bridge.zones = Hue.parseGroups(out)
      }
      bridge.readDone()
    }
  }

  HueCall {
    id: scenesCall
    huego: bridge.huego
    onDone: function(code, out) {
      if (code === 0) {
        bridge.scenes = Hue.parseScenes(out)
      } else {
        bridge.scenesStale = true
      }
      bridge.readDone()
    }
  }

  HueCall {
    id: runner
    huego: bridge.huego
    onDone: function(code, out, err) {
      if (code !== 0) {
        bridge.flashError(Hue.parseError(err).message || bridge.genericError)
        // Setup broke or the bridge went away: let the panel say so.
        if (Hue.statusForExit(code) !== "error") {
          bridge.refresh(false)
        }
      }
      gapTimer.restart()
    }
  }

  Process {
    id: eventStream
    command: ["sh", "-c", Hue.LAUNCH, bridge.huego, "events", "--json", "--type", "light,grouped_light,scene,room,zone"]
    stdout: SplitParser {
      onRead: function(line) {
        bridge.handleEvent(line)
      }
    }
    onExited: {
      streamRetry.restart()
      if (bridge.leader) {
        bridge.refresh(false)
      }
    }
  }

  // ---- Timers ----

  Timer {
    id: gapTimer
    interval: Hue.COMMAND_GAP_MS
    onTriggered: bridge.pump()
  }

  Timer {
    id: overrideExpiry
    interval: Hue.OVERRIDE_MS + 100
    onTriggered: {
      bridge.overrides = Hue.pruneOverrides(bridge.overrides, Date.now())
      if (Object.keys(bridge.overrides).length > 0) {
        restart()
      }
    }
  }

  Timer {
    id: errorClear
    interval: 6000
    onTriggered: bridge.lastError = ""
  }

  Timer {
    id: refreshDebounce
    interval: 600
    onTriggered: bridge.refresh(false)
  }

  Timer {
    id: streamRetry
    interval: 5000
    onTriggered: bridge.syncStream()
  }

  // The event stream keeps things live; this is the safety net if it drops.
  Timer {
    interval: 120000
    repeat: true
    running: bridge.leader && bridge.connected
    onTriggered: bridge.refresh(true)
  }

  // Not set up yet, or the bridge is away: keep looking.
  Timer {
    interval: bridge.fastRetry ? 3000 : 30000
    repeat: true
    running: bridge.leader && !bridge.connected && bridge.status !== "loading"
    onTriggered: bridge.refresh(true)
  }
}
