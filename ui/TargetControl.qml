import QtQuick
import qs.Commons
import qs.Ui

// The group the bar icon controls, with its brightness.
Column {
  id: control

  required property var widget

  width: parent ? parent.width : 0
  spacing: Style.space(6)

  function percentText() {
    if (!widget.targetState.on) {
      return widget.t("group.off")
    }
    if (slider.dragging) {
      return widget.number(Math.round(slider.liveValue)) + "%"
    }
    const brightness = widget.targetState.brightness
    return brightness >= 0 ? widget.number(brightness) + "%" : ""
  }

  PanelSeparator {
    foreground: control.widget.fg
  }

  Item {
    width: parent.width
    implicitHeight: Math.max(header.implicitHeight, percent.implicitHeight)

    PanelSectionHeader {
      id: header
      text: control.widget.targetMissing
        ? control.widget.t("target.notFound").arg(control.widget.target.name)
        : control.widget.targetLabel
      foreground: control.widget.fg
      fontFamily: control.widget.fontFamily
      elide: Text.ElideRight
      anchors.left: parent.left
      anchors.right: percent.left
      anchors.verticalCenter: parent.verticalCenter
    }

    HueText {
      id: percent
      widget: control.widget
      text: control.percentText()
      dim: true
      font.pixelSize: Style.font.caption
      font.bold: true
      anchors.right: parent.right
      anchors.rightMargin: Style.space(6)
      anchors.verticalCenter: parent.verticalCenter
    }
  }

  BrightnessSlider {
    id: slider
    widget: control.widget
    stopId: "target"
    kind: control.widget.target.kind
    group: control.widget.targetGroup
    width: parent.width
    enabled: !control.widget.targetMissing
    opacity: enabled ? 1 : 0.45
  }
}
