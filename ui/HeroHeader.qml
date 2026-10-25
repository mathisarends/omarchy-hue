import QtQuick
import qs.Commons
import qs.Ui
import "../lib/hue.js" as Hue

// Top of the panel: a bulb, "Hue", how many lights are on and a switch for
// the whole home.
PanelHero {
  id: hero

  required property var widget
  readonly property var bridge: widget.bridge
  readonly property bool homeOn: bridge.connected && bridge.live("home", bridge.home).on

  function describe() {
    const home = bridge.home
    if (bridge.status === "loading") {
      return widget.t("meta.loading")
    }
    if (!bridge.connected) {
      return widget.statusTitle
    }
    if (!homeOn) {
      return widget.t("meta.allOff")
    }
    return widget.tn("meta.lightsOn", home.lightsTotal)
      .arg(widget.number(home.lightsOn))
      .arg(widget.number(home.lightsTotal))
  }

  title: widget.t("title")
  meta: describe()
  foreground: widget.fg
  fontFamily: widget.fontFamily
  iconOpacity: bridge.connected ? 1 : 0.5

  iconComponent: Component {
    HueText {
      widget: hero.widget
      text: hero.homeOn ? Hue.Glyph.bulb : Hue.Glyph.bulbOff
      font.pixelSize: Style.font.display
    }
  }

  trailingControl: Component {
    ToggleSwitch {
      visible: hero.bridge.connected
      checked: hero.homeOn
      foreground: hero.widget.fg
      cursorRing: false
      onToggled: hero.bridge.setPower("home", hero.bridge.home, !hero.homeOn)
    }
  }
}
