# Commits — webgpu-fly

## 2026-05-05

- `12:14` **README rewrite: reflect full project state — brain + spine + body + R…** — +105 −41 — [`04118c1`](https://github.com/abgnydn/webgpu-fly/commit/04118c151ea6e016e6708de6c9bde9ee30649609)
- `11:46` **Trained walker: per-call input LayerNorm + tanh action mapping** — +68 −15 — [`e1fd80e`](https://github.com/abgnydn/webgpu-fly/commit/e1fd80e39e2bf18373cba7a5f02528d4c0c5d67f)
- `10:52` **Strictened trained-walker test: body actually advances forward + stay…** — +58 −8 — [`5905d41`](https://github.com/abgnydn/webgpu-fly/commit/5905d4151518d8e39549900c02092c32a0ec3ae2)
- `10:00` **End-to-end trained walker — observation builder, action mapping, runt…** — +360 −15 — [`85aeb7b`](https://github.com/abgnydn/webgpu-fly/commit/85aeb7be6d7d1070f685b72957b465bd71072d6d)
- `09:35` **Walking policy obs layout decoded from SavedModel proto** — +73 −15 — [`f37db3a`](https://github.com/abgnydn/webgpu-fly/commit/f37db3ad7b63e0dc363e209f26f5b079015b2cb3)
- `09:23` **Walking policy correctness: numpy ground truth, fixed weight mapping,…** — +208 −55 — [`19d3c5b`](https://github.com/abgnydn/webgpu-fly/commit/19d3c5b2b13ffab6067ebeb39cf40dc1ced2bf96)
- `08:30` **Build fix: dynamic import path with @vite-ignore for tests** — +6 −2 — [`732df73`](https://github.com/abgnydn/webgpu-fly/commit/732df73b979e234d9436937677fa71279b4a1b44)
- `08:28` **Trained flybody walking policy loads + runs in the browser** — +396 −0 — [`b80a24d`](https://github.com/abgnydn/webgpu-fly/commit/b80a24d84e3fea100ba6124cc1421ea1ada38d85)
- `07:26` **Straight-walking DNs + smoother closed-loop tracking** — +50 −16 — [`20b2ae2`](https://github.com/abgnydn/webgpu-fly/commit/20b2ae268c9a6fecc20441a73b320eb3cf21cdc7)
- `06:55` **Fix closed-loop sign error: visual reflex now turns fly TOWARD target** — +81 −38 — [`c0a0b7b`](https://github.com/abgnydn/webgpu-fly/commit/c0a0b7bb571439eda9b66e820da29dcbe8dfa14d)

## 2026-05-04

- `13:38` **Stronger DN stim + closed-loop refinements + 4 new e2e assertions** — +103 −24 — [`90a713a`](https://github.com/abgnydn/webgpu-fly/commit/90a713a08a931edde7ae7407ba57b533357f381a)
- `12:25` **Ignore .claude/ working dir** — +1 −1 — [`a7c82a7`](https://github.com/abgnydn/webgpu-fly/commit/a7c82a7b8eddfa7763bc6cd391fc1daedda1e7fa)
- `12:25` **Body-walks-visibly fix: proportional kinematic assist + femur-lift gate** — +48 −10 — [`73963c0`](https://github.com/abgnydn/webgpu-fly/commit/73963c0ce7f2078b85a40dc30224b476c0afe12a)
- `11:59` **Track r2-cors.json + match DEPLOY.md to actual deploy steps** — +47 −14 — [`47382f1`](https://github.com/abgnydn/webgpu-fly/commit/47382f1ae272be7d4091e40d8f2b927e3f08c512)
- `11:53` **Pages deploy script — build:slim strips heavy assets before pushing** — +2 −1 — [`c6cfc98`](https://github.com/abgnydn/webgpu-fly/commit/c6cfc98226d639dc2eb553b70967b85ca5ef3542)
- `11:18` **MANC subclass + alpha synapse (real this time) + 4 new e2e tests** — +223 −59 — [`ffb7341`](https://github.com/abgnydn/webgpu-fly/commit/ffb73415acadb1d07da99de29295c979dade4969)
- `10:32` **Cloudflare deploy + boot overlay + click-place-target + Codex links** — +284 −65 — [`226fb0e`](https://github.com/abgnydn/webgpu-fly/commit/226fb0ec49a450ca0c0ce9243cf813e546e02fb3)
- `09:51` **Real MANC spine — Janelia connectome wired into the runtime** — +481 −15 — [`27896b4`](https://github.com/abgnydn/webgpu-fly/commit/27896b4e7c5a9e0d94f135457ab19e2ad4631b0f)
- `09:17` **Public deploy plumbing — vercel.json + env-var asset URLs** — +131 −7 — [`2810020`](https://github.com/abgnydn/webgpu-fly/commit/2810020556013201ee53a216a9fc942de4962b07)
- `09:12` **Visual polish: follow-cam, pulsing target, spine activity readout** — +62 −18 — [`eaaefd8`](https://github.com/abgnydn/webgpu-fly/commit/eaaefd89cc387269213e54b930a604e91b19959b)
- `07:57` **Add the spine — 200-neuron VNC LIF + retina overlay + tighter visual …** — +386 −93 — [`6d8130b`](https://github.com/abgnydn/webgpu-fly/commit/6d8130b77831d1ca03d126c286740d35f3985f35)

## 2026-05-02

- `13:36` **Playwright e2e harness — stop using user as QA loop** — +278 −2 — [`6c8ecc0`](https://github.com/abgnydn/webgpu-fly/commit/6c8ecc04e06464a8195c18b50d12c0b5734634fe)
- `13:09` **Revert brain (lif.wgsl + sim.ts) to working 6ac057d state** — +38 −74 — [`d821ff1`](https://github.com/abgnydn/webgpu-fly/commit/d821ff1f89c4d8cf894484aef239e8030d4d0b7f)
- `12:20` **Brain silent — revert calibration, pad Params struct** — +47 −19 — [`d11ec98`](https://github.com/abgnydn/webgpu-fly/commit/d11ec9870c2758053fe67823243fda408cbdf2ee)
- `12:01` **No-cheats upgrade pass: alpha synapse, retina, brain→body, evolved gait** — +801 −212 — [`f29985d`](https://github.com/abgnydn/webgpu-fly/commit/f29985da93730cdfd3cbfe96fe06c2054308f84b)

## 2026-05-01

- `18:46` **Upright lock + DNp01 jump impulse (no more face-plant)** — +35 −13 — [`6ac057d`](https://github.com/abgnydn/webgpu-fly/commit/6ac057de0bea1c43ca45393f89361258fb1f0db6)
- `18:41` **fix face-plant: lock pitch/roll qvel + halve velocity peak** — +10 −5 — [`e9e97b4`](https://github.com/abgnydn/webgpu-fly/commit/e9e97b477ae2bbebb5f300ba384dd7321c3913d5)
- `18:38` **fix heading axis: flybody body-forward is +x, not +y** — +13 −9 — [`bd87d84`](https://github.com/abgnydn/webgpu-fly/commit/bd87d84b1634cd244783d773898f3f8c9d129ce7)
- `18:33` **closed-loop one-shot: target dead ahead, FOV 150°, scene fits** — +13 −7 — [`d821d8f`](https://github.com/abgnydn/webgpu-fly/commit/d821d8f17c7bd75794c215c7055283aa331c1adc)
- `18:23` **closed-loop: hybrid motor + reset stale drive + 20% deadband** — +30 −3 — [`d84836b`](https://github.com/abgnydn/webgpu-fly/commit/d84836bf9551e8e7ea98706d41445f7a1b89ef18)
- `18:07` **Re-assert body kinematic command per substep + signed walk** — +40 −28 — [`b2e9234`](https://github.com/abgnydn/webgpu-fly/commit/b2e9234052309cbf910a2ca451d81cecca431d13)
- `17:25` **Hybrid DN buttons + total-activity gate + stronger closed-loop drive** — +50 −20 — [`25705d3`](https://github.com/abgnydn/webgpu-fly/commit/25705d33d3ddc8198bd87b1a1ee005e109588786)
- `17:07` **Closed-loop visual: track virtual target via optic→connectome→body** — +164 −0 — [`9fcfc51`](https://github.com/abgnydn/webgpu-fly/commit/9fcfc51e24a6586eafc3717332b2eb84ad7a120c)
- `16:48` **Famous-DN buttons + evolution / closed-loop stubs (1+2+4 of 4)** — +150 −0 — [`6b24997`](https://github.com/abgnydn/webgpu-fly/commit/6b2499706f79e35dd6074033a7e6f59c2930ec45)
- `16:36` **fix yaw bias: normalise turn by total DN activity + deadband** — +9 −4 — [`7281a8a`](https://github.com/abgnydn/webgpu-fly/commit/7281a8aaf537ff70bb3eb2cbfbf80510c812b5b8)
- `16:33` **Walking that actually walks: 5-fix bundle (kinematic + gait + readout)** — +53 −26 — [`89485c0`](https://github.com/abgnydn/webgpu-fly/commit/89485c0c5337306596687a17b2747e6b9f312372)
- `16:28` **gait: bigger steps + faster cycle + always-on adhesion** — +20 −13 — [`0d2ab51`](https://github.com/abgnydn/webgpu-fly/commit/0d2ab51e07d93620e0507ff1c26676394b8bd2e4)
- `16:23` **Persist drive after stim — fly keeps walking until next selection** — +3 −3 — [`5d30116`](https://github.com/abgnydn/webgpu-fly/commit/5d3011681b5eec3ad6e4cc62c5e78c7dbba64e1d)
- `16:19` **VNC stand-in: brain → tripod gait → flybody legs** — +91 −26 — [`ca967ec`](https://github.com/abgnydn/webgpu-fly/commit/ca967ecd8488ec8d501b69c0c59f20c03d58928d)
- `15:59` **flybody: cap wing amp at 0.2 of canonical pattern (no liftoff)** — +7 −1 — [`9889227`](https://github.com/abgnydn/webgpu-fly/commit/98892275e3772a7614bf66a4cd33656725c1717c)
- `15:53` **flybody: L/R DN asymmetry → asymmetric wing flap (turn intent)** — +28 −17 — [`10995b3`](https://github.com/abgnydn/webgpu-fly/commit/10995b3c85f650f73350efc686b91e60e4e4452a)
- `15:49` **flybody: use canonical wing-beat pattern from flybody (218 Hz, 3-axis)** — +33 −24 — [`aee2f8f`](https://github.com/abgnydn/webgpu-fly/commit/aee2f8f1f15569ee1b04dd8dfbf3540268b684d9)
- `15:37` **flybody: claw adhesion + cap wing amplitude so the buzz doesn't launch** — +28 −3 — [`827a0c8`](https://github.com/abgnydn/webgpu-fly/commit/827a0c801e985d0022c86204838a937ddbfffc75)
- `15:34` **flybody: brain → wing buzz (DN drive → ctrl[wing_*])** — +38 −11 — [`fee671f`](https://github.com/abgnydn/webgpu-fly/commit/fee671f11cc26123ba2d701c8e0dd617a9f5d5ed)
- `15:26` **Recalibrate brain — Shiu's w_syn was 4× too big without alpha synapse** — +13 −11 — [`971a8a3`](https://github.com/abgnydn/webgpu-fly/commit/971a8a3f324068ddcd1aa81780a1707472025547)
- `15:23` **Brain calibrated to Shiu 2024; body steps physics each frame** — +37 −10 — [`4e52444`](https://github.com/abgnydn/webgpu-fly/commit/4e52444b6cce7eb7aeb23fdccec7ca11ac3b9194)
- `12:40` **flybody: flat body graph (don't build parent tree)** — +8 −8 — [`b49f5b7`](https://github.com/abgnydn/webgpu-fly/commit/b49f5b76bcfb93010bfbd0a888948ab8f91bf9f9)
- `12:36` **flybody render: drop OBJLoader/mjv_updateScene, use canonical zalo pa…** — +244 −196 — [`1747b9b`](https://github.com/abgnydn/webgpu-fly/commit/1747b9bb79d45d2febaff00e6618db0c6b9d821e)
- `12:05` **flybody: load via official floor.xml entry, no XML surgery** — +35 −25 — [`f52c257`](https://github.com/abgnydn/webgpu-fly/commit/f52c257b0a20f9cdc71d6e588d2703d185003c61)
- `11:59` **flybody: use canonical _SPAWN_POS, qpos_spring rest, official floor** — +27 −6 — [`0d41205`](https://github.com/abgnydn/webgpu-fly/commit/0d412056c1dc9c10e16d3d03802f79e53281d4f0)
