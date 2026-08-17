#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# Download + prepare the atmosphere field recordings.
#
# Each atmosphere prefers a real looping recording at
#   apps/web/public/atmospheres/audio/<id>.opus
# and falls back to WebAudio synthesis when the file is absent
# (see apps/web/src/lib/atmosphere/audio.ts), so running this is OPTIONAL —
# it just upgrades the ambience from synth to real field recordings.
#
# Sources are Creative Commons from freesound.org. THREE OF THE FOUR ARE
# CC-BY: the attribution in apps/web/src/components/atmosphere/atmospheres.ts
# (audioCredit) must stay visible in the UI. Do not remove it.
#
#   fuji   Forest Ambient LOOP        Imjeax      CC-BY 4.0  freesound.org/s/427400
#   wave   Atlantic Ocean Waves       tim.kahn    CC-BY 4.0  freesound.org/s/197714
#   fields meadow-land summer ambience klankbeeld CC-BY 4.0  freesound.org/s/240108
#   snow   Howling Wind Ambience      DBlover     CC0        freesound.org/s/405601
#
# Usage:  bash apps/web/scripts/fetch-atmosphere-audio.sh
# Needs:  ffmpeg (brew install ffmpeg), curl, network access to freesound.org
set -euo pipefail

OUT="$(cd "$(dirname "$0")/.." && pwd)/public/atmospheres/audio"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Safari/605.1.15"

# id|freesound user|sound id|start offset (skip intros/quiet heads)|loop body seconds
ENTRIES=(
  "fuji|Imjeax|427400|4|60"
  "wave|tim.kahn|197714|30|60"
  "fields|klankbeeld|240108|120|60"
  "snow|DBlover|405601|8|60"
)

# Seamless loop: crossfade the tail back over the head so the wrap is
# inaudible. Body B + crossfade X => output length B.
XFADE=4

for entry in "${ENTRIES[@]}"; do
  IFS='|' read -r id user sound start body <<<"$entry"
  echo "→ $id  (freesound.org/s/$sound)"

  page="$(curl -sL -A "$UA" "https://freesound.org/people/$user/sounds/$sound/")"
  url="$(printf '%s' "$page" | grep -oE 'https://cdn\.freesound\.org/previews/[0-9]+/[0-9]+_[0-9]+-hq\.mp3' | head -1)"
  if [ -z "$url" ]; then
    echo "   !! could not find a preview URL — skipping" >&2
    continue
  fi

  curl -sL -A "$UA" "$url" -o "$TMP/$id.mp3"

  # Grab body+crossfade worth of audio, then fold the tail back over the head.
  ffmpeg -v error -y -ss "$start" -t "$((body + XFADE))" -i "$TMP/$id.mp3" \
    -filter_complex "\
      [0:a]asplit=2[a][b]; \
      [a]atrim=0:${body},asetpts=PTS-STARTPTS[body]; \
      [b]atrim=${body}:$((body + XFADE)),asetpts=PTS-STARTPTS[tail]; \
      [tail][body]acrossfade=d=${XFADE}:c1=tri:c2=tri, \
      loudnorm=I=-26:TP=-2:LRA=11,aformat=sample_rates=48000[out]" \
    -map "[out]" -c:a libopus -b:a 56k -ac 2 -vbr on -application audio \
    "$OUT/$id.opus"

  echo "   ✓ $(du -h "$OUT/$id.opus" | cut -f1)  $OUT/$id.opus"
done

echo
echo "Done. Reload the app — atmospheres now use the real recordings."
echo "Delete a file to fall back to synthesis for that atmosphere."
