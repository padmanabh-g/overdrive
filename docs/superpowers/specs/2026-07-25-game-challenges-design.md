# Overdrive Tokyo — Challenges, Powerups, Sponsor Depth & Audio

**Branch:** `feat/game-challenges` · commits pushed per task · PR at the end.

## Design rule
Challenges cost **time / route / parcel**, never HP. Player speed is already
`(sprint?SPRINT:WALK) · (1 − 0.72·drag)` in `player.ts`. Every hazard hooks that
one line or the run timer — no HP bar, no new movement engine.

## Why sequential, not parallel subagents
`player.ts` is touched by T1–T3; `main.ts` by T0–T4; `server/logic.ts` by T4–T5.
Parallel agents on shared files = merge conflicts. So tasks run **sequentially**,
each an atomic commit that builds green (`bun run typecheck`) before push.

## Task list (order = dependency order)

- [ ] **T0 — Audio.** `src/audio/audio.ts`: loop `public/audio/bg.mp3` (started on the
  begin-run user gesture) + procedural Web Audio one-shot SFX (no asset files).
  `audio.sfx(name)` API used by T1–T3. Wire `audio.startMusic()` in `main.ts`.
  SFX set: `punch, pickup, beer, steal, recover, cop, redlight, win, lose, surge`.
- [x] **T1 — Crowd hazards.** `crowd.ts`: `sleep` mode (prone matrix, counts double
  in `dragAt` → friction), `drunk` mode (huge weave + dir-flips, sets `hitByDrunk`
  on player contact), export `SQUARE`. `player.ts`: `stagger(s)`. `main.ts`:
  red-light rule (inside `SQUARE` while `!signal.walk` → drag boost), apply stagger + sfx.
- [ ] **T2 — Powerups.** new `src/game/pickups.ts`: konbini beacons, `onigiri`/`pocari`
  → `speedMul 1.35 / 6s`, `beer` → `speedMul 0.6 / 5s`, respawn cooldown. `player.ts`:
  `buff(mul, s)` + `speedMul` in the speed line. `city.ts`: FamilyMart + 7-Eleven meshes
  with `createSignTexture` neon near the crossing. `main.ts`: wire + sfx.
- [ ] **T3 — Encounters + melee.** new `src/game/encounters.ts`: pickpocket (homes,
  steals parcel on contact → chase/punch to recover, else `applyTimePenalty(15)` +
  parcel returns), cop ID-check (sprint-near/red-cross → `player.frozen` N s; timer
  keeps ticking = the cost; line from ai&). `player.ts`: `frozen`, `punching`, parcel
  toggle. `run.ts`: `parcelStolen`, `applyTimePenalty`, block win while stolen. `main.ts`: wire + sfx.
- [ ] **T4 — ai& Director.** `server/logic.ts`: `directorEvent(weather, rail)` → JSON
  `{event, where, intensity, line}`, **validated enum + clamped intensity + deterministic
  local fallback** on any parse/network failure. `feeds.ts`: `director()` call. new
  `src/game/director.ts`: dispatch surge→`crowd.surge`, pickpocket→`spawnPickpocket`,
  checkpoint→`spawnCop`, + `showNarration`. `main.ts`: run the Director off `pollFeeds`.
- [ ] **T5 — Daytona probe.** `server/logic.ts`: real sandbox computes
  `density = f(hour, precip, rail-delay-count)`, sandbox handle reused across calls
  ("manage state"). Behind `DAYTONA_API_KEY`, any error → fixture `0.55`. New dep
  `@daytonaio/sdk`. Off hot path (30s poll).

## Failure modes
- ai& malformed/slow → local scheduler; game unaffected (async off `pollFeeds`, 6s abort).
- Daytona down/slow → fixture density.
- Parcel theft can't soft-lock the run (auto-return + penalty; win blocked while stolen).
- Cop freeze: single active, fixed duration.

## Tests (one runnable check each, no framework)
- `server/logic`: `directorEvent` rejects bad enum + bad JSON → fallback fires.
- `pickups`: buff multiplier math + expiry.
- `encounters`: steal → recover → penalty state machine.
- Visual/three.js: verified in the running game, no unit test.
