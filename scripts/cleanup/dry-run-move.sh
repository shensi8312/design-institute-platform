#!/usr/bin/env bash
set -euo pipefail

# Cleanup relocation helper.
# Default mode is preview (prints planned mv commands without touching files).
# Pass --execute to perform the moves. Use DEST_ROOT env var to customize target (default: archive).

MODE="preview"
if [[ ${1:-} == "--execute" ]]; then
  MODE="execute"
  shift
elif [[ ${1:-} == "--preview" ]]; then
  MODE="preview"
  shift
fi

DEST_ROOT=${DEST_ROOT:-archive}
LOG_FILE=${LOG_FILE:-"cleanup-moves.log"}

announce() { printf "%s\n" "$1"; }

log_move() {
  local src=$1 dest=$2
  if [[ $MODE == "preview" ]]; then
    printf "[preview] mv %s %s/\n" "$src" "$dest"
  else
    printf "[move] %s -> %s/\n" "$src" "$dest" | tee -a "$LOG_FILE"
  fi
}

move_entry() {
  local src=$1 dest=$2
  mkdir -p "$dest"
  if [[ $MODE == "execute" ]]; then
    mv "$src" "$dest/"
  fi
}

should_skip_script() {
  case $(basename "$1") in
    start.sh|stop.sh|dry-run-move.sh|move-artifacts.sh|Makefile|*.config.js)
      return 0;;
    *)
      return 1;;
  esac
}

announce "--- Cleanup helper (${MODE}) ---"
announce "Destination root: ${DEST_ROOT}"
[[ $MODE == "execute" ]] && announce "Log file: ${LOG_FILE}" && : > "$LOG_FILE"

mkdir -p "${DEST_ROOT}/artifacts/images" \
         "${DEST_ROOT}/artifacts/json" \
         "${DEST_ROOT}/artifacts/scripts" \
         "${DEST_ROOT}/experiments"

# Images
while IFS= read -r -d '' file; do
  dest="${DEST_ROOT}/artifacts/images"
  log_move "$file" "$dest"
  move_entry "$file" "$dest"
done < <(find . -maxdepth 1 -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \) -print0)

# JSON dumps
while IFS= read -r -d '' file; do
  dest="${DEST_ROOT}/artifacts/json"
  log_move "$file" "$dest"
  move_entry "$file" "$dest"
done < <(find . -maxdepth 1 -type f -name '*.json' -print0)

# Legacy scripts (python/ruby/js) excluding core helpers
while IFS= read -r -d '' file; do
  if should_skip_script "$file"; then
    continue
  fi
  dest="${DEST_ROOT}/artifacts/scripts"
  log_move "$file" "$dest"
  move_entry "$file" "$dest"
done < <(find . -maxdepth 1 -type f \( -name '*.py' -o -name '*.rb' -o -name '*.js' \) -print0)

# Directory moves
for pair in "backups:${DEST_ROOT}/backups" \
            "test-results:${DEST_ROOT}/test-results" \
            "uploads:${DEST_ROOT}/uploads" \
            "sketch2su:${DEST_ROOT}/experiments/sketch2su"; do
  src=${pair%%:*}
  dest=${pair##*:}
  if [[ -d $src ]]; then
    log_move "$src" "$dest"
    if [[ $MODE == "execute" ]]; then
      mkdir -p "$(dirname "$dest")"
      mv "$src" "$dest"
    fi
  fi
done

announce "--- End ${MODE} ---"
