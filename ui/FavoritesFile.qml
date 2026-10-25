import QtQuick
import Quickshell
import Quickshell.Io
import "../lib/hue.js" as Hue

// The user's favorites file. Watched, so saving it updates the panel.
Item {
  id: favorites
  visible: false

  required property string path
  property var entries: []
  property bool exists: false

  signal editorOpened()

  // Creates the file from the starter template unless it exists. The path
  // and the template travel as $1 and $2 and are never parsed by the shell.
  readonly property string createScript: 'mkdir -p "$(dirname "$1")" && { [ -e "$1" ] || printf "%s" "$2" > "$1"; }'

  function reload() {
    file.reload()
  }

  function find(label) {
    return Hue.findFavorite(entries, label)
  }

  /** Opens the file in the user's editor, creating it first if needed. */
  function edit() {
    writer.command = ["sh", "-c", createScript, "sh", path, Hue.FAVORITES_TEMPLATE]
    writer.running = true
  }

  FileView {
    id: file
    path: favorites.path
    watchChanges: true
    printErrors: false
    onFileChanged: file.reload()
    onLoaded: {
      favorites.exists = true
      favorites.entries = Hue.parseFavorites(file.text())
    }
    onLoadFailed: {
      favorites.exists = false
      favorites.entries = []
    }
  }

  Process {
    id: writer
    onExited: function(code) {
      file.reload()
      if (code === 0) {
        Quickshell.execDetached(["omarchy-launch-editor", favorites.path])
        favorites.editorOpened()
      }
    }
  }
}
