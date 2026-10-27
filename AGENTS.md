<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AGENTS.md

- NIDS.OS dashboard was migrated from a Replit Express+Postgres monorepo; pages live in `src/pages`, routes in `src/routes` are thin wrappers. Why: keep original page code intact.
- All dashboard data comes from `src/lib/api.ts` (in-browser store persisted in localStorage, same hook names as the old generated client). Why: no backend yet; swap internals there to move to Lovable Cloud.
- Layout renders inside `<ClientOnly>`. Why: data and clocks are browser-only and would hydration-mismatch.
- Sensor Control talks to the user's local Python sensor at `VITE_SENSOR_URL` (default http://127.0.0.1:8765). Why: packet capture can only run on the user's machine.
