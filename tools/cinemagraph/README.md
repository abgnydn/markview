# Cinemagraph renderer

Generates seamless looping MP4s from the atmosphere paintings using
Stable Video Diffusion XT. Drop the resulting `.mp4` next to its
`.jpg` in `apps/web/public/atmospheres/` and the editor automatically
picks it up — paintings become living cinemagraphs (waves crash,
clouds drift, snow falls).

## Setup (one-time)

```bash
cd tools/cinemagraph
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
brew install ffmpeg      # macOS; or your distro equivalent
```

## Render

```bash
# Every painting that doesn't already have an MP4 next to its JPG
python render.py

# Just one
python render.py fuji-hokusai

# A few
python render.py wave-hokusai snow-hiroshige

# Force re-render
python render.py --force fuji-hokusai

# Tweak motion strength (1-255, lower = subtler; default 90)
python render.py --motion-bucket 60 wave-hokusai
```

## Hardware notes

| Device | Time per painting |
|---|---|
| Apple Silicon (MPS, fp16) | ~3-4 min on M3 Max |
| NVIDIA CUDA (fp16, 4090) | ~30-60 s |
| CPU | ~30 min (skip) |

On Apple Silicon make sure you're running a torch build with MPS:
`pip install --upgrade torch`. The first run downloads the
SVD-XT weights (~9 GB) to `~/.cache/huggingface/hub`.

## Tuning per painting

- **Wave / Snow / Fields** — `--motion-bucket 100-130` reads as actual
  water motion / falling snow / wheat sway.
- **Fuji peaks** — `--motion-bucket 60-80` keeps the mountain
  rock-still and only animates the sky.
- **Misty scenes** — `--motion-bucket 50-70` for slow drift.

If a clip's loop seam shows, raise `--motion-bucket` (more motion =
SVD blurs faster and the xfade hides better) or re-render with a
different `--seed`.

## What happens at runtime

1. The web app's `DepthPainting` component probes for an `.mp4` next
   to the painting's `.jpg` via a HEAD request.
2. If the MP4 exists, the painting is loaded as a `<video autoplay
   loop muted playsinline>` and bound to Three.js as a `VideoTexture`.
   The same depth-aware mesh + Lambert lighting + depth-band motion
   shader runs on top, so the cinemagraph also picks up parallax
   from the cursor and bas-relief shading from the depth map.
3. If no MP4, the existing still-image pipeline runs unchanged.

The `.mp4` files live in `public/atmospheres/` and are served as
static assets — same URL pattern as the existing JPGs, just a
different extension.

## Why SVD-XT and not Wan2.1-I2V

Wan2.1-I2V (Turbo) produces nicer output and is newer (early 2026),
but its Apple Silicon / MPS support is patchier as of writing. SVD-XT
is the most reliable single-image-to-video pipeline that runs locally
on any half-modern GPU. When Wan2.1's MLX/MPS path matures, swap the
pipeline in `load_pipeline()` — everything downstream (ffmpeg xfade,
runtime probe) is model-agnostic.
