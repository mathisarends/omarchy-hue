import QtQuick

// The widget exists once per bar, but only one instance, the leader, reads
// the bridge and streams its events; it shares each snapshot with the rest.
// Without a peer list (a replacement bar) every instance leads itself.
Item {
  id: leadership
  visible: false

  // The Panel root. Peers call snapshot(), adoptSnapshot() and
  // scheduleElection() on it.
  required property var widget
  property bool leader: false

  function peers() {
    const bar = widget.bar
    if (!bar || typeof bar.moduleWidgets !== "function" || !widget.moduleName) {
      return []
    }
    return bar.moduleWidgets(widget.moduleName) || []
  }

  function others() {
    return peers().filter((peer) => peer && peer !== widget)
  }

  function elect() {
    const list = peers()
    leader = list.length === 0 || list.indexOf(widget) < 0 || list[0] === widget
    if (!leader && typeof list[0].snapshot === "function") {
      widget.adoptSnapshot(list[0].snapshot())
    }
  }

  function share(snapshot) {
    for (const peer of others()) {
      if (typeof peer.adoptSnapshot === "function") {
        peer.adoptSnapshot(snapshot)
      }
    }
  }

  function scheduleElection() {
    electionTimer.restart()
  }

  Component.onCompleted: Qt.callLater(leadership.elect)

  Component.onDestruction: {
    for (const peer of others()) {
      if (typeof peer.scheduleElection === "function") {
        peer.scheduleElection()
      }
    }
  }

  Timer {
    id: electionTimer
    interval: 300
    onTriggered: leadership.elect()
  }

  // Bars come and go with monitors; check now and then who leads.
  Timer {
    interval: 30000
    repeat: true
    running: true
    onTriggered: leadership.elect()
  }
}
