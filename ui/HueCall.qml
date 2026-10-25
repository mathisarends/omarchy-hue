import QtQuick
import Quickshell.Io
import "../lib/hue.js" as Hue

// One huego call. Waits for stdout, stderr and the exit code, then reports
// all three at once through done().
Process {
  id: call

  required property string huego
  property var args: []

  property string out: ""
  property string err: ""
  property int returnCode: -1
  // Results still to arrive: stdout, stderr and the exit code.
  property int pending: 0

  readonly property bool busy: running || pending > 0

  signal done(int code, string out, string err)

  command: ["sh", "-c", Hue.LAUNCH, huego].concat(args)

  stdout: StdioCollector {
    waitForEnd: true
    onStreamFinished: {
      call.out = text
      call.settle()
    }
  }

  stderr: StdioCollector {
    waitForEnd: true
    onStreamFinished: {
      call.err = text
      call.settle()
    }
  }

  onExited: function(code) {
    call.returnCode = code
    call.settle()
  }

  /** Starts huego with these arguments; false while a call is still running. */
  function start(list) {
    if (busy) {
      return false
    }
    args = list
    out = ""
    err = ""
    returnCode = -1
    pending = 3
    running = true
    return true
  }

  function settle() {
    if (pending <= 0) {
      return
    }
    pending -= 1
    if (pending === 0) {
      finish()
    } else if (returnCode !== -1) {
      settleTimer.restart()
    }
  }

  function finish() {
    settleTimer.stop()
    pending = 0
    done(returnCode, out, err)
  }

  // A stream that never reports its end must not hold up the queue.
  property Timer settleTimer: Timer {
    interval: 400
    onTriggered: {
      if (call.pending > 0) {
        call.finish()
      }
    }
  }
}
