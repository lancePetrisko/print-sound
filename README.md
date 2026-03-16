# PrintSound

Your Spotify listening identity — top tracks, artists, genres, audio personality, and more. Like Spotify Wrapped, but available anytime.

## Prerequisites

- **Node.js** — install with `brew install node` (macOS) or from [nodejs.org](https://nodejs.org)
- **Spotify Developer Account** — create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)

## Spotify App Setup

1. Go to your [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app (or use an existing one)
3. In app settings, add this as a **Redirect URI**:
   ```
   http://127.0.0.1:3001/auth/callback
   ```
   > Spotify does NOT allow `localhost` — you must use `127.0.0.1`
4. Note your **Client ID** and **Client Secret**

## Getting Started

```bash
# Install server dependencies
cd server
npm install

# Create your environment file
cp .env.example .env
```

Edit `server/.env` with your real credentials:
```
SPOTIFY_CLIENT_ID=your_actual_client_id
SPOTIFY_CLIENT_SECRET=your_actual_client_secret
REDIRECT_URI=http://127.0.0.1:3001/auth/callback
FRONTEND_URL=http://127.0.0.1:3001
PORT=3001
```

Start the server:
```bash
npm run dev
```

Open [http://127.0.0.1:3001](http://127.0.0.1:3001) in your browser.

## How It Works

- The Express server handles Spotify OAuth (token exchange + refresh) and serves the frontend
- After login, the frontend calls the Spotify API directly with the access token
- Data is cached per time range so switching tabs is instant
- If not logged in, mock data is shown behind a blurred login overlay

## Project Layout

```
print-sound/
├── css/              # Component CSS files (header, hero, tracks, artists, etc.)
├── js/
│   ├── auth.js       # OAuth token management
│   ├── spotify.js    # Spotify API calls + data transformation
│   ├── app.js        # Initialization, rendering, animations
│   ├── data.js       # Mock data (pre-login fallback)
│   └── radar.js      # Canvas radar chart
├── server/
│   ├── routes/auth.js  # OAuth endpoints
│   ├── index.js        # Express server
│   ├── .env            # Your secrets (git-ignored)
│   └── .env.example    # Template (safe to commit)
└── spotify-stats.html  # Main page
```

## Security Notes

- `server/.env` is git-ignored — your secrets are never committed
- Only `.env.example` (with placeholder values) goes to GitHub
- Access tokens are stored in JS memory, not localStorage
- Client secret never touches the frontend — token exchange is server-side only

## Development Mode Limitation

New Spotify apps start in **Development Mode**, limited to **25 users**. Only users you explicitly add in the Spotify Dashboard can log in. To remove this limit, apply for **Extended Quota Mode** in the dashboard.

## Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript (no build step)
- **Backend:** Node.js + Express
- **API:** Spotify Web API (OAuth 2.0 Authorization Code Flow)
