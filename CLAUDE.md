# SoundPrint — Spotify Stats Dashboard

> **Claude Code Context File**
> This document captures the full project vision, technical architecture, design decisions, and conversation history for the SoundPrint Spotify stats web app. Use this as your primary reference when building, extending, or debugging any part of this project.

---

## Project Overview

**SoundPrint** is a web application that connects to a user's Spotify account via OAuth 2.0, pulls their listening data from the Spotify Web API, and presents it as a rich, interactive dashboard. The goal is to give users a fun, visually striking "music identity" — showing their top tracks, top artists, genre breakdown, audio personality profile, listening hours, and recently played history.

Think of it as a year-round version of Spotify Wrapped, available on demand, across three time ranges.

---

## What Was Asked For (Original User Request)

The user asked for a website where:
- Users allow the site access to their Spotify data via OAuth
- The site shows **listening hours**, **top songs**, **top artists**, **top genres**
- The site pulls all data from the Spotify account to make a **fun and interactive experience**
- The overall goal is to let users explore and discover what they like about their own listening habits

A working **HTML prototype with mock data** was built to demonstrate the UI before wiring up the real API. That prototype established the visual design language and component structure that the full app should follow.

---

## Design Language & Aesthetic

The prototype used a deliberate, editorial dark-theme aesthetic. **Preserve this style throughout the app.**

| Property | Value |
|---|---|
| **Theme** | Dark / near-black background (`#0a0a0a`) |
| **Accent** | Spotify green (`#1db954`) as primary action/highlight color |
| **Secondary accents** | Amber (`#f5a623`), Rose (`#e8445a`), Blue (`#5b9cf6`), Violet (`#a78bfa`) |
| **Display font** | Bebas Neue (headings, numbers, rank labels) |
| **Body font** | DM Sans (weight 300/400/500) |
| **Surface colors** | `#111111` (cards), `#1a1a1a` (inputs/secondary), `#222` (borders) |
| **Motion** | Staggered fade-up reveals on scroll; animated count-up numbers; CSS bar growth animations |
| **Texture** | Subtle SVG noise overlay (3% opacity) on `body::before` |
| **Cards** | Rounded corners (12–20px), 1px borders, hover lift (`translateY(-4px)`) + green border glow |
| **Radar chart** | Hand-drawn on `<canvas>` — radial gradient fill in green, dot markers on vertices |

**Do not** replace this aesthetic with generic utility-class defaults or purple gradient schemes.

---

## Tech Stack

### Frontend
- **Framework:** React + Vite
- **Styling:** CSS custom properties (no Tailwind required — the prototype uses raw CSS which should be ported as CSS Modules or a global stylesheet)
- **Charts:** Custom `<canvas>` radar chart (no chart library needed for radar); use **Recharts** if adding bar/line charts
- **Fonts:** Google Fonts — `Bebas Neue` + `DM Sans`
- **Routing:** React Router v6 (`/`, `/dashboard`, `/callback`)

### Backend
- **Runtime:** Node.js
- **Framework:** Express
- **Purpose:** Handles Spotify OAuth token exchange (keeps `SPOTIFY_CLIENT_SECRET` off the client), proxies API calls, and manages token refresh
- **Environment:** `.env` file with `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `REDIRECT_URI`, `FRONTEND_URL`

### Hosting (Recommended)
- Frontend → **Vercel**
- Backend → **Railway** or **Render**

---

## Project Structure

```
soundprint/
├── client/                        # React + Vite frontend
│   ├── public/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx          # Landing page with "Connect Spotify" button
│   │   │   ├── Callback.jsx       # Handles OAuth redirect, exchanges code for tokens
│   │   │   └── Dashboard.jsx      # Main stats page (authenticated)
│   │   ├── components/
│   │   │   ├── Header.jsx         # Logo + time range tabs (4 Weeks / 6 Months / All Time)
│   │   │   ├── HeroStats.jsx      # Name, stat pills (hours/tracks/artists/streak)
│   │   │   ├── VibeCard.jsx       # Sound profile identity + audio feature bars
│   │   │   ├── TopTracks.jsx      # Ranked track list with play hover, popularity bar
│   │   │   ├── TopArtists.jsx     # Artist card grid with avatar, rank, genre
│   │   │   ├── GenreBreakdown.jsx # Genre bars + radar chart canvas
│   │   │   ├── RecentlyPlayed.jsx # Compact card grid of recent plays
│   │   │   └── RadarChart.jsx     # Canvas-based audio feature radar
│   │   ├── hooks/
│   │   │   ├── useSpotify.js      # Auth state, token management, refresh logic
│   │   │   └── useStats.js        # Fetches + aggregates all Spotify data
│   │   ├── utils/
│   │   │   ├── spotify.js         # API call wrappers (getTopTracks, getTopArtists, etc.)
│   │   │   ├── aggregations.js    # Genre counting, hours estimation, vibe scoring
│   │   │   └── constants.js       # TIME_RANGES, SCOPES, color palette
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── vite.config.js
│
├── server/
│   ├── routes/
│   │   ├── auth.js                # GET /login, GET /callback, POST /refresh
│   │   └── spotify.js             # Proxy routes (optional — or call Spotify directly from client)
│   ├── index.js                   # Express app entry
│   └── .env                       # SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, REDIRECT_URI
│
├── CLAUDE.md                      # ← This file
└── README.md
```

---

## Spotify API — Authentication Flow

Uses **OAuth 2.0 Authorization Code Flow with PKCE** (for the frontend) or standard Authorization Code Flow (if using a backend for token exchange).

### Recommended: Backend Token Exchange (More Secure)

```
1. User clicks "Connect Spotify"
2. Frontend redirects to:
   https://accounts.spotify.com/authorize
     ?client_id=CLIENT_ID
     &response_type=code
     &redirect_uri=REDIRECT_URI
     &scope=user-top-read user-read-recently-played user-library-read user-read-playback-state
     &state=RANDOM_STATE_STRING

3. User approves → Spotify redirects to REDIRECT_URI?code=AUTH_CODE&state=...

4. Frontend sends AUTH_CODE to backend: POST /auth/callback

5. Backend exchanges with Spotify:
   POST https://accounts.spotify.com/api/token
   Body: grant_type=authorization_code, code, redirect_uri
   Headers: Authorization: Basic base64(CLIENT_ID:CLIENT_SECRET)

6. Backend receives access_token (1hr TTL) + refresh_token
   → Stores refresh_token securely, returns access_token to frontend

7. Frontend stores access_token in memory (NOT localStorage)
   → Uses it as: Authorization: Bearer ACCESS_TOKEN on all API calls

8. When token expires, frontend calls: POST /auth/refresh
   Backend uses refresh_token to get a new access_token
```

### Required Scopes

```
user-top-read               # Top tracks and artists
user-read-recently-played   # Recently played tracks
user-library-read           # Saved songs (optional, for library stats)
user-read-playback-state    # Current playback (optional)
```

---

## Spotify API — Endpoints to Implement

| Feature | Endpoint | Key Params |
|---|---|---|
| User Profile | `GET /me` | — |
| Top Tracks | `GET /me/top/tracks` | `time_range`, `limit=50` |
| Top Artists | `GET /me/top/artists` | `time_range`, `limit=50` |
| Recently Played | `GET /me/player/recently-played` | `limit=50` |
| Audio Features | `GET /audio-features` | `ids` (up to 100, comma-separated) |

### Time Ranges

```javascript
const TIME_RANGES = {
  short:  'short_term',   // ~4 weeks
  medium: 'medium_term',  // ~6 months
  long:   'long_term',    // All time
};
```

---

## Data Aggregation Logic

The Spotify API doesn't return all stats directly. These need to be computed:

### Genres
Spotify provides genres on **Artist** objects (not tracks). Aggregate like this:

```javascript
function aggregateGenres(topArtists) {
  const counts = {};
  topArtists.forEach(artist => {
    artist.genres.forEach(genre => {
      counts[genre] = (counts[genre] || 0) + 1;
    });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count, pct: Math.round((count / topArtists.length) * 100) }));
}
```

### Listening Hours (Estimated)
Spotify's free API does not expose exact play counts or cumulative listening time. Estimate from recently-played:

```javascript
// Sum durations of recently played tracks, extrapolate
// Alternatively: prompt user to request their full data export at spotify.com/account/privacy
function estimateHours(recentlyPlayed) {
  const totalMs = recentlyPlayed.reduce((sum, item) => sum + item.track.duration_ms, 0);
  return Math.round(totalMs / 1000 / 60 / 60 * 10) / 10; // hours, 1 decimal
}
```

> **Note to Claude Code:** For a more accurate "total hours" stat, display a note to the user that exact hours require requesting their Spotify data export. The estimated figure should be clearly labeled as an estimate.

### Audio Feature Profile (Vibe Score)
Fetch audio features for top 50 tracks, then average them:

```javascript
async function getAudioProfile(trackIds, accessToken) {
  const res = await fetch(`https://api.spotify.com/v1/audio-features?ids=${trackIds.join(',')}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const { audio_features } = await res.json();
  const keys = ['energy', 'danceability', 'valence', 'acousticness', 'instrumentalness', 'loudness'];
  const profile = {};
  keys.forEach(key => {
    const vals = audio_features.filter(Boolean).map(f => f[key]);
    profile[key] = vals.reduce((a, b) => a + b, 0) / vals.length;
  });
  return profile;
}
```

### Vibe Identity Label
Map audio profile to a personality label (shown in the VibeCard):

```javascript
function getVibeIdentity(profile) {
  if (profile.energy > 0.75 && profile.valence < 0.5) return { id: 'Late Night Explorer', desc: '...' };
  if (profile.danceability > 0.7 && profile.energy > 0.65) return { id: 'Main Character Energy', desc: '...' };
  if (profile.acousticness > 0.5 && profile.energy < 0.5) return { id: 'Quiet Storm', desc: '...' };
  if (profile.instrumentalness > 0.4) return { id: 'The Thinker', desc: '...' };
  // ... add more labels
  return { id: 'Eclectic Archivist', desc: '...' };
}
```

---

## Key Components — Behavior Reference

### Header
- Sticky, blurred background (`backdrop-filter: blur(16px)`)
- Logo: `SoundPrint` in Bebas Neue, green accent
- Time range tabs: 3 buttons (4 Weeks / 6 Months / All Time) — switching re-fetches or re-renders from cached data

### HeroStats (Stat Pills)
- Displays: Hours Listened, Unique Tracks, Artists, Day Streak
- Numbers animate up from 0 on load/range change using `requestAnimationFrame`
- Streak is derived from consecutive days in `recently-played` history

### VibeCard
- Right side of the hero grid
- Shows the computed **vibe identity label** (e.g. "Late Night Explorer")
- Shows a short personality description (2–3 sentences)
- Shows 5 audio feature bars (Energy, Danceability, Valence, Acousticness, Instrumentalness)
- Bars animate from `scaleX(0)` to `scaleX(1)` with staggered delay

### TopTracks
- Ranked list (1–10 or up to 50)
- Each row: rank number → album art (or emoji fallback) → track name + artist → popularity bar → duration
- Hover state: rank number hides, play icon (▶) appears
- Popularity bar uses gradient from green → amber

### TopArtists
- CSS Grid, `repeat(auto-fill, minmax(180px, 1fr))`
- Each card: avatar (Spotify image or emoji fallback) → name → rank → primary genre
- Hover: `translateY(-4px)` + green border + green box shadow

### GenreBreakdown
- Left: horizontal bar chart with genre name, colored bar, percentage
- Right: canvas radar chart showing audio feature profile
- Bars animate using CSS `scaleX` transform on load

### RadarChart (canvas)
- Labels: Energy, Danceability, Valence, Acousticness, Instrumentalness, Loudness
- Grid: 4 concentric rings, dimly lit
- Fill: `createRadialGradient` from `rgba(29,185,84,0.5)` center to near-transparent edge
- Stroke: `#1db954`, 2px
- Dots: 4px filled circles at each data point vertex

### RecentlyPlayed
- Grid of compact cards: album art + track name + artist + relative time
- "2m ago", "18m ago", "1h ago" — format timestamps relative to `Date.now()`

---

## Environment Variables

```bash
# server/.env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
REDIRECT_URI=http://localhost:3001/auth/callback
FRONTEND_URL=http://localhost:5173

# client/.env (Vite)
VITE_API_BASE_URL=http://localhost:3001
VITE_SPOTIFY_CLIENT_ID=your_client_id_here
VITE_REDIRECT_URI=http://localhost:5173/callback
```

---

## Important Implementation Notes

1. **Never put `SPOTIFY_CLIENT_SECRET` in frontend code.** Token exchange must happen server-side.

2. **Access tokens expire in 3600 seconds (1 hour).** Implement a refresh mechanism:
   - Store `refresh_token` in an httpOnly cookie on the backend
   - Auto-refresh in a `useEffect` or Axios interceptor when a 401 is returned

3. **Rate limits:** Spotify allows ~180 requests/minute. Batch audio feature calls — the endpoint accepts up to 100 track IDs per request.

4. **New Spotify apps start in Development Mode** — limited to 25 users. To go public, apply for **Extended Quota Mode** in the Spotify Developer Dashboard.

5. **Token storage:** Store `access_token` in React state or a context — NOT `localStorage` (XSS risk). Use httpOnly cookies for `refresh_token`.

6. **Images:** Spotify track/artist objects return `images[]` arrays. Always use `images[1]` (300×300) for cards, `images[2]` (64×64) for small avatars.

7. **Error handling:** Wrap all API calls. A 403 usually means missing scopes. A 429 means you're rate limited — implement exponential backoff.

---

## Prototype Reference

A complete working HTML prototype with mock data was built (`spotify-stats.html`). It demonstrates:
- All components and their layout
- The exact color palette, typography, and animation style
- Three fully different mock datasets (one per time range) that switch on tab click
- The canvas-based radar chart implementation
- Animated number counting, bar animations, scroll-triggered section reveals

When building the React version, use the prototype as the **visual and behavioral specification**. The component structure above maps 1:1 with the sections in that file.

---

## Future Features (Nice to Have)

- **Shareable stats card** — Generate a PNG using `html2canvas` that users can post to social media
- **Obscurity score** — Average the `popularity` field across top artists (0–100). Lower = more underground.
- **Listening calendar** — Heatmap of play frequency by day (requires full data export)
- **Dark/light mode toggle**
- **Artist deep-dive modal** — Click an artist card to see their top tracks and related artists
- **Compare with friends** — Share a link, overlay two users' genre profiles

---

## Running Locally

```bash
# Install dependencies
cd server && npm install
cd ../client && npm install

# Start backend (port 3001)
cd server && npm run dev

# Start frontend (port 5173)
cd client && npm run dev

# Visit
open http://localhost:5173
```

---

*Last updated from conversation context — March 2026*
