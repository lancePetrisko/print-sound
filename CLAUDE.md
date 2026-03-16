# PrintSound — Spotify Stats Dashboard

> **Claude Code Context File**
> Primary reference for building, extending, or debugging this project.

---

## Project Overview

**PrintSound** is a web app that connects to a user's Spotify account via OAuth 2.0, pulls their listening data from the Spotify Web API, and presents it as a rich, interactive dashboard — top tracks, top artists, genre breakdown, audio personality profile, estimated listening hours, and recently played history.

Think of it as a year-round Spotify Wrapped, available on demand, across three time ranges.

---

## Current Architecture

This is a **vanilla HTML/CSS/JS frontend** served by an **Express backend** — all on a single port. No React, no Vite, no build step.

### Frontend
- **No framework** — plain HTML (`spotify-stats.html`), vanilla JS, CSS files
- **Styling:** Split across multiple CSS files in `css/` — one per component
- **Charts:** Custom `<canvas>` radar chart (`js/radar.js`)
- **Fonts:** Google Fonts — `Bebas Neue` + `DM Sans`
- **Auth:** `js/auth.js` manages OAuth tokens in memory (never localStorage)
- **API calls:** `js/spotify.js` fetches from Spotify directly using the access token
- **Rendering:** `js/app.js` has both `render()` (mock data) and `renderLive()` (real Spotify data)
- **Mock data:** `js/data.js` provides fallback data shown behind the login overlay

### Backend
- **Runtime:** Node.js + Express
- **Single server** serves both the API routes and the static frontend files
- **Purpose:** OAuth token exchange (keeps `SPOTIFY_CLIENT_SECRET` off the client) and token refresh
- **Port:** 3001 (bound to `127.0.0.1`)

---

## Project Structure

```
print-sound/
├── css/
│   ├── styles.css          # Global resets, CSS variables, noise overlay
│   ├── header.css          # Sticky header, logo, time range tabs
│   ├── hero.css            # Hero section, stat pills, vibe card, audio feature bars
│   ├── sections.css        # Shared section header/title styles
│   ├── tracks.css          # Top tracks list rows
│   ├── artists.css         # Artist card grid
│   ├── genres.css          # Genre bars + radar chart wrapper
│   ├── recent.css          # Recently played card grid
│   ├── login.css           # Login overlay card
│   ├── footer.css          # Footer
│   └── responsive.css      # Media queries
├── js/
│   ├── data.js             # Mock data for 3 time ranges (pre-login fallback)
│   ├── radar.js            # Canvas-based radar chart renderer
│   ├── auth.js             # OAuth token management (login, callback, refresh, logout)
│   ├── spotify.js          # Spotify API calls + data transformation
│   └── app.js              # Init, view switching, render functions, number animations
├── server/
│   ├── routes/
│   │   └── auth.js         # GET /auth/login, GET /auth/callback, POST /auth/refresh
│   ├── index.js            # Express app — serves API + static frontend
│   ├── package.json
│   ├── .env                # Real secrets (git-ignored, never commit)
│   ├── .env.example        # Template with placeholder values (safe to commit)
│   └── .gitignore          # Ignores node_modules/ and .env
├── spotify-stats.html      # Main HTML page
├── CLAUDE.md               # This file
└── README.md
```

---

## Spotify OAuth Flow (How It Actually Works)

Uses **Authorization Code Flow** with a backend token exchange.

```
1. User clicks "Connect with Spotify"
2. Frontend redirects to: http://127.0.0.1:3001/auth/login
3. Server redirects to Spotify authorize URL with scopes + state
4. User approves → Spotify redirects to: http://127.0.0.1:3001/auth/callback?code=AUTH_CODE
5. Server exchanges code for tokens (access_token + refresh_token)
6. Server redirects to frontend: http://127.0.0.1:3001/#access_token=...&refresh_token=...&expires_in=3600
7. Frontend reads tokens from URL hash, stores in memory, cleans URL
8. Frontend calls Spotify API directly with: Authorization: Bearer ACCESS_TOKEN
9. On 401 or near-expiry, frontend calls POST /auth/refresh with refresh_token
```

### Required Scopes
```
user-top-read               # Top tracks and artists
user-read-recently-played   # Recently played tracks
user-library-read           # Saved songs
user-read-private           # User profile
```

### Important: Spotify Redirect URI Rules
- **`localhost` is NOT allowed** as a redirect URI in Spotify's dashboard
- Must use explicit loopback IP: `http://127.0.0.1:3001/auth/callback`
- HTTPS is required for all non-loopback addresses

---

## Spotify API — Endpoints Used

| Feature | Endpoint | Key Params |
|---|---|---|
| User Profile | `GET /me` | — |
| Top Tracks | `GET /me/top/tracks` | `time_range`, `limit=50` |
| Top Artists | `GET /me/top/artists` | `time_range`, `limit=50` |
| Recently Played | `GET /me/player/recently-played` | `limit=50` |
| Audio Features | `GET /audio-features` | `ids` (up to 100, comma-separated) |

### Time Ranges
```javascript
const TIME_RANGE_MAP = { short: 'short_term', medium: 'medium_term', long: 'long_term' };
// short_term  = ~4 weeks
// medium_term = ~6 months
// long_term   = all time
```

---

## Data Aggregation (Computed Client-Side)

All in `js/spotify.js`:

- **Genres:** Aggregated from artist objects (Spotify puts genres on artists, not tracks). Counted, sorted, top 8 shown.
- **Listening Hours:** Estimated from sum of recently-played track durations. Labeled as "(est.)" in the UI.
- **Audio Profile:** Average of energy, danceability, valence, acousticness, instrumentalness, loudness across top 50 tracks.
- **Vibe Identity:** Rule-based label from audio profile (e.g. "Late Night Explorer", "Main Character Energy").
- **Day Streak:** Consecutive unique days in recently-played history.
- **Data is cached** per time range so tab switching is instant.

---

## Design Language & Aesthetic

**Preserve this style.** Do not replace with generic utility-class defaults.

| Property | Value |
|---|---|
| **Theme** | Dark / near-black background (`#0a0a0a`) |
| **Accent** | Spotify green (`#1db954`) |
| **Secondary accents** | Amber (`#f5a623`), Rose (`#e8445a`), Blue (`#5b9cf6`), Violet (`#a78bfa`) |
| **Display font** | Bebas Neue (headings, numbers, rank labels) |
| **Body font** | DM Sans (weight 300/400/500) |
| **Surface colors** | `#111111` (cards), `#1a1a1a` (inputs/secondary), `#222` (borders) |
| **Motion** | Staggered fade-up reveals on scroll; animated count-up numbers; CSS bar growth |
| **Texture** | Subtle SVG noise overlay (3% opacity) on `body::before` |
| **Cards** | Rounded corners (12–20px), 1px borders, hover lift + green border glow |
| **Radar chart** | Canvas — radial gradient fill in green, dot markers on vertices |

---

## Environment Variables

```bash
# server/.env (git-ignored — never commit real values)
SPOTIFY_CLIENT_ID=your_real_client_id
SPOTIFY_CLIENT_SECRET=your_real_client_secret
REDIRECT_URI=http://127.0.0.1:3001/auth/callback
FRONTEND_URL=http://127.0.0.1:3001
PORT=3001
```

The `.env.example` file is committed with placeholder values as a template.

---

## Running Locally

```bash
# Prerequisites: Node.js (install with: brew install node)

# 1. Install server dependencies
cd server && npm install

# 2. Create your .env from the template
cp .env.example .env
# Edit .env with your real Spotify Client ID and Client Secret

# 3. Start the server (serves both API and frontend)
npm run dev

# 4. Open in browser
open http://127.0.0.1:3001
```

Only one server to run — it handles everything.

---

## Important Implementation Notes

1. **Never put `SPOTIFY_CLIENT_SECRET` in frontend code.** Token exchange is server-side only.
2. **Access tokens expire in 1 hour.** `auth.js` auto-refreshes when within 5 minutes of expiry, and retries on 401.
3. **Rate limits:** Spotify allows ~180 requests/minute. Audio features are batched (up to 100 IDs per call).
4. **Development Mode:** New Spotify apps are limited to 25 users. Apply for Extended Quota Mode to go public.
5. **Token storage:** `access_token` is in JS memory only (not localStorage). Refresh token is also in memory.
6. **Images:** `images[1]` (300px) for cards, `images[0]` as fallback.
7. **Error handling:** All API calls in `spotify.js` retry once on 401. On failure, falls back to mock data.
8. **Security:** `.env` is git-ignored. Only `.env.example` (with placeholders) is committed.

---

## Future Features (Nice to Have)

- **Shareable stats card** — Generate a PNG using `html2canvas`
- **Obscurity score** — Average `popularity` across top artists (lower = more underground)
- **Listening calendar** — Heatmap by day (requires full data export)
- **Artist deep-dive modal** — Click artist to see their top tracks + related artists
- **Compare with friends** — Share link, overlay genre profiles

---

*Last updated: March 2026*
