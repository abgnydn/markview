# Atmosphere arc — from particles on a painting to a lit scene

Branch `atmosphere-revamp`. Status per item is kept here; a new session
starts from this file.

## What exists (after commits a41b11d, 33e7158)

- `depth-painting.tsx` — the painting as a depth-displaced mesh with its own
  shader: Lambert from depth-derived normals, SSAO, aerial haze, in-shader
  bloom, radial god rays toward `uSunUv` (time-of-day phase), DOF following
  scroll, dissolve reveal. Key light orbits on its own clock. Quality
  governor (DPR tiers) measures rAF cadence.
- `webgl-particles.tsx` — one Points draw per atmosphere, up to two
  populations per kind (sprite atlas), curl-noise wind, gusts, flutter,
  motion blur, mip-bias bokeh, scroll parallax, landing on surfaces.
- `accumulation.ts` — Bank (heightfield; SNOW and DUST looks), Surf (wash,
  foam, bubbles, rings), Shafts (four hand-placed beams), stampFlat (litter).
- `audio.ts` — recorded loops (opus) per atmosphere, synth fallbacks.
- `time-of-day.ts` — dawn/day/dusk/night phase → CSS tint + `data-time-phase`.
- zen.css — the kakejiku mount (brocade, rod, roller), paper stack, haze
  tokens per atmosphere.

## The spine (new)

- `scene-light.ts` — ONE light for the whole scene. Derived from the clock
  (continuous elevation/azimuth, not four phases) and the atmosphere's own
  key (Fuji: dawn from the left; Fields: low afternoon sun; Snow: cold sky;
  Wave: overcast, sea-glare). Outputs: direction, colour, intensity, sun UV,
  moon (night), exposure hint. Consumers: painting uniforms, shafts, bank
  looks, CSS vars (`--key-x`, `--key-y`, `--key-rgb`, `--key-warmth`).
- `weather.ts` — per-scene fronts: calm → building → squall → clearing on a
  5–15 minute cycle, plus the audio level when available. Outputs:
  `intensity` (spawn multiplier), `wind` (gust bias), `sea` (energy),
  `visibility` (haze). Consumers: particles, Surf, CSS haze alpha, painting
  exposure.

## Items (numbers from the list given to the owner)

| # | Item | Where | Status |
|---|------|-------|--------|
| 1 | Relight the painting from the scene light | depth-painting | done |
| 2 | Bloom/halation with weight | depth-painting | done (uBloom 0.55) |
| 3 | God rays from the real sun, occluded by depth | depth-painting | done (rays from the scene sun, key colour; still the in-shader radial march) |
| 4 | Exposure per painting (mean luma), grain by luminance | depth-painting, css | done |
| 5 | Time-of-day moves the light; moon + fireflies at night | scene-light, particles | done (continuous sun; moon; fireflies) |
| 6 | Snow lands on the painting's ledges (from the depth map) | accumulation, particles | done (findLedges + LEDGE_LOOK banks) |
| 7 | Snow melts on the paper (wet dots) | front-layer | done (front-layer wet) |
| 8 | Spray beads and runs on the scroll | front-layer | done (front-layer bead + run) |
| 9 | Petal drifts reshaped by gusts, gather against the scroll | accumulation | done (Litter slides, gathers at the scroll foot, blown off the rod) |
| 10 | Rod ridge sheds on a fast scroll | particles | done (Bank.shedRod) |
| 11 | Scroll sways in gusts; its shadow on the painting follows the light | mount-sway, css | done (mount-sway.ts; --mount-cast) |
| 12 | Weather fronts | weather | done (WeatherClock) |
| 13 | Audio-driven: breaks on the crash, gusts on the wind | audio (analyser), particles | done (getAtmosphereSignal → weather; break on onset) |
| 14 | Koi in the wash | painting-atmosphere | not done |
| 15 | Rain atmosphere (Hiroshige) | atmospheres, audio, css, particles | done (5 Hiroshige prints, CC0 loop, synth fallback, drops/splash/drips) |
| 16 | Pointer/gyro parallax | — | NOT doing: owner rejected cursor parallax earlier |
| 17 | Depth-correct occlusion (particles pass behind near objects) | particles | done (uDepthMap in the particle shader) |
| 18 | Rack focus on scene change | depth-painting | done (focal starts far) |
| 19 | Scene switch as weather (haze pulse + gust) | painting-atmosphere, particles | done (--atm-fog pulse + opening gust) |
| 20 | Film emulation (gate weave, fringe, luminance grain) | css | done except chromatic fringe (needs a per-frame filter) |
| 21 | Sumi-e petals (ink bleed on landing) | accumulation | done (ink bleed under ground petals) |
| 22 | Paper that lives (curl, warmth in a beam, cold shadow) | css, scene-light | done (paper key from --key-*, shade in --atm-haze) |
| 23 | Quality tiers in cost order | governor → data-quality | done (data-atm-quality → surface cadence) |
| 24 | Product film per atmosphere | product-video harness | after approval |

## Found on the way

- A custom property written on `<html>` recalculates style for the whole
  document (~6 ms per write on the welcome doc). Per-frame signals go
  through modules (`wind.ts`) or onto the atmosphere container; only
  scene-light's once-a-minute vars and the painting's grain go on the root.
- A 128×64 sprite atlas uploaded as a mipmapped texture sampled as
  transparent; the atlas is kept square.
- Three computes a Points bounding sphere once; a population parked
  off-screen at start was frustum-culled for good. `frustumCulled = false`.
- The rod's underside is `border-box top + 14px`; its top edge is `top - 8`.

## Rules

- Never push. Commit per group on this branch; the owner merges.
- Verify in a real browser (chrome-devtools MCP, built app on :4200). The
  screenshot latency is ~20 s; freeze the sim (`performance.now` override
  with rate 0) to capture a moment.
- Comments state what and why in plain sentences. No marketing voice.
