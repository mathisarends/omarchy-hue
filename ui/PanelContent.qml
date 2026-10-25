import QtQuick
import QtQuick.Controls
import qs.Commons
import "../lib/hue.js" as Hue

// Everything inside the panel. Keys move the shared cursor; each section
// draws one part of what the bridge reported.
HueKeys {
  id: content

  required property var widget
  readonly property var bridge: widget.bridge
  readonly property var cursor: widget.cursor

  keymap: widget.keymap
  implicitHeight: column.implicitHeight
  anchors.fill: parent

  onActionRequested: function(action) {
    content.perform(action)
  }
  onFavoriteRequested: function(index) {
    content.widget.runFavorite(index)
  }
  onCloseRequested: content.widget.close()
  onTabRequested: function(direction) {
    content.widget.switchPanel(direction)
  }

  // ---- Actions ----

  function perform(action) {
    switch (action) {
    case "down":
      move(() => cursor.step(1))
      break
    case "up":
      move(() => cursor.step(-1))
      break
    case "first":
      move(() => cursor.moveTo(cursor.stops[0] || ""))
      break
    case "last":
      move(() => cursor.moveTo(cursor.stops[cursor.stops.length - 1] || ""))
      break
    case "left":
      sideways(-1)
      break
    case "right":
      sideways(1)
      break
    case "activate":
      move(() => activate(cursor.current))
      break
    case "expand":
      toggleRowAtCursor()
      break
    case "close":
      widget.close()
      break
    case "allOff":
      widget.allOff()
      break
    case "allOn":
      widget.allOn()
      break
    case "refresh":
      bridge.refresh(true)
      break
    case "editFavorites":
      widget.editFavorites()
      break
    }
  }

  // The panel opens without a highlighted row: the first key press only
  // shows the cursor, the next ones move it.
  function move(change) {
    if (!cursor.active) {
      cursor.active = true
      return
    }
    change()
  }

  // On a slider or row, sideways dims and brightens; on a row of buttons it
  // walks along them.
  function sideways(direction) {
    const stop = Hue.parseStop(cursor.current)
    if (cursor.active && Hue.adjustsBrightness(stop)) {
      const at = groupAt(stop)
      bridge.nudge(at.kind, at.group, direction * widget.step)
      return
    }
    move(() => cursor.side(direction))
  }

  function groupAt(stop) {
    if (stop.type === "target") {
      return { kind: widget.target.kind, group: widget.targetGroup }
    }
    return { kind: stop.kind, group: stop.kind ? bridge.groupFor(stop.kind, stop.id) : null }
  }

  function activate(id) {
    const stop = Hue.parseStop(id)
    const at = groupAt(stop)
    switch (stop.type) {
    case "target":
    case "group":
    case "slider":
      bridge.togglePower(at.kind, at.group)
      break
    case "scene":
      if (at.group) {
        bridge.activateScene(at.kind, at.group, Hue.scenesFor(bridge.scenes, at.group.name)[stop.index])
      }
      break
    case "fav":
      widget.runFavorite(stop.index)
      break
    case "favedit":
      widget.editFavorites()
      break
    case "status":
      widget.runSetupAction(stop.index)
      break
    }
  }

  function toggleRowAtCursor() {
    const stop = Hue.parseStop(cursor.current)
    if (!stop.kind) {
      return
    }
    const key = Hue.groupKey(stop.kind, stop.id)
    widget.toggleExpanded(key)
    cursor.active = true
    cursor.moveTo("group:" + key)
  }

  /** Scrolls just far enough to show the item under the cursor. */
  function reveal(item) {
    const flick = scrollArea.contentItem
    if (!item || !flick || flick.contentY === undefined) {
      return
    }
    const margin = Style.space(6)
    const top = item.mapToItem(flick.contentItem || flick, 0, 0).y
    const bottom = top + item.height
    if (top < flick.contentY + margin) {
      flick.contentY = Math.max(0, top - margin)
    } else if (bottom > flick.contentY + flick.height - margin) {
      flick.contentY = bottom + margin - flick.height
    }
  }

  readonly property string hint: Hue.keyHints(widget.keymap)
    .map((hint) => hint.keys + " " + widget.t(hint.label))
    .join("   ·   ")

  // ---- Layout ----

  ScrollView {
    id: scrollArea
    anchors.fill: parent
    clip: true
    ScrollBar.horizontal.policy: ScrollBar.AlwaysOff
    ScrollBar.vertical.policy: column.implicitHeight > height ? ScrollBar.AsNeeded : ScrollBar.AlwaysOff

    Column {
      id: column
      width: scrollArea.availableWidth
      spacing: Style.space(14)

      HeroHeader {
        widget: content.widget
      }

      HueText {
        widget: content.widget
        visible: text !== ""
        text: content.bridge.lastError
        color: content.widget.urgent
        font.pixelSize: Style.font.caption
        wrapMode: Text.Wrap
        width: parent.width
      }

      SetupCard {
        widget: content.widget
        visible: !content.bridge.connected && content.bridge.status !== "loading"
      }

      TargetControl {
        widget: content.widget
        visible: content.bridge.connected
      }

      FavoritesSection {
        widget: content.widget
        visible: content.bridge.connected
      }

      GroupSection {
        widget: content.widget
        kind: "room"
        title: content.widget.t("section.rooms")
        groups: content.bridge.rooms
      }

      GroupSection {
        widget: content.widget
        kind: "zone"
        title: content.widget.t("section.zones")
        groups: content.widget.showZones ? content.bridge.zones : []
      }

      HueText {
        widget: content.widget
        visible: content.bridge.connected && content.widget.showHints && text !== ""
        text: content.hint
        dim: true
        opacity: 0.8
        font.pixelSize: Style.font.caption
        wrapMode: Text.Wrap
        width: parent.width
        horizontalAlignment: Text.AlignHCenter
      }

      Item {
        width: parent.width
        height: Style.space(2)
      }
    }
  }

  // Only scroll by dragging when there is something to scroll to.
  Binding {
    target: scrollArea.contentItem
    property: "interactive"
    value: column.implicitHeight > scrollArea.height
  }
}
