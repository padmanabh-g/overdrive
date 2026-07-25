# Overdrive Tokyo

Play inside a living city powered by real-world data.

Japanese version: [README_JP.md](README_JP.md)

Overdrive Tokyo is a WebGL city-action prototype for the Agent Forge AI Hackathon: Tokyo. It turns Shibuya at night into a reactive 3D courier run: live weather changes the city mood, crowd density changes movement pressure, and a mid-run surge forces the player to escape and reroute through wet neon streets.

The pitch is simple: most game cities are scripted. Real Tokyo is not. Weather, rail status, events, and crowd pressure change the city every minute. Overdrive Tokyo makes those signals playable.

## Concept And Technical Approach

Overdrive Tokyo combines a playable 3D city with live data, AI narration, and agent-ready infrastructure:

- **Tokyo-rooted experience:** Shibuya, Tokyo Station, Roppongi, Tokyo Tower, and Kyoto-inspired district presets with distinct lighting, roads, landmarks, and street texture.
- **Live intelligence:** Open-Meteo drives real Tokyo weather. Rain toggles umbrellas, road mood, and city narration.
- **AI city direction:** ai& is used as the City Director route. It turns real conditions and events into short in-world narration.
- **Agent infrastructure path:** Daytona is represented by the Probe route for crowd-density derivation, with a fixture fallback when credentials are unavailable.
- **Qoder-assisted development:** Qoder's agentic coding workflow helped structure and implement the 3D city, district presets, data adapters, documentation, and submode work under time pressure.
- **Cloud-ready architecture:** Vite client, Fastify local server, and Vercel Functions share the same route logic.
- **Playable demo, not a slide deck:** The player moves through the city, fights crowd pressure, races a timer, and reacts to live conditions.

## Demo Story

You are a night courier crossing Shibuya with a parcel.

At first the city feels manageable: rain glows on the road, crowds move through the crossing, and the HUD shows live conditions. Then the city changes. A concert lets out. A dense surge blocks the direct route. The player has to escape, reroute, and still deliver before the timer runs out.

Optional visual submode:

```text
?sub=crowd-combat
```

Crowd Escape Combat keeps the delivery game intact, but adds a shockwave fantasy: instead of killing enemies, the courier blasts a neon pulse to push back hostile blockers and open a temporary route.

## Features

- Fully 3D browser game built with Vite, TypeScript, three.js, and postprocessing.
- Wet asphalt, fog, ACES tone mapping, bloom, SSAO, neon signs, fake road reflections, rain streaks, and district landmarks.
- Instanced crowd simulation with umbrellas in rain.
- Courier player, third-person camera, collision against city geometry, timer, objective marker, win/lose loop.
- Crowd surge event that blocks the route mid-run.
- Live weather route using Open-Meteo for Tokyo.
- Rail route with fixture-compatible shape for future live ODPT-style data.
- ai& City Director adapter for condition-aware narration.
- Daytona Probe adapter for crowd-density derivation, with fallback state.
- District presets selectable by URL.
- Optional Crowd Escape Combat visual submode.

## Districts

Use URL parameters to switch the city preset:

```text
/?district=shibuya
/?district=tokyo
/?district=roppongi
/?district=tokyo-tower
/?district=kyoto
```

Combine with the combat submode:

```text
/?district=tokyo-tower&sub=crowd-combat
/?district=kyoto&sub=crowd-combat
```

District intent:

- **Shibuya:** dense neon, wet roads, stacked signs, scramble-crossing energy.
- **Tokyo Station:** wider roads, office towers, station lighting, heavier skyline.
- **Roppongi:** taller glass silhouettes, club/gallery color, upscale night palette.
- **Tokyo Tower:** red/orange landmark tower, warm tourist glow, park-adjacent roads.
- **Kyoto:** lower buildings, lantern warmth, torii and temple silhouettes, narrower streets.

## Partner Integrations

Overdrive Tokyo connects live data, AI narration, sandbox-ready probe infrastructure, and agentic coding workflow into the gameplay and development process.

### Open-Meteo

`/api/weather` fetches real Tokyo weather and returns current temperature, precipitation, wind speed, and WMO weather code. The client uses that to decide whether rain is active.

### ai&

`/api/city-director` sends the current condition and weather facts to an OpenAI-compatible ai& endpoint when credentials are present:

```text
AI_AND_BASE_URL
AI_AND_API_KEY
AI_AND_MODEL
```

If credentials are missing or the call fails, the game falls back to fixture narration so the demo never stalls.

### Daytona

`/api/probe` is the Probe route for crowd-density derivation. It currently returns a fixture-compatible density value unless `DAYTONA_API_KEY` is present and the sandbox implementation is completed.

The important architecture is already in place: gameplay reads the same probe shape either way, so a live Daytona sandbox can replace the fixture without changing the client.

### Qoder

Qoder was used as part of the development workflow. It helped organize and implement the project across 3D city rendering, district presets, route adapters, README work, and optional submode development.

## Tech Stack

- Vite
- TypeScript
- three.js
- postprocessing
- lil-gui
- Fastify
- Vercel Functions
- Open-Meteo
- ai&
- Daytona-ready probe route
- Qoder-assisted development workflow

## Run Locally

Install dependencies:

```bash
npm install
```

Run the client only:

```bash
npm run dev:client
```

Open:

```text
http://localhost:5173/
```

Run the full local stack with Bun:

```bash
bun dev
```

The full stack starts the Fastify server and Vite client together. If Bun is not installed, the client-only command still lets you inspect the 3D scene, districts, and visual submode.

## Environment

Copy the example file:

```bash
cp .env.example .env.local
```

Fill values only in `.env.local` or in Vercel project environment variables:

```text
AI_AND_BASE_URL=
AI_AND_API_KEY=
AI_AND_MODEL=
DAYTONA_API_KEY=
```

Never commit real keys.

## Validation

```bash
npm run typecheck
npm run build
```

Vite may report a large chunk warning because the 3D stack bundles three.js and postprocessing. The build still succeeds.

## 3-Minute Demo Script

1. Open the deployed app in Shibuya.
2. Show the HUD: live Tokyo conditions, objective, crowd pressure.
3. Start the courier run and move through the wet neon crossing.
4. Call out the live weather path: rain changes city behavior and crowd umbrellas.
5. Trigger or wait for the crowd surge: the city blocks the direct route.
6. Switch to a district preset if time allows: Tokyo Tower or Kyoto makes the Tokyo/Japan theme obvious.
7. Optional: open `?sub=crowd-combat` and press `F` or `Space` to show the neon shockwave route-opening layer.
8. Close with the thesis: Tokyo is no longer a static backdrop. The city is the game system.

## Repository Map

```text
src/city/        City geometry, district looks, landmarks, visual submodes
src/render/      Lighting, fog, tone mapping, bloom/SSAO pipeline
src/game/        Player, crowd, streets, run state, objective flow
src/data/        Client feed adapters
src/ui/          HUD and art tuning GUI
server/          Local Fastify server and shared route logic
api/             Vercel Functions
```

## One-Line Pitch

Overdrive Tokyo is a playable real-time digital twin of Tokyo, where live data and AI narration turn weather, crowds, and urban pressure into the core gameplay.
