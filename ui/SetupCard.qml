import QtQuick
import qs.Commons
import qs.Ui
import "../lib/hue.js" as Hue

// Shown while huego cannot reach the bridge: what is wrong and one button
// to fix it.
Column {
  id: card

  required property var widget
  readonly property var bridge: widget.bridge

  width: parent ? parent.width : 0
  spacing: Style.space(10)

  PanelSeparator {
    foreground: card.widget.fg
  }

  Row {
    spacing: Style.space(8)

    HueText {
      widget: card.widget
      text: Hue.Glyph.alert
      color: card.widget.urgent
      font.pixelSize: Style.font.subtitle
      anchors.verticalCenter: parent.verticalCenter
    }

    HueText {
      widget: card.widget
      text: card.widget.statusTitle
      font.pixelSize: Style.font.subtitle
      font.bold: true
      anchors.verticalCenter: parent.verticalCenter
    }
  }

  HueText {
    widget: card.widget
    visible: text !== ""
    text: card.widget.statusText
    dim: true
    wrapMode: Text.Wrap
    width: parent.width
  }

  // huego's own words, which name the exact problem.
  HueText {
    widget: card.widget
    visible: text !== "" && card.bridge.status !== "missing"
    text: card.bridge.statusDetail
    dim: true
    font.pixelSize: Style.font.caption
    wrapMode: Text.Wrap
    width: parent.width
  }

  Row {
    spacing: Style.spacing.sm

    Repeater {
      model: card.widget.setupActions

      Button {
        id: actionButton

        required property string modelData
        required property int index
        readonly property string stopId: "status:" + index

        text: card.widget.t("action." + modelData)
        bordered: true
        foreground: card.widget.fg
        fontFamily: card.widget.fontFamily
        hasCursor: card.widget.cursor.at(stopId)
        onClicked: card.widget.runSetupAction(index)
        onHovered: function(isHovered) {
          if (isHovered) {
            card.widget.cursor.hover(actionButton.stopId)
          }
        }
      }
    }
  }
}
