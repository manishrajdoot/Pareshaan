# ⏰ Pareshaan

⏰ Pareshaan — A beautiful PWA for daily tasks, alarms & reminders. Mobile installable, offline-ready, dark mode, push notifications, vibration & audio alerts. Made by Manish Rajdoot.

[Live Demo](https://manishrajdoot.github.io/Pareshaan/)

**A beautiful, installable PWA for daily tasks, alarms & reminders.**

Offline-ready · Dark/Light mode · Push notifications · Vibration & audio alerts · Works on mobile and desktop.

![Version](https://img.shields.io/badge/version-3.0.0-7c3aed?style=flat-square)
![License](https://img.shields.io/badge/license-Boost%201.0-blue?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-installable-success?style=flat-square)

---

## ✨ Features

**Tasks**
- ✅ Priorities, categories, due dates, tags, and a link/note field per task
- ☑️ Subtasks / checklists inside any task
- 🔁 Recurring tasks (daily, weekly, weekdays) — the next occurrence is created automatically when you complete one
- ↕️ Drag & drop to manually reorder tasks
- ☑️ Bulk select — complete or delete multiple tasks at once
- 🔍 Search (title, description, tags) and multiple sort modes
- ↩️ Undo delete from the toast

**Calendar & Insights**
- 📅 Month and week calendar views with dots for tasks / alarms / reminders
- 🗓️ Day agenda showing everything scheduled, sorted by time
- 🔥 Completion streaks, a 7-day activity chart, and a category breakdown

**Alarms & Reminders**
- ⏰ Repeatable alarms with custom labels, days, and vibration
- 🏷️ Group alarms (e.g. "Work days", "Weekend") and toggle a whole group at once
- 🎵 Upload your own custom alarm sound (under 400 KB)
- 😴 Configurable snooze duration
- 🔔 One-off, daily, weekly, or weekday reminders
- 📍 Optional location-based reminders — **foreground-only**: they check while
  Pareshaan is open in your browser. Browsers don't yet support true background
  geofencing for web apps, so this isn't a substitute for a native app if you need
  alerts while Pareshaan is fully closed.

**App-level**
- 🌐 English / Hindi language toggle
- 🎨 Five accent color themes, plus dark/light mode
- 🔒 Optional 4-digit PIN lock on app open
- 📱 Installable PWA, works offline
- 💾 All data stays local in your browser — no account, no server
- 📤 Export / import a JSON backup any time (also nudged weekly)
- ⬆️ In-app update notification when a new version is deployed, with a one-tap reload
- ⌨️ Keyboard shortcuts: `N` new task, `A` new alarm, `R` new reminder, `/` search, `Esc` close

## 🚫 Not included (and why)

- **Cloud sync / login** — would require a backend and account system, which breaks
  the fully-offline, no-signup design. Use Export/Import Backup to move data between
  devices instead.
- **Home-screen widgets** — not supported by installable web apps (PWAs) on Android
  or iOS today.
- **True background location reminders** — browsers restrict geofencing to when the
  page is open; see the note above.

## 🚀 Live Demo

Once deployed to GitHub Pages, your app will be live at:

```
https://<your-username>.github.io/<repo-name>/
```

## 🛠️ Getting Started

Pareshaan is a static, dependency-free PWA — no build step required.

### Run locally

```bash
git clone https://github.com/<your-username>/Pareshaan.git
cd Pareshaan
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080` (or the port your server prints) in your browser.

> Opening `index.html` directly via `file://` will work for the UI, but service worker
> features (offline mode, notifications) require serving over `http://` or `https://`.

### Deploy to GitHub Pages

This repo ships with a ready-to-use GitHub Actions workflow at
`.github/workflows/deploy.yml`. To go live:

1. Push this repository to GitHub.
2. In your repo, go to **Settings → Pages → Build and deployment → Source**, and select **GitHub Actions**.
3. Push to `main` (or run the workflow manually from the **Actions** tab).
4. Your site will be published automatically at `https://<your-username>.github.io/<repo-name>/`.

No extra configuration needed — the workflow uploads the repository root as-is.

## 📂 Project Structure

```
Pareshaan/
├── index.html          # App markup (7 tabs: Tasks, Alarms, Reminders, Calendar, Insights, Settings, About)
├── style.css            # Theming & layout
├── app.js                # App logic (state, UI, alarms, notifications, calendar, insights, settings)
├── sw.js                  # Service worker (offline cache, push, updates)
├── manifest.json           # PWA manifest
├── icons/                    # App icons (various sizes)
└── .github/workflows/deploy.yml  # GitHub Pages deployment
```

## 🔒 Data & Privacy

Pareshaan stores everything locally in your browser (`localStorage`) — nothing is sent
to a server, including custom alarm sounds and location coordinates for location
reminders. Use **Export Backup** on the About tab to save a JSON copy of your data,
and **Import Backup** to restore it on another device or browser. If you enable the
PIN lock, note it's a local deterrent (stored on-device), not encryption.

## 🧩 Tech Stack

Plain HTML, CSS, and vanilla JavaScript — no frameworks, no build tools, no dependencies.
Uses native Web APIs: Service Worker, Notifications, Vibration, Web Audio, Geolocation.

## 🗺️ What's New in v3.0.0

- Subtasks/checklists, tags, links, and recurring tasks
- Drag-and-drop manual task reordering
- Bulk select with complete/delete actions
- Calendar tab with month/week views and a day agenda
- Insights tab: streaks, weekly activity chart, category breakdown
- Alarm groups and custom uploaded alarm sounds
- Configurable snooze duration
- Foreground location-based reminders
- English/Hindi language toggle
- Five accent color themes
- Optional PIN app lock
- Weekly backup reminder nudge
- Keyboard shortcuts

## 🤝 Contributing

Issues and pull requests are welcome! If you spot a bug or have an idea for a feature,
feel free to open an issue.

## 📄 License

Licensed under the [Boost Software License 1.0](LICENSE).

## ❤️ Credits

Made with love by **[Manish Rajdoot](https://github.com/manishrajdoot)**.

