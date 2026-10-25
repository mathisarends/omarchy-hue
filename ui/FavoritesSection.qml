import QtQuick
import qs.Commons
import qs.Ui
import "../lib/hue.js" as Hue

// One-click favorites from the user's favorites file, each with its key.
Column {
  id: section

  required property var widget
  readonly property var entries: widget.favorites.entries

  width: parent ? parent.width : 0
  spacing: Style.space(10)

  PanelSeparator {
    foreground: section.widget.fg
  }

  Item {
    width: parent.width
    implicitHeight: Math.max(header.implicitHeight, editButton.implicitHeight)

    PanelSectionHeader {
      id: header
      text: section.widget.t("section.favorites")
      foreground: section.widget.fg
      fontFamily: section.widget.fontFamily
      anchors.left: parent.left
      anchors.verticalCenter: parent.verticalCenter
    }

    PanelActionButton {
      id: editButton
      iconText: Hue.Glyph.pencil
      tooltipText: section.widget.t("favorites.edit")
      foreground: section.widget.fg
      fontFamily: section.widget.fontFamily
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      onClicked: section.widget.editFavorites()
    }
  }

  Grid {
    id: grid

    readonly property real cellWidth: (width - spacing) / 2

    visible: section.entries.length > 0
    width: parent.width
    columns: 2
    spacing: Style.spacing.xs

    Repeater {
      model: section.entries

      Button {
        id: favoriteButton

        required property var modelData
        required property int index
        readonly property string stopId: "fav:" + index

        width: grid.cellWidth
        text: modelData.label
        iconText: Hue.favoriteKeyLabel(section.widget.keymap, index)
        leftAlign: true
        bordered: true
        fontSize: Style.font.caption
        foreground: section.widget.fg
        fontFamily: section.widget.fontFamily
        hasCursor: section.widget.cursor.at(stopId)
        onHasCursorChanged: {
          if (hasCursor) {
            section.widget.reveal(favoriteButton)
          }
        }
        onClicked: section.widget.runFavorite(index)
        onHovered: function(isHovered) {
          if (isHovered) {
            section.widget.cursor.hover(favoriteButton.stopId)
          }
        }
      }
    }
  }

  // No favorites yet: a hint that opens the file.
  CursorSurface {
    visible: section.entries.length === 0
    width: parent.width
    implicitHeight: emptyText.implicitHeight + Style.spacing.xl
    hasCursor: section.widget.cursor.at("favedit")
    foreground: section.widget.fg

    HueText {
      id: emptyText
      widget: section.widget
      text: section.widget.favorites.exists ? section.widget.t("favorites.noneInFile") : section.widget.t("favorites.empty")
      dim: true
      wrapMode: Text.Wrap
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.leftMargin: Style.space(8)
      anchors.rightMargin: Style.space(8)
      anchors.verticalCenter: parent.verticalCenter
    }

    MouseArea {
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onContainsMouseChanged: {
        if (containsMouse) {
          section.widget.cursor.hover("favedit")
        }
      }
      onClicked: section.widget.editFavorites()
    }
  }
}
