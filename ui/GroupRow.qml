import QtQuick
import qs.Commons
import qs.Ui
import "../lib/hue.js" as Hue

// One room or zone. Click the row for brightness and scenes, the switch to
// turn it on or off.
Column {
  id: row

  required property var widget
  required property string kind
  required property var group

  readonly property var bridge: widget.bridge
  readonly property string key: Hue.groupKey(kind, group.id)
  readonly property var live: bridge.live(kind, group)
  readonly property bool expanded: widget.expandedKey === key
  readonly property var scenes: expanded ? Hue.scenesFor(bridge.scenes, group.name) : []

  spacing: Style.space(4)

  // "60% · 3 of 4 lights", or "Off · 0 of 4 lights".
  function summary() {
    const lights = widget.tn("group.lights", group.lightsTotal)
      .arg(widget.number(group.lightsOn))
      .arg(widget.number(group.lightsTotal))
    if (!live.on) {
      return widget.t("group.off") + " · " + lights
    }
    if (live.brightness < 0) {
      return lights
    }
    return widget.number(live.brightness) + "% · " + lights
  }

  CursorSurface {
    id: header

    readonly property string stopId: "group:" + row.key

    width: parent.width
    implicitHeight: Math.max(labels.implicitHeight, powerSwitch.implicitHeight) + Style.spacing.sm * 2
    hasCursor: row.widget.cursor.at(stopId)
    current: row.expanded
    foreground: row.widget.fg

    onHasCursorChanged: {
      if (hasCursor) {
        row.widget.reveal(header)
      }
    }

    MouseArea {
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onContainsMouseChanged: {
        if (containsMouse) {
          row.widget.cursor.hover(header.stopId)
        }
      }
      onClicked: row.widget.toggleExpanded(row.key)
    }

    HueText {
      id: icon
      widget: row.widget
      text: row.live.on ? Hue.Glyph.bulb : Hue.Glyph.bulbOff
      opacity: row.live.on ? 1 : 0.45
      font.pixelSize: Style.font.title
      width: Style.space(24)
      horizontalAlignment: Text.AlignHCenter
      anchors.left: parent.left
      anchors.leftMargin: Style.space(6)
      anchors.verticalCenter: parent.verticalCenter
    }

    Column {
      id: labels
      spacing: Style.space(1)
      anchors.left: icon.right
      anchors.leftMargin: Style.space(10)
      anchors.right: chevron.left
      anchors.rightMargin: Style.space(6)
      anchors.verticalCenter: parent.verticalCenter

      HueText {
        widget: row.widget
        text: row.group.name
        elide: Text.ElideRight
        width: parent.width
      }

      HueText {
        widget: row.widget
        text: row.summary()
        dim: true
        font.pixelSize: Style.font.caption
        elide: Text.ElideRight
        width: parent.width
      }
    }

    HueText {
      id: chevron
      widget: row.widget
      text: row.expanded ? Hue.Glyph.chevronDown : Hue.Glyph.chevronRight
      dim: true
      anchors.right: powerSwitch.left
      anchors.rightMargin: Style.space(8)
      anchors.verticalCenter: parent.verticalCenter
    }

    ToggleSwitch {
      id: powerSwitch
      checked: row.live.on
      foreground: row.widget.fg
      cursorRing: false
      anchors.right: parent.right
      anchors.rightMargin: Style.space(6)
      anchors.verticalCenter: parent.verticalCenter
      onToggled: row.bridge.togglePower(row.kind, row.group)
      onHovered: function(isHovered) {
        if (isHovered) {
          row.widget.cursor.hover(header.stopId)
        }
      }
    }
  }

  // Open: brightness and the group's scenes.
  Column {
    id: details

    readonly property real innerWidth: width - leftPadding

    visible: row.expanded
    width: parent.width
    leftPadding: Style.space(12)
    bottomPadding: Style.space(6)
    spacing: Style.space(8)

    BrightnessSlider {
      widget: row.widget
      stopId: "slider:" + row.key
      kind: row.kind
      group: row.group
      width: details.innerWidth
    }

    Flow {
      visible: row.scenes.length > 0
      width: details.innerWidth
      spacing: Style.spacing.xs

      Repeater {
        model: row.scenes

        Button {
          id: sceneButton

          required property var modelData
          required property int index
          readonly property string stopId: "scene:" + row.key + ":" + index

          text: modelData.name
          iconText: Hue.Glyph.palette
          iconSize: Style.font.caption
          fontSize: Style.font.caption
          horizontalPadding: Style.spacing.sm
          bordered: true
          foreground: row.widget.fg
          fontFamily: row.widget.fontFamily
          active: row.bridge.sceneActive(row.kind, row.group, modelData)
          hasCursor: row.widget.cursor.at(stopId)
          onHasCursorChanged: {
            if (hasCursor) {
              row.widget.reveal(sceneButton)
            }
          }
          onClicked: row.bridge.activateScene(row.kind, row.group, modelData)
          onHovered: function(isHovered) {
            if (isHovered) {
              row.widget.cursor.hover(sceneButton.stopId)
            }
          }
        }
      }
    }

    HueText {
      widget: row.widget
      visible: row.scenes.length === 0
      text: row.widget.t("scenes.none")
      dim: true
      font.pixelSize: Style.font.caption
    }
  }
}
