# Commits — webgpu-fly

## 2026-07-28

- `07:29` **Merge pull request #1 from abgnydn/fix/audit-2026-07** — +595 −363 — [`b466a52`](https://github.com/abgnydn/webgpu-fly/commit/b466a52ddf93e45a7806ad5b8a98c94029ff0b1f)
- `07:00` **revert(physics): keep the kinematic assist during the RL walker** — +0 −4 — [`a9e24f1`](https://github.com/abgnydn/webgpu-fly/commit/a9e24f1d39c65f6c043067dba5acc5a232a9d5fa)
- `06:59` **fix(tests): point the e2e suite at the simulator, not the landing page** — +15 −15 — [`af496a7`](https://github.com/abgnydn/webgpu-fly/commit/af496a725654075aa586f3d1b0c0531ed20a3b39)
- `06:21` **docs: correct claims the code does not support** — +54 −37 — [`dcd1050`](https://github.com/abgnydn/webgpu-fly/commit/dcd105078f662e4260fb4398a359aae138501486)
- `06:21` **test: give CI something that actually validates behaviour** — +73 −2 — [`f0915b3`](https://github.com/abgnydn/webgpu-fly/commit/f0915b31b69e0f1d22130662df68d927937b2191)
- `06:20` **fix(tools): upload the assets the runtime actually fetches** — +23 −10 — [`35ad7d8`](https://github.com/abgnydn/webgpu-fly/commit/35ad7d8f7693ed354249ecf72ae38eee43b602d2)
- `06:20` **docs(kernel): correct the uniform-struct misdiagnosis in lif.wgsl** — +5 −6 — [`6239296`](https://github.com/abgnydn/webgpu-fly/commit/623929666b90269866f641d85e2ef93861631688)
- `06:20` **fix(cache): bound IndexedDB to one generation per asset** — +16 −5 — [`e2f4dcd`](https://github.com/abgnydn/webgpu-fly/commit/e2f4dcd0e0e5d2ba0fe74d05e0569ecdb8800bf9)
- `06:20` **fix(app): surface failures instead of silently wedging the UI** — +293 −251 — [`8426ffa`](https://github.com/abgnydn/webgpu-fly/commit/8426ffa50de48ff9d11454bbcc7cd5612bf6c448)
- `06:20` **fix(physics): stop the kinematic assist faking the trained walker** — +20 −8 — [`cd6827b`](https://github.com/abgnydn/webgpu-fly/commit/cd6827bd5929dee1d29324f9126f911a1f1b00e3)
- `06:20` **fix(game): make replay determinism real, not just claimed** — +100 −29 — [`01c3369`](https://github.com/abgnydn/webgpu-fly/commit/01c33699df93a9872d296d0bfec372395792e0a3)

## 2026-06-05

- `06:47` **docs(readme): custom connectome hero banner** — +333 −2 — [`cc56ec3`](https://github.com/abgnydn/webgpu-fly/commit/cc56ec37b3cd79a4cba0de3d95a2975f7a2b4352)
- `06:44` **feat(landing): magnificent redesign — a living connectome as the page** — +666 −370 — [`30f4564`](https://github.com/abgnydn/webgpu-fly/commit/30f4564726bae65c4f0692cec88fa5a385125242)
- `06:31` **feat(landing): companion-projects grid + author footer (webgpu-q parity)** — +137 −1 — [`8c8a028`](https://github.com/abgnydn/webgpu-fly/commit/8c8a0286fc2ab74d9162033dfcc8c8a7cbf15cf7)
- `05:03` **docs(readme): add live GitHub Actions CI status badge** — +1 −0 — [`1cab7ba`](https://github.com/abgnydn/webgpu-fly/commit/1cab7bad1bad36dccc9b2943f7e7a619aa9c6354)
- `05:02` **docs: bring repo to the webgpu-q OSS + honesty bar** — +899 −110 — [`f5f4ce9`](https://github.com/abgnydn/webgpu-fly/commit/f5f4ce999d19fe3f9cec50cbb648df1659de288d)
- `05:02` **feat(landing): split a plain-language landing page from the simulator** — +796 −161 — [`6329233`](https://github.com/abgnydn/webgpu-fly/commit/6329233cdcb00b060d299d6bd541023bab571643)
- `05:02` **feat(game): commit Drosophila game mode, replay, and CPU/NEST perf ba…** — +1937 −6 — [`f164782`](https://github.com/abgnydn/webgpu-fly/commit/f1647825776c25b14065b7182d87c0305bec1a8e)

## 2026-05-06

- `13:05` **vnc: visual-reflex deadzone 5° → 2° to fix TOWARD-target flake** — +6 −1 — [`733c7f2`](https://github.com/abgnydn/webgpu-fly/commit/733c7f24cc359286a1421cf68373a21ee5c344d3)
- `12:52` **UI: 'Honest mode' button flips all three demo cheats off at once** — +31 −2 — [`7b88390`](https://github.com/abgnydn/webgpu-fly/commit/7b8839048052a99dc3064a775de1934b3406d850)
- `12:19` **Trained walker: 2 control ticks per render @ 500 Hz to match native** — +33 −20 — [`92c412a`](https://github.com/abgnydn/webgpu-fly/commit/92c412a4276cb6c5e56515d39e340d3d24effe92)
- `10:58` **Trained walker: RAW obs (no normalization) — matches native exactly** — +161 −32 — [`a4e317f`](https://github.com/abgnydn/webgpu-fly/commit/a4e317fca1739f0f31a31a519bd8344320bb6955)
- `10:28` **Trained walker: three fixes against native flybody reference** — +229 −12 — [`30a5d6f`](https://github.com/abgnydn/webgpu-fly/commit/30a5d6f444a3b8ed77f5386dbbb724b54055b425)
- `10:11` **build:slim: also strip the new big binaries before Pages deploy** — +1 −1 — [`edc0ae9`](https://github.com/abgnydn/webgpu-fly/commit/edc0ae901eac00c7e9fa88f6e71e5ab7246778b8)
- `10:07` **e2e + dev page-load: 30s → 1.4s via bundle + fire-and-forget IDB** — +257 −49 — [`0ff2603`](https://github.com/abgnydn/webgpu-fly/commit/0ff2603fee2936832355d4a4f7313c5075f6cea6)
- `09:26` **Real-fly mocap reference trajectory (Vaxenburg 2025), opt-in** — +272 −25 — [`ca0e91b`](https://github.com/abgnydn/webgpu-fly/commit/ca0e91bc6974f1d896ec56af8def9c31bf11515e)
- `09:05` **Cache: route brain/vnc/walking-policy through IDB on the loader path** — +12 −9 — [`bf4ec22`](https://github.com/abgnydn/webgpu-fly/commit/bf4ec22c9d4d58c58a602c40b630039b2f3d07d9)
- `09:01` **Honest-physics toggles default off so demo + e2e keep working** — +63 −69 — [`d0df5eb`](https://github.com/abgnydn/webgpu-fly/commit/d0df5eb6142e26226ab44b4bd4cc1e2b2fd2e474)
- `08:37` **vnc: route visual reflex turn through brain cascade DN asymmetry** — +44 −12 — [`55deed3`](https://github.com/abgnydn/webgpu-fly/commit/55deed35f16a129853108b71bb7d9678fea21992)
- `08:37` **physics: CPG kinematic assist opt-in + procedural ref oscillations** — +50 −35 — [`88d4ba2`](https://github.com/abgnydn/webgpu-fly/commit/88d4ba27dfc46cab92d555a23fcd10cea7802bb5)
- `07:42` **package.json: route deploy through `npx wrangler` for portability** — +1 −1 — [`a283e28`](https://github.com/abgnydn/webgpu-fly/commit/a283e28f735f7e1d01717a33e5b2ef9b8029df81)
- `07:41` **upload_to_r2.sh: LC_ALL=C and use npx wrangler** — +4 −1 — [`353c2d6`](https://github.com/abgnydn/webgpu-fly/commit/353c2d6baaedffa468696adc5643163236d60c3e)
- `07:24` **Cache-bust manifest: ?v=<sha> + immutable Cache-Control on R2** — +185 −18 — [`07a9536`](https://github.com/abgnydn/webgpu-fly/commit/07a95361c94f6b360aa8ee13905c4b63d26d0657)
- `07:23` **Wire BPN command neuron from Dallmann 2026 supp table 1** — +101 −2 — [`c5d8e88`](https://github.com/abgnydn/webgpu-fly/commit/c5d8e884bc54a8674eedf183905a657d02c3d1ed)

## 2026-05-05

- `13:57` **Wire RRN command neuron + Dallmann walking-circuit catalog** — +130 −15 — [`bc9f0da`](https://github.com/abgnydn/webgpu-fly/commit/bc9f0da87a56be852402b1c8604ecefabcd2af28)
- `13:15` **Add 3 famous DNs from Dallmann walking-circuit roster** — +91 −0 — [`28b2889`](https://github.com/abgnydn/webgpu-fly/commit/28b2889efefe4ed0f0467eab99c6f9ced18b5ab1)
- `13:03` **Trained walker: fix actuator order, ranges, joint slicing, appendage …** — +417 −67 — [`78d0cbb`](https://github.com/abgnydn/webgpu-fly/commit/78d0cbbd6a58168921591b707dd190264dceda17)
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
