#!/usr/bin/env python3
"""
Render seamless looping cinemagraphs from the atmosphere paintings.

Two backends:

  --cloud replicate   (default, recommended)
    POSTs each painting to Replicate's stable-video-diffusion endpoint
    and downloads the result. ~$0.05-0.10 per painting, ~30 s each,
    runs anywhere with internet and a REPLICATE_API_TOKEN. No local
    GPU needed.

  --cloud local
    Runs diffusers + Stable Video Diffusion locally on MPS / CUDA.
    Only practical on machines with ≥ 24 GB unified memory (M3 Max /
    Ultra) or a discrete NVIDIA GPU. Apple M2 Pro / Air 16 GB will
    OOM at the UNet's ~22 GiB internal buffer.

Both paths then close the loop with an ffmpeg xfade between the last
and first frames so the MP4 plays endlessly seamless, and write the
result next to the source JPG.

The runtime (apps/web/src/components/atmosphere/depth-painting.tsx)
auto-prefers <painting>.mp4 over <painting>.jpg via Three.js
VideoTexture, so dropping new MP4s into public/atmospheres/ is the
only deploy step.

Usage:
  cd tools/cinemagraph
  python -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt
  export REPLICATE_API_TOKEN=r8_...           # only for --cloud replicate

  python render.py                            # all paintings via Replicate
  python render.py fuji-hokusai               # one painting
  python render.py --motion-bucket 120        # tweak motion strength
  python render.py --force                    # re-render even if MP4 exists
  python render.py --cloud local              # use local diffusers instead

Environment toggles:
  MARKVIEW_PAINTINGS_DIR  override the default ../../apps/web/public/atmospheres
  REPLICATE_API_TOKEN     Replicate API token (required for --cloud replicate)
  TORCH_DEVICE            for --cloud local, override autodetect (mps/cuda/cpu)
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.request import urlretrieve


# ── Defaults ───────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PAINTINGS_DIR = REPO_ROOT / "apps/web/public/atmospheres"

# Replicate SVD-XT model id — pin to a known-good version hash so output
# stays consistent across runs. Update via `replicate models <id>`.
REPLICATE_MODEL = "stability-ai/stable-video-diffusion"
REPLICATE_VERSION = "3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438"

# Local diffusers (fallback path, ≥24 GB unified memory)
MODEL_ID_LOCAL = "stabilityai/stable-video-diffusion-img2vid"
TARGET_W, TARGET_H = 576, 320     # SVD-friendly multiples of 64
FRAMES = 14
FPS = 6
MOTION_BUCKET = 120
NOISE_AUG_STRENGTH = 0.02


# ── Cloud backend (Replicate) ──────────────────────────────────────────

def render_painting_cloud(src: Path, dst: Path, motion: int, seed: int):
    """Generate via Replicate → download MP4 → ffmpeg xfade to seamless loop."""
    import replicate  # imported lazily so --cloud local doesn't need it

    if not os.environ.get("REPLICATE_API_TOKEN"):
        print("[err] REPLICATE_API_TOKEN not set. Get one at replicate.com/account/api-tokens", file=sys.stderr)
        sys.exit(2)

    print(f"\n[cloud] {src.name} → {dst.name} (motion={motion}, seed={seed})")
    with src.open("rb") as f:
        output = replicate.run(
            f"{REPLICATE_MODEL}:{REPLICATE_VERSION}",
            input={
                "input_image": f,
                "video_length": "25_frames_with_svd_xt",
                "sizing_strategy": "maintain_aspect_ratio",
                "frames_per_second": FPS,
                "motion_bucket_id": motion,
                "cond_aug": NOISE_AUG_STRENGTH,
                "seed": seed,
            },
        )
    # Replicate returns a FileOutput-like object with .url() or a URL string.
    video_url = output.url() if hasattr(output, "url") else str(output)
    print(f"[cloud] got {video_url}")

    tmp_dir = dst.parent / ".cine-tmp"
    tmp_dir.mkdir(exist_ok=True)
    raw_path = tmp_dir / f"{src.stem}.raw.mp4"
    urlretrieve(video_url, str(raw_path))

    _xfade_to_loop(raw_path, dst, frames=25, fps=FPS, xfade_frames=8)
    raw_path.unlink(missing_ok=True)
    try: tmp_dir.rmdir()
    except OSError: pass
    print(f"[done]  {dst} ({dst.stat().st_size // 1024} KB)")


# ── Local backend (diffusers + SVD non-XT) ─────────────────────────────

def detect_device() -> str:
    env = os.environ.get("TORCH_DEVICE")
    if env:
        return env
    import torch
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def load_pipeline_local(device: str):
    import torch
    from diffusers import StableVideoDiffusionPipeline
    dtype = torch.float16 if device in ("cuda", "mps") else torch.float32
    print(f"[svd] loading {MODEL_ID_LOCAL} on {device} ({dtype})…")
    pipe = StableVideoDiffusionPipeline.from_pretrained(
        MODEL_ID_LOCAL,
        torch_dtype=dtype,
        variant="fp16" if dtype == torch.float16 else None,
    ).to(device)
    if device == "cuda":
        pipe.enable_model_cpu_offload()
    for fn in ("enable_vae_slicing", "enable_vae_tiling"):
        try: getattr(pipe, fn)()
        except Exception: pass
    try: pipe.enable_attention_slicing("max")
    except Exception: pass
    return pipe


def render_painting_local(pipe, src: Path, dst: Path, motion: int, seed: int):
    import torch
    from diffusers.utils import load_image, export_to_video
    print(f"\n[local] {src.name} → {dst.name} (motion={motion}, seed={seed})")
    image = load_image(str(src)).convert("RGB").resize((TARGET_W, TARGET_H))
    generator = torch.manual_seed(seed)
    out = pipe(
        image,
        decode_chunk_size=1,
        generator=generator,
        motion_bucket_id=motion,
        noise_aug_strength=NOISE_AUG_STRENGTH,
        num_frames=FRAMES,
        fps=FPS,
    )
    frames = out.frames[0]

    tmp_dir = dst.parent / ".cine-tmp"
    tmp_dir.mkdir(exist_ok=True)
    raw_path = tmp_dir / f"{src.stem}.raw.mp4"
    export_to_video(frames, str(raw_path), fps=FPS)
    _xfade_to_loop(raw_path, dst, frames=FRAMES, fps=FPS, xfade_frames=5)
    raw_path.unlink(missing_ok=True)
    try: tmp_dir.rmdir()
    except OSError: pass
    print(f"[done]  {dst} ({dst.stat().st_size // 1024} KB)")


# ── Loop closure (shared between backends) ─────────────────────────────

def _xfade_to_loop(raw: Path, dst: Path, frames: int, fps: int, xfade_frames: int):
    xfade_secs = xfade_frames / fps
    full_secs = frames / fps
    if dst.exists():
        dst.unlink()
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(raw),
        "-filter_complex",
        (
            f"[0:v]split=2[a][b];"
            f"[b]trim=0:{xfade_secs},setpts=PTS-STARTPTS+{full_secs - xfade_secs}/TB[b2];"
            f"[a][b2]xfade=transition=fade:duration={xfade_secs}:offset={full_secs - xfade_secs}"
        ),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "-preset", "slow", "-crf", "23",
        str(dst),
    ]
    subprocess.run(cmd, check=True)


# ── CLI ────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("names", nargs="*", help="Painting filename stems (no extension); blank = all")
    ap.add_argument("--cloud", choices=("replicate", "local"), default="replicate", help="Render backend (default: replicate)")
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

    if args.cloud == "replicate":
        try:
            import replicate  # noqa: F401
        except ImportError:
            print("[err] replicate not installed. `pip install replicate` (or use --cloud local).", file=sys.stderr)
            sys.exit(2)
        for src, dst in todo:
            try:
                render_painting_cloud(src, dst, args.motion_bucket, args.seed)
            except Exception as e:
                print(f"[err] {src.name}: {e!r}", file=sys.stderr)
        return

    # local backend
    device = detect_device()
    pipe = load_pipeline_local(device)
    for src, dst in todo:
        try:
            render_painting_local(pipe, src, dst, args.motion_bucket, args.seed)
        except Exception as e:
            print(f"[err] {src.name}: {e!r}", file=sys.stderr)


if __name__ == "__main__":
    main()
