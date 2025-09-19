# Fitness App (MVP)

Offline-first web app to track workouts, sets/reps/weight, rest timers, and program -> week -> day periodization. Built with vanilla JS + IndexedDB. Deployed on GitHub Pages.

## Features
- Programs with Weeks and Days; attach exercises to days
- Log sessions with sets (reps, weight)
- Last-weight tracking and +2.5% next-session suggestion
- Rest timer with 1:00, 1:30, 3:00 presets and ding (WebAudio)
- Offline-ready PWA (manifest + service worker)
- Export/Import JSON

## Quick Start
1. **Download** this folder and put it in a GitHub repo.
2. Commit & push to `main`.
3. Enable **GitHub Pages** (Settings → Pages → Deploy from branch → `/ (root)`).
4. Visit your Pages URL. The app will install its service worker on first load.

## Local Dev
Open `index.html` in a local server (e.g. VSCode Live Server).

## Roadmap (scaling to multi-user)
- Authentication & cloud sync (Supabase/Postgres or Firebase)
- Share programs; template library
- Progression schemes (e.g., 5/3/1, RIR/RPE) with auto-suggestions
- Charts & PR tracking
- Mobile install prompts & push notifications

## Data Model (IndexedDB)
- `programs(id, name, notes)`
- `weeks(id, programId, label, order)`
- `days(id, weekId, label, order, exerciseIds[])`
- `exercises(id, name, notes)`
- `sessions(id, dateISO, programId, weekId, dayId)`
- `sets(id, sessionId, exerciseId, reps, weight, timestamp)`
- `lastWeight(exerciseId, weight)`

