const express = require('express');
const router = express.Router();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:3001';
const SCOPES = 'user-top-read user-read-recently-played user-library-read user-read-private';

// Step 1: Redirect user to Spotify authorization
router.get('/login', (_req, res) => {
  const state = Math.random().toString(36).substring(2, 15);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state,
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

// Step 2: Spotify redirects here with auth code — exchange for tokens
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`${FRONTEND_URL}?error=${encodeURIComponent(error)}`);
  }

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Token exchange failed:', err);
      return res.redirect(`${FRONTEND_URL}?error=token_exchange_failed`);
    }

    const data = await tokenRes.json();

    // Redirect to frontend with tokens as hash params (not in URL query — keeps them out of server logs)
    const params = new URLSearchParams({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    });
    res.redirect(`${FRONTEND_URL}/#${params.toString()}`);
  } catch (err) {
    console.error('Auth callback error:', err);
    res.redirect(`${FRONTEND_URL}?error=server_error`);
  }
});

// Step 3: Refresh an expired access token
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'refresh_token required' });
  }

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Token refresh failed:', err);
      return res.status(tokenRes.status).json({ error: 'refresh_failed' });
    }

    const data = await tokenRes.json();
    res.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
    });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
