import QtQuick
import "../lib/hue.js" as Hue

// The panel's cursor, shared by keyboard and mouse. `current` is one of the
// stop ids described in src/cursor.ts.
QtObject {
  id: cursor

  property var stops: []
  property string current: ""
  // Off until the keyboard is used or the mouse hovers something, so the
  // panel opens without a highlighted row.
  property bool active: false

  /** True when the cursor sits on this stop and should be drawn. */
  function at(id) {
    return active && current === id
  }

  function hover(id) {
    active = true
    current = id
  }

  function moveTo(id) {
    current = id
  }

  function step(delta) {
    current = Hue.stepStop(stops, current, delta)
  }

  function side(delta) {
    current = Hue.sideStop(stops, current, delta)
  }

  function reset(id) {
    active = false
    current = stops.includes(id) ? id : (stops[0] || "")
  }

  onStopsChanged: current = Hue.clampStop(stops, current)
}
