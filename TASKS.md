# Overdrive Tokyo — Team Split

**Submission: 16:00 JST. Demo is 3 minutes, live, run locally via `bun dev`.**

Two devs: **Padmanabh** (gameplay + data, pairing with Claude Code) and **Jun** (city art + look).

Stack is locked: Vite + TypeScript + three.js, `postprocessing` for bloom/SSAO, `lil-gui` for live art tuning. Browser, WebGL2, fully 3D. No Unreal, no Godot, no deploy step.

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
| `src/data/**` | Padmanabh + Claude | Live feeds (weather, rail), fixtures, adapters |
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
| 12:50 | Scaffold running, empty 3D scene on screen |
| 13:20 | City block renders; player moves through it |
| 14:00 | Crowd instanced and steering; objective loop closes (win/lose works) |
| 14:30 | Live weather wired; rain visuals; surge event fires |
| 15:00 | **Feature freeze.** Jun's look tuning baked in. |
| 15:00–15:40 | Rehearse the 3-minute demo end to end, twice |
| 15:40 | Stop touching code |
| 16:00 | Submit |

Feature freeze at 15:00 is the important line. Anything not working by then gets cut, not debugged.

---

## Known scoring gap

Judging criterion 4 is **sponsored product usage, checked at code level**. Right now nothing in this project touches ai&, Daytona, GMI Cloud, Qwen, or Nosana — a pure three.js game scores zero there.

Cheapest real integration that fits the game: route NPC "decisions" or an in-game city-narration line through **ai&** (Japanese domestic GPU, also a theme point), and use **Daytona** as the sandbox for a small agent that fetches or derives a Condition the game has no API for. Needs an owner and a decision — not yet assigned.

## Git protocol

Small commits, push often, pull before you push. Stay in your lane and we never conflict.
