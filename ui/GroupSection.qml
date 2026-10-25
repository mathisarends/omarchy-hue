import QtQuick
import qs.Commons
import qs.Ui

// "Rooms" or "Zones": a header and one row per group.
Column {
  id: section

  required property var widget
  required property string kind
  required property string title
  required property var groups

  visible: widget.bridge.connected && groups.length > 0
  width: parent ? parent.width : 0
  spacing: Style.space(6)

  PanelSeparator {
    foreground: section.widget.fg
  }

  PanelSectionHeader {
    text: section.title
    foreground: section.widget.fg
    fontFamily: section.widget.fontFamily
    bottomPadding: Style.space(4)
  }

  Repeater {
    model: section.groups

    GroupRow {
      required property var modelData
      widget: section.widget
      kind: section.kind
      group: modelData
      width: section.width
    }
  }
}
