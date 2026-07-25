# Overdrive Tokyo — Team Split

**Submission: 16:00 JST. Demo is 3 minutes, from the deployed Vercel URL.**

Two devs: **Padmanabh** (gameplay + data, pairing with Claude Code) and **Jun** (city art + look).

Stack is locked: Vite + TypeScript + three.js, `postprocessing` for bloom/SSAO, `lil-gui` for live art tuning. Browser, WebGL2, fully 3D. No Unreal, no Godot.

**Deploys are automatic: every push to `main` ships to Vercel.** That means `main` is the demo. A broken push is a broken demo, so run `bun run typecheck` before pushing — `build` deliberately does not typecheck, so that a strict-mode error can never fail a deploy.

The game: **a night courier run through Shibuya.** You carry a parcel to a drop point against a timer. The live city fights you — rain slicks the ground, crowd density slows you, and mid-run a concert lets out and a crowd surge blocks the direct route, which you have to escape and reroute around.

---

## File ownership — do not edit outside your lane

Merge conflicts are the only thing that can actually kill us. The boundary is by directory, so we never touch the same file.

| Path | Owner | Contents |
| --- | --- | --- |
| `src/city/**` | **Jun** | Building geometry, road layout, neon signs, window textures, materials |
| `src/render/**` | **Jun** | Lighting, fog, tone mapping, bloom/SSAO passes |
| `src/ui/gui.ts` | **Jun** | The lil-gui art panel bindings |
| `src/game/**` | Padmanabh + Claude | Player, camera, crowd, steering, objective, timer, surge event |
| `src/data/**` | Padmanabh + Claude | Client-side feed access, fixtures, adapters |
| `server/**` | Padmanabh + Claude | Route logic + local Fastify dev server |
| `api/**` | Padmanabh + Claude | Vercel Functions — the same logic in production |
| `src/ui/hud.ts` | Padmanabh + Claude | Timer, objective, condition readout |
| `src/main.ts` | Padmanabh + Claude | Wiring and the frame loop |
| `index.html`, configs | Padmanabh + Claude | Scaffold |

If you need something changed in the other person's lane, say it out loud — don't reach across.

---

## Jun — city art + look

The whole visual quality bet is **night Shibuya**: neon, wet asphalt, fog, heavy bloom. Low-poly geometry reads as premium under good lighting and post. Daytime realism is off the table — we have no assets.

1. **Ground + roads** — dark asphalt, high metalness / low roughness for a wet look. Mirrored emissive quads under the signs as fake reflections; cheap and it sells the rain.
2. **Buildings** — instanced boxes, varied heights, canvas-generated window textures with randomly lit windows. This single texture trick is most of the "city" read.
3. **Neon signs** — emissive planes with canvas-drawn katakana. Saturated, varied hues, vertical sign stacks on the building faces. This is the Tokyo flavour the judges will actually notice.
4. **Lighting + post** — fog colour and density, ACES tone mapping, exposure, bloom threshold/intensity/radius. Tune these live in the lil-gui panel, then **commit the tuned constants** into `src/city/look.ts`.
5. **Stretch if time** — SSAO, a rooftop skyline silhouette in the far distance, light shafts through fog.

`src/city/look.ts` is the contract: every visual number lives there, the gui panel binds to it, and the rest of the code reads it. Nobody else writes that file.

### Handed to Jun — initial versions exist, both open

Claude wrote the first pass of `src/city/**`, `src/render/stage.ts`, and `src/ui/gui.ts` so the scaffold could run. They are yours from here; nobody else edits them.

1. **The scene is too dark.** Values only, in `look.ts`: `exposure` 1.15→~1.35, `fogDensity` 0.011→~0.006, `ambientIntensity` 0.55→~0.8, `streetLightIntensity` 12→~28, `neonIntensity` 2.6→~3.4. Tune in the panel, then commit.
2. **`glBlitFramebuffer` warning floods the console.** `postprocessing`'s composer shares a depth-stencil buffer between read and write. Measured at 60fps / 18.8ms worst frame, so it is cosmetic — do not let it eat your time. Disabling MSAA does *not* fix it; the likely real fix is swapping to three's own `UnrealBloomPass`, which touches `stage.ts` and `gui.ts`.

## Padmanabh + Claude — gameplay + data

1. **Stage + loop** — renderer, composer, third-person camera, fixed-step update.
2. **Player courier** — WASD + mouse look, sprint, capsule collision against buildings.
3. **Crowd** — 1000+ NPCs as a single `InstancedMesh`, grid steering, capsule repulsion off the player. Umbrellas appear when the weather feed says rain.
4. **Objective** — pickup, drop point, countdown, win/lose, and crowd density slowing the player.
5. **Surge event** — at a set point in the run a dense crowd mass spawns and blocks the direct route. This is the escape beat.
6. **Live data** — Open-Meteo for real Tokyo weather (no API key, CORS-enabled). Rail status behind an adapter with a fixture fallback. Crowd density is a fixture — the commercial people-flow APIs are paywalled and not obtainable today.
7. **HUD** — timer, objective, and a live condition readout so the judges can see real data driving the sim.

---

## Schedule

| Time | Target |
| --- | --- |
| 12:50 | ~~Scaffold running~~ **done** |
| 13:20 | ~~City renders, crowd instanced, courier moves, timer + surge + live weather wired~~ **done**, 60fps |
| 14:00 | Jun's look pass landed; deployed URL confirmed working |
| 14:30 | ai& + Daytona wired if credentials arrived; rain verified end to end |
| 15:00 | **Feature freeze.** Jun's look tuning committed. |
| 15:00–15:40 | Rehearse the 3-minute demo end to end, twice, **from the deployed URL** |
| 15:40 | Stop touching code — last push to `main` is the demo |
| 16:00 | Submit |

Feature freeze at 15:00 is the important line. Anything not working by then gets cut, not debugged.

Because deploys are automatic, the last green push before 15:40 is what the judges see. Do not push after that.

---

## Sponsor integrations — Padmanabh + Claude

Judging criterion 4 is **sponsored product usage, checked at code level**. We are using two:

**ai& — the City Director.** On each condition change (weather flips to rain, rail delay appears, surge fires), one inference call decides how the city reacts and returns a short Japanese-flavoured narration line for the HUD. Real inference driving gameplay, not decoration. Domestic-GPU hosting is also a theme-alignment point to say out loud in the demo.

**Daytona — the Probe sandbox.** Crowd density has no free API, so a small agent writes and executes its own code in a Daytona sandbox to derive a density figure, and keeps that state across the run. This is the event's "write their own code" and "manage their own state" requirements, satisfied literally, and it spends the $100 credit.

**Stretch:** if ai& is OpenAI-compatible, GMI Cloud is a base-URL swap and becomes a third sponsor for a handful of lines.

### Blocked on credentials

A browser cannot hold API keys, so both calls go server-side. Every route body lives once in `server/logic.ts` and is imported by both runtimes:

- **Local dev** — Fastify on `:3000`, with Vite proxying `/api/*` to it (no CORS). `bun dev` starts both.
- **Production** — `api/*.ts` Vercel Functions on the same origin as the static client. No proxy needed.

Needed from the sponsor workshop before this can be wired:

- **ai&** — base URL, API key, model name, and whether the API is OpenAI-compatible
- **Daytona** — API key

Keys go in `.env.local` locally (gitignored) **and in the Vercel project's environment variables** for the deployed build. Setting them in one place does not set the other. Never commit them.

Until they arrive, both integrations sit behind adapters returning fixtures, so the game runs and the demo is rehearsable without them.

## Git protocol

Small commits, push often, pull before you push. Stay in your lane and we never conflict.
