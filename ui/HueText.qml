import QtQuick
import qs.Commons

// Plain text in the bar's colors. Room, scene and favorite names come from
// the bridge and the user's file, so they must never be read as markup.
Text {
  required property var widget
  property bool dim: false

  textFormat: Text.PlainText
  color: dim ? widget.muted : widget.fg
  font.family: widget.fontFamily
  font.pixelSize: Style.font.body
}
