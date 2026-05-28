#!/usr/bin/env python3
"""
Render seamless looping cinemagraphs from the atmosphere paintings.

For each JPG under apps/web/public/atmospheres/ this script:
  1. Loads + resizes the painting to 1024x576 (SVD-XT input).
  2. Runs Stable Video Diffusion XT to generate a 25-frame clip.
  3. Loops the clip seamlessly with an ffmpeg xfade (the last 8 frames
     crossfade into the first 8) so the MP4 plays endlessly in the
     browser without a visible cut.
  4. Encodes h264 yuv420p, writes <name>.mp4 next to the source JPG.

The runtime (apps/web/src/components/atmosphere/depth-painting.tsx)
auto-prefers <painting>.mp4 over <painting>.jpg via Three.js
VideoTexture, so dropping new MP4s into the public/atmospheres folder
is the only deploy step.

Hardware:
  - Apple Silicon (M1/M2/M3/M4) via PyTorch MPS — confirmed working
    on an M3 Max in ~3-4 min per painting at fp16.
  - NVIDIA GPU via CUDA — ~30-60s per painting on a 4090.
  - CPU — possible but ~30 minutes per painting; skip it.

Usage:
  cd tools/cinemagraph
  python -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt
  python render.py                          # all paintings
  python render.py fuji-hokusai             # one painting
  python render.py --motion-bucket 100      # tweak motion strength
  python render.py --force                  # re-render even if MP4 exists

Environment toggles:
  MARKVIEW_PAINTINGS_DIR  override the default ../../apps/web/public/atmospheres
  TORCH_DEVICE            override device autodetect (mps/cuda/cpu)
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

import torch
from diffusers import StableVideoDiffusionPipeline
from diffusers.utils import load_image, export_to_video


# ── Defaults ───────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PAINTINGS_DIR = REPO_ROOT / "apps/web/public/atmospheres"
MODEL_ID = "stabilityai/stable-video-diffusion-img2vid-xt"
TARGET_W, TARGET_H = 1024, 576
FRAMES = 25            # SVD-XT default; 25 frames @ 6fps = 4.16s
FPS = 6
MOTION_BUCKET = 90     # 1-255; lower = subtle motion (good for paintings)
NOISE_AUG_STRENGTH = 0.02


def detect_device() -> str:
    env = os.environ.get("TORCH_DEVICE")
    if env:
        return env
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def load_pipeline(device: str):
    dtype = torch.float16 if device in ("cuda", "mps") else torch.float32
    print(f"[svd] loading {MODEL_ID} on {device} ({dtype})…")
    pipe = StableVideoDiffusionPipeline.from_pretrained(MODEL_ID, torch_dtype=dtype, variant="fp16" if dtype == torch.float16 else None)
    pipe = pipe.to(device)
    if device == "cuda":
        pipe.enable_model_cpu_offload()
    return pipe


def render_painting(pipe, src: Path, dst: Path, motion: int, seed: int):
    """Render one painting → 4s seamless looping MP4."""
    print(f"\n[render] {src.name} → {dst.name} (motion={motion}, seed={seed})")
    image = load_image(str(src)).convert("RGB").resize((TARGET_W, TARGET_H))
    generator = torch.manual_seed(seed)
    out = pipe(
        image,
        decode_chunk_size=8,
        generator=generator,
        motion_bucket_id=motion,
        noise_aug_strength=NOISE_AUG_STRENGTH,
        num_frames=FRAMES,
        fps=FPS,
    )
    frames = out.frames[0]

    # 1) Write the raw forward clip to a temp file.
    tmp_dir = dst.parent / ".cine-tmp"
    tmp_dir.mkdir(exist_ok=True)
    raw_path = tmp_dir / f"{src.stem}.raw.mp4"
    export_to_video(frames, str(raw_path), fps=FPS)

    # 2) Apply a seamless-loop xfade in ffmpeg. Approach:
    #    - Take the forward clip (4.16s).
    #    - Tail-crop the last ~1.3s (8 frames) and head-crop the same
    #      length, then cross-fade them so frame N → frame 0 is smooth.
    xfade_secs = 8.0 / FPS  # 1.33s
    full_secs = FRAMES / FPS
    looped_path = dst
    if looped_path.exists():
        looped_path.unlink()
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(raw_path),
        "-filter_complex",
        (
            f"[0:v]split=2[a][b];"
            f"[b]trim=0:{xfade_secs},setpts=PTS-STARTPTS+{full_secs - xfade_secs}/TB[b2];"
            f"[a][b2]xfade=transition=fade:duration={xfade_secs}:offset={full_secs - xfade_secs}"
        ),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "-preset", "slow", "-crf", "23",
        str(looped_path),
    ]
    subprocess.run(cmd, check=True)
    raw_path.unlink(missing_ok=True)
    try:
        tmp_dir.rmdir()
    except OSError:
        pass
    print(f"[done]  {dst} ({dst.stat().st_size // 1024} KB)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("names", nargs="*", help="Painting filename stems (no extension); blank = all")
    ap.add_argument("--motion-bucket", type=int, default=MOTION_BUCKET, help=f"SVD motion strength 1-255 (default {MOTION_BUCKET})")
    ap.add_argument("--seed", type=int, default=42, help="Diffusion seed (default 42)")
    ap.add_argument("--force", action="store_true", help="Re-render even if the MP4 already exists")
    args = ap.parse_args()

    paintings_dir = Path(os.environ.get("MARKVIEW_PAINTINGS_DIR", DEFAULT_PAINTINGS_DIR))
    if not paintings_dir.is_dir():
        print(f"[err] paintings dir not found: {paintings_dir}", file=sys.stderr)
        sys.exit(2)

    if shutil.which("ffmpeg") is None:
        print("[err] ffmpeg not on PATH — install via `brew install ffmpeg` or your distro equivalent.", file=sys.stderr)
        sys.exit(2)

    jpgs = sorted(paintings_dir.glob("*.jpg"))
    if args.names:
        wanted = set(args.names)
        jpgs = [p for p in jpgs if p.stem in wanted]
        if not jpgs:
            print(f"[err] no matches for {wanted} under {paintings_dir}", file=sys.stderr)
            sys.exit(2)

    todo = []
    for jpg in jpgs:
        mp4 = jpg.with_suffix(".mp4")
        if mp4.exists() and not args.force:
            print(f"[skip] {jpg.name} (mp4 exists; pass --force to redo)")
            continue
        todo.append((jpg, mp4))

    if not todo:
        print("nothing to do.")
        return

    device = detect_device()
    pipe = load_pipeline(device)

    for src, dst in todo:
        try:
            render_painting(pipe, src, dst, args.motion_bucket, args.seed)
        except subprocess.CalledProcessError as e:
            print(f"[err] ffmpeg failed for {src.name}: {e}", file=sys.stderr)
        except Exception as e:
            print(f"[err] render failed for {src.name}: {e!r}", file=sys.stderr)


if __name__ == "__main__":
    main()
