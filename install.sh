#!/usr/bin/env bash
#
# Installs huego and adds the Hue widget to the Omarchy bar.
#
#   bash install.sh               huego, then the plugin
#   bash install.sh --huego-only  only huego (the panel's "Install huego" button)
#
# huego is pinned to one release and checked against its published checksums.

set -euo pipefail

HUEGO_VERSION="v0.2.0"
HUEGO_REPO="mathisarends/huego"
PLUGIN_URL="https://github.com/mathisarends/waybar-hue"
BIN_DIR="${HOME}/.local/bin"
work=""

huego_only=false
for arg in "$@"; do
  case "$arg" in
    --huego-only) huego_only=true ;;
    -h | --help)
      sed -n '3,8p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

say() {
  printf '\033[1m%s\033[0m\n' "$*"
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require() {
  for tool in "$@"; do
    command -v "$tool" >/dev/null 2>&1 || fail "$tool is required but not installed"
  done
}

detect_arch() {
  case "$(uname -m)" in
    x86_64 | amd64) echo amd64 ;;
    aarch64 | arm64) echo arm64 ;;
    *) fail "no huego build for $(uname -m); install it with: go install github.com/${HUEGO_REPO}@${HUEGO_VERSION}" ;;
  esac
}

installed_version() {
  if [[ -x "${BIN_DIR}/huego" ]]; then
    "${BIN_DIR}/huego" --version 2>/dev/null | grep -oE 'v?[0-9]+\.[0-9]+\.[0-9]+' | head -n 1 || true
  fi
}

install_huego() {
  local current
  current="$(installed_version)"
  if [[ -n "$current" && "v${current#v}" == "$HUEGO_VERSION" ]]; then
    say "huego ${HUEGO_VERSION} is already installed"
    return
  fi

  require curl tar sha256sum
  local arch asset base
  arch="$(detect_arch)"
  asset="huego_linux_${arch}.tar.gz"
  base="https://github.com/${HUEGO_REPO}/releases/download/${HUEGO_VERSION}"
  work="$(mktemp -d)"
  trap 'rm -rf "$work"' EXIT

  say "Downloading huego ${HUEGO_VERSION} (${arch})"
  curl -fsSL -o "${work}/${asset}" "${base}/${asset}"
  curl -fsSL -o "${work}/checksums.txt" "${base}/checksums.txt"

  say "Verifying checksum"
  (cd "$work" && grep " ${asset}\$" checksums.txt | sha256sum --check --status) \
    || fail "checksum mismatch for ${asset}"

  tar -xzf "${work}/${asset}" -C "$work" huego
  mkdir -p "$BIN_DIR"
  install -m 0755 "${work}/huego" "${BIN_DIR}/huego"
  say "Installed huego to ${BIN_DIR}/huego"

  case ":${PATH}:" in
    *":${BIN_DIR}:"*) ;;
    *) echo "Note: ${BIN_DIR} is not on your PATH. The widget still finds huego there." ;;
  esac
}

pair_hint() {
  if "${BIN_DIR}/huego" bridge get --json >/dev/null 2>&1; then
    return
  fi
  echo
  say "Next: pair your bridge"
  local command="huego"
  command -v huego >/dev/null 2>&1 || command="${BIN_DIR}/huego"
  echo "Press the link button on your Hue bridge, then run:"
  echo "  ${command} setup"
  echo "Or open the Hue panel in the bar and choose \"Pair bridge\"."
}

# With `curl | bash`, stdin is this script. Hand omarchy the terminal so it can
# ask before installing and let you pick the bar section.
omarchy_with_terminal() {
  if (: </dev/tty) 2>/dev/null; then
    omarchy "$@" </dev/tty
  else
    omarchy "$@" --yes
  fi
}

install_plugin() {
  require omarchy git
  if [[ -d "${HOME}/.config/omarchy/plugins/mathisarends.hue" ]]; then
    say "The Hue widget is already installed; updating it"
    omarchy_with_terminal plugin update mathisarends.hue
    return
  fi

  say "Adding the Hue widget to the bar"
  omarchy_with_terminal plugin add "$PLUGIN_URL" --enable
}

install_huego
if [[ "$huego_only" == false ]]; then
  install_plugin
fi
pair_hint
