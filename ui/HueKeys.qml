import QtQuick
import "../lib/hue.js" as Hue

// Turns key presses into panel actions through the configurable keymap
// (src/keymap.ts). Escape closes and Tab moves to the next panel, as in every
// Omarchy panel.
Item {
  id: keys

  property var keymap: Hue.parseKeymap(null)

  signal actionRequested(string action)
  signal favoriteRequested(int index)
  signal closeRequested()
  signal tabRequested(int direction)

  // In a right-to-left layout, the key for "right" walks backwards.
  function mirrored(action) {
    if (!LayoutMirroring.enabled) {
      return action
    }
    if (action === "left") {
      return "right"
    }
    if (action === "right") {
      return "left"
    }
    return action
  }

  focus: true
  Keys.priority: Keys.BeforeItem
  Keys.onPressed: function(event) {
    if (event.key === Qt.Key_Escape) {
      keys.closeRequested()
      event.accepted = true
      return
    }
    if (event.key === Qt.Key_Tab || event.key === Qt.Key_Backtab) {
      const back = event.key === Qt.Key_Backtab || (event.modifiers & Qt.ShiftModifier) !== 0
      keys.tabRequested(back ? -1 : 1)
      event.accepted = true
      return
    }

    const result = Hue.lookupKey(keys.keymap, Hue.keyOfEvent(event.key, event.text, event.modifiers))
    if (result.type === "action") {
      keys.actionRequested(keys.mirrored(result.action))
      event.accepted = true
    } else if (result.type === "favorite") {
      keys.favoriteRequested(result.index)
      event.accepted = true
    }
  }
}
