import QtQuick
import qs.Commons
import qs.Ui

// Brightness of one group. Dragging sends values as you go (the queue keeps
// only the newest), right click switches the group on or off.
CursorSurface {
  id: surface

  required property var widget
  required property string stopId
  required property string kind
  required property var group

  readonly property var live: widget.bridge.live(kind, group)
  readonly property bool dragging: slider.dragging
  readonly property real liveValue: slider.liveValue

  height: slider.implicitHeight + Style.spacing.controlGap
  hasCursor: widget.cursor.at(stopId)
  foreground: widget.fg
  outline: true

  onHasCursorChanged: {
    if (hasCursor) {
      widget.reveal(surface)
    }
  }

  PanelSlider {
    id: slider

    bar: surface.widget.bar
    anchors.fill: parent
    anchors.leftMargin: Style.space(6)
    anchors.rightMargin: Style.space(6)
    minimum: 1
    maximum: 100
    step: 1
    integer: true
    // Off shows as empty; on at an unknown level as full.
    value: !surface.live.on ? 1 : (surface.live.brightness < 0 ? 100 : Math.max(1, surface.live.brightness))

    onMoved: function(value) {
      surface.widget.bridge.setBrightness(surface.kind, surface.group, value)
    }
    onReleased: function(value) {
      surface.widget.bridge.setBrightness(surface.kind, surface.group, value)
    }
    onRightClicked: surface.widget.bridge.togglePower(surface.kind, surface.group)
  }

  HoverHandler {
    onHoveredChanged: {
      if (hovered) {
        surface.widget.cursor.hover(surface.stopId)
      }
    }
  }
}
