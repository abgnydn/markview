# temple

> An embodied 3D presence for the web — face mesh, particle nebula, voice. Drop `<TempleExperience />` into a React + Three.js app and you have a living oracle.

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.180-orange.svg)](https://threejs.org/)

```
                ╭───────────────╮
                │     ◉   ◉     │
                │       ‿       │
                ╰───────────────╯
              · · ·  temple  · · ·
```

## Why

Most chat UIs are flat text boxes. temple gives a model a body — an eye that finds you across the canvas, a face that breathes, particles that pulse to a heartbeat, a voice that says what the model just said. It's the difference between "a textbox replied" and "something looked at me."

## Install

```bash
npm install temple three react @react-three/fiber @react-three/drei @react-three/postprocessing
```

## 60-second example

```tsx
'use client';

import { Canvas } from '@react-three/fiber';
import { TempleExperience } from 'temple';

export default function Page() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#07070c' }}>
      <Canvas camera={{ position: [0, 1.6, 8], fov: 55 }}>
        <TempleExperience />
      </Canvas>
    </div>
  );
}
```

Open the page. You should see the face appear behind a curtain, eyes settle on the camera, particles drift past. Click "enter your body" to switch to a first-person rig and walk up to it.

## What's in the box

| primitive | what it does |
|---|---|
| `<TempleExperience />` | the whole thing — face + eyes + hair + dais + curtain + particles + chat + speech, composed |
| `<TempleFace />` | parametric face mesh with breathing and micro-expressions |
| `<TempleEyes />` | eye anchors with gaze tracking — drop into any face |
| `<TempleHair />` | physically-loose strands, sims wind |
| `<TempleDais />` | the platform the presence stands on (animated entrance) |
| `<TempleCurtain />` | reveal / dismiss veil for ritual moments |
| `<TempleNebula />` | volumetric particle backdrop |
| `<TempleStars />`, `<TempleParticles />`, `<TempleBubbles />` | ambient atmosphere layers |
| `<TempleChatHistory />` + `useChatHistory()` | bubbles that drift up and fade |
| `<TempleSpeechInput />` | mic input → text, wired to STT of your choice |
| `<TempleInventory />` + `useInventory()` | objects orbiting the presence — items the user has summoned |
| `<TempleSummoned />` | object the presence is currently holding / contemplating |
| `<EmbodiedRig />` | optional first-person controls (PointerLock + WASD) |
| `useTempleTts()` | speak() / cancel() driven by a Web Worker (Kokoro by default) |
| `useVoice()` | low-level audio analysis for lip-sync, beat-pulsing nebula, etc. |

All primitives are independently usable — assemble your own presence if `<TempleExperience />` is too opinionated.

## Voice

temple ships with a Kokoro TTS web worker at `public/kokoro-worker.mjs`. To enable voice, copy the `public/` folder to your app's static directory:

```bash
cp -r node_modules/temple/public/* public/
```

The worker is optional — `useTempleTts()` is a no-op if the worker file isn't reachable.

## Dev

```bash
git clone https://github.com/abgnydn/temple.git
cd temple
npm install
npm run build       # produces dist/index.js + dist/index.d.ts
npm run dev         # watch mode for development
npm run typecheck   # strict tsc, no emit
```

## Layout

```
src/
├── components/    Three.js + React primitives (the parts list above)
├── lib/           helpers — embodied rig, doc types, hub client, speech bridge
├── app/           a standalone Next.js demo route
└── index.ts       public barrel — start reading here
public/
├── face-mesh.obj  3D face geometry
└── kokoro-worker.mjs  TTS web worker (optional)
dist/              built library output (after `npm run build`)
```

## Status

Early — public API is stable enough to embed, but builds are not yet on npm. Clone + link locally for now (`npm pack` and `npm install ./temple-0.1.0.tgz`).

## License

Apache-2.0 — see [LICENSE](./LICENSE).
