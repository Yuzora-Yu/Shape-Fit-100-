# Architecture decisions

## 2026-08-25: First playable foundation

- The MVP uses Canvas-rendered, angle-ordered radial polygons with 16 vertices. This keeps shapes recognizable and prevents self-intersection without exposing measurement aids.
- Every reference, deformation, candidate percentage, and ordering is derived from an integer seed. No runtime network call or nondeterministic random source is used.
- Candidate shapes first receive local radial deformation and an area-preserving aspect transform, then a final uniform correction to reach the requested integer area percentage.
- Reference and candidate canvases share one fixed virtual coordinate system. Candidate drawings are never auto-fitted to their own bounds, because doing so would destroy the area ratio the player must judge.
- Game and geometry logic lives in `packages/`; the interactive view and rendering live in `app/`.
- The first playable deliberately covers one turn only: remember the reference, watch three copies transform, choose, and reveal all three values. Five-turn scoring is the next product slice.
- System Japanese fonts are used. The project does not fetch fonts, assets, analytics, or inference services at runtime.
