// ─── AUTH ────────────────────────────────────────────────────────────
// Manages Spotify OAuth tokens in memory (never localStorage for security)

const API_BASE = 'http://127.0.0.1:3001';

const Auth = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null,

  // Redirect user to backend login endpoint → Spotify OAuth
  login() {
    window.location.href = `${API_BASE}/auth/login`;
  },

  // Check URL hash for tokens (returned after OAuth callback)
  handleCallback() {
    const hash = window.location.hash.substring(1);
    if (!hash) return false;

    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const expiresIn = params.get('expires_in');

    if (!accessToken) return false;

    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiresAt = Date.now() + (parseInt(expiresIn, 10) * 1000);

    // Clean the URL so tokens aren't visible
    history.replaceState(null, '', window.location.pathname);
    return true;
  },

  isLoggedIn() {
    return !!this.accessToken;
  },

  // Get a valid access token, refreshing if expired
  async getToken() {
    if (!this.accessToken) return null;

    // Refresh if token expires within 5 minutes
    if (this.expiresAt && Date.now() > this.expiresAt - 300000) {
      await this.refresh();
    }
    return this.accessToken;
  },

  async refresh() {
    if (!this.refreshToken) {
      this.logout();
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });

      if (!res.ok) {
        this.logout();
        return;
      }

      const data = await res.json();
      this.accessToken = data.access_token;
      this.expiresAt = Date.now() + (data.expires_in * 1000);
    } catch {
      this.logout();
    }
  },

  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = null;
    window.location.hash = '';
    window.location.reload();
  },
};
