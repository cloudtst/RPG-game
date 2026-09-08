# Neon Runner

A vertical arcade shooter: dodge and blast waves of enemies, collect
power-ups, fight a boss every 5th wave. Built as plain HTML5 canvas +
JS, wrapped in a native iOS shell via WKWebView.

## What's in here
```
www/                 ← the actual game (test this in a browser first!)
  index.html
  style.css
  game.js
ios-wrapper/          ← Swift files to drop into a fresh Xcode project
  NeonRunnerApp.swift
  ContentView.swift
  Info-additions.plist
```

## Step 1 — test the game in a browser (do this first)
This is the fast feedback loop — no Xcode rebuild needed to try
changes.
1. Open `www/index.html` directly in a desktop browser, or serve the
   folder locally (e.g. `python3 -m http.server` from inside `www/`
   and visit `http://localhost:8000`).
2. Controls: arrow keys / WASD to move, Space to fire. On a
   touchscreen: drag bottom-left for the joystick, tap FIRE bottom-right.

Gameplay: 3 lives, waves of enemies (some zigzag, some charge you,
some shoot back), a boss every 5th wave, power-ups (Shield / Rapid
Fire / Multi-shot / Extra life) drop occasionally from kills. Best
score is saved locally in the browser/app.

## Step 2 — wrap it in an iOS app
1. On a Mac, open Xcode → **File → New → Project → iOS → App**.
   - Interface: **SwiftUI**. Language: **Swift**.
   - Name it whatever you like (e.g. "NeonRunner").
2. In the new project, **delete** the default `ContentView.swift` the
   template made, and drag in the two files from `ios-wrapper/`:
   `NeonRunnerApp.swift` and `ContentView.swift` (this will replace
   the template's own App file — keep only one `@main` struct, so
   delete the template's auto-generated `<YourProjectName>App.swift`
   too).
3. Drag the whole `www` folder from this download into the Xcode
   project navigator. **Important:** when the dialog appears, choose
   **"Create folder references"** (blue folder icon), not "Create
   groups" (yellow) — the game's relative paths (`style.css`,
   `game.js`) only resolve correctly with a real folder reference.
   Make sure "Copy items if needed" and your app target are checked.
4. Add the orientation/status-bar keys from `Info-additions.plist`:
   select your project → target → **Info** tab → add each key listed
   in that file (or merge it into your Info.plist if you have one as
   a physical file).
5. Pick a Simulator (or your device) and hit **Run**. You should see
   the game load full-screen in landscape.

## Step 3 — get it onto your device / IPA
- **Simulator/device via Xcode:** just Run — no IPA needed to test.
- **Real IPA for SideStore:** with your device selected as the run
  target, Product → Archive, then **Distribute App → Development**
  (or Ad Hoc) to export an `.ipa`. A free Apple ID works for
  development signing; SideStore/AltStore can also resign it.

## If something doesn't work
- **Blank white/black screen in the app:** almost always the `www`
  folder got added as a "group" instead of a "folder reference" —
  remove it from the project (Remove Reference, not Move to Trash)
  and re-drag it in, picking the blue-folder option this time. The
  wrapper shows an on-screen error message if it can't find
  `www/index.html` at all, which confirms this is the issue.
- **Game logic looks off:** I checked the JavaScript for syntax
  errors and reviewed the logic carefully, but couldn't run it in an
  actual browser from here — if you spot a gameplay bug, tell me
  what happened and I'll fix the code directly.
- **Orientation not locking to landscape:** double check the Info
  tab keys from step 2.4 were actually added — Xcode sometimes needs
  the project closed/reopened to pick up Info tab changes.

## Extending it
- New enemy type: add an entry to `ENEMY_TYPES` in `game.js` and a
  movement branch in `Enemy.update()`.
- New power-up: add a case in `applyPowerUp()` and a color/glyph in
  `PowerUp.draw()`.
- Tune difficulty: `WAVE_ENEMIES_BASE`, the `waveScale` passed into
  `Enemy`/`Boss`, and `spawnTimer` pacing in `update()`.
