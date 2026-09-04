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
| 1 | Relight the painting from the scene light | depth-painting | todo |
| 2 | Bloom/halation with weight | depth-painting | todo |
| 3 | God rays from the real sun, occluded by depth | depth-painting | todo |
| 4 | Exposure per painting (mean luma), grain by luminance | depth-painting, css | todo |
| 5 | Time-of-day moves the light; moon + fireflies at night | scene-light, particles | todo |
| 6 | Snow lands on the painting's ledges (from the depth map) | accumulation, particles | todo |
| 7 | Snow melts on the paper (wet dots) | front-layer | todo |
| 8 | Spray beads and runs on the scroll | front-layer | todo |
| 9 | Petal drifts reshaped by gusts, gather against the scroll | accumulation | todo |
| 10 | Rod ridge sheds on a fast scroll | particles | todo |
| 11 | Scroll sways in gusts; its shadow on the painting follows the light | mount-sway, css | todo |
| 12 | Weather fronts | weather | todo |
| 13 | Audio-driven: breaks on the crash, gusts on the wind | audio (analyser), particles | todo |
| 14 | Koi in the wash | painting-atmosphere | maybe |
| 15 | Rain atmosphere (Hiroshige) | atmospheres, audio, css, particles | todo |
| 16 | Pointer/gyro parallax | — | NOT doing: owner rejected cursor parallax earlier |
| 17 | Depth-correct occlusion (particles pass behind near objects) | particles | todo |
| 18 | Rack focus on scene change | depth-painting | todo |
| 19 | Scene switch as weather (haze pulse + gust) | painting-atmosphere, particles | todo |
| 20 | Film emulation (gate weave, fringe, luminance grain) | css | todo |
| 21 | Sumi-e petals (ink bleed on landing) | accumulation | todo |
| 22 | Paper that lives (curl, warmth in a beam, cold shadow) | css, scene-light | todo |
| 23 | Quality tiers in cost order | governor → data-quality | todo |
| 24 | Product film per atmosphere | product-video harness | after approval |

## Rules

- Never push. Commit per group on this branch; the owner merges.
- Verify in a real browser (chrome-devtools MCP, built app on :4200). The
  screenshot latency is ~20 s; freeze the sim (`performance.now` override
  with rate 0) to capture a moment.
- Comments state what and why in plain sentences. No marketing voice.
