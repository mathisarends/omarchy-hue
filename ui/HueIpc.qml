import QtQuick
import qs.Commons

// omarchy-shell mathisarends.hue <method> [argument]
//
// Only the leading instance answers, so several bars never compete for the
// same target.
ShellIpc {
  id: ipc

  required property var widget

  target: "mathisarends.hue"

  // ---- Panel ----
  function open(): void {
    ipc.widget.open()
  }

  function close(): void {
    ipc.widget.close()
  }

  function show(): void {
    ipc.widget.open()
  }

  function hide(): void {
    ipc.widget.close()
  }

  function toggle(): void {
    ipc.widget.toggle()
  }

  function refresh(): void {
    ipc.widget.bridge.refresh(true)
  }

  // ---- Lights ----
  function allOff(): void {
    ipc.widget.allOff()
  }

  function allOn(): void {
    ipc.widget.allOn()
  }

  function toggleTarget(): void {
    ipc.widget.toggleTarget()
  }

  function brighten(amount: string): void {
    ipc.widget.nudgeTarget(Number(amount) || ipc.widget.step)
  }

  function dim(amount: string): void {
    ipc.widget.nudgeTarget(-(Number(amount) || ipc.widget.step))
  }

  // ---- Scenes and favorites ----
  function scene(name: string): string {
    return ipc.widget.bridge.activateSceneNamed(name) ? "ok" : ipc.widget.bridge.status
  }

  function favorite(label: string): string {
    const favorite = ipc.widget.favorites.find(label)
    if (!favorite) {
      return "unknown"
    }
    ipc.widget.bridge.runFavorite(favorite)
    return "ok"
  }

  function state(): string {
    const bridge = ipc.widget.bridge
    return JSON.stringify({
      status: bridge.status,
      target: ipc.widget.targetLabel,
      on: ipc.widget.targetState.on,
      brightness: ipc.widget.targetState.brightness,
      home: bridge.home,
      rooms: bridge.rooms,
      zones: bridge.zones,
    })
  }
}
