let currentRange = 'short';
let isLive = false; // true when using real Spotify data

// ─── INIT ────────────────────────────────────────────────────────────
(async function init() {
  // Check if returning from OAuth callback
  Auth.handleCallback();

  if (Auth.isLoggedIn()) {
    showDashboard();
    await loadLiveData('short');
  } else {
    showLogin();
    // Still render mock data behind the login overlay for visual appeal
    render(DATA.short);
  }

  // Set up intersection observer for scroll animations
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.section').forEach(s => obs.observe(s));
})();

// ─── VIEW SWITCHING ──────────────────────────────────────────────────
function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('dashboard').style.opacity = '0.15';
  document.getElementById('dashboard').style.pointerEvents = 'none';
  document.getElementById('dashboard').style.filter = 'blur(6px)';
}

function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.opacity = '1';
  document.getElementById('dashboard').style.pointerEvents = 'auto';
  document.getElementById('dashboard').style.filter = 'none';
  document.getElementById('logout-btn').style.display = 'inline-block';
  document.getElementById('footer-connect').style.display = 'none';
}

function showLoading(show) {
  document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

// ─── TIME RANGE SWITCHING ────────────────────────────────────────────
async function setRange(btn, range) {
  document.querySelectorAll('.time-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  currentRange = range;

  if (isLive) {
    await loadLiveData(range);
  } else {
    render(DATA[range]);
  }
}

// ─── LOAD REAL SPOTIFY DATA ─────────────────────────────────────────
async function loadLiveData(range) {
  showLoading(true);
  try {
    // Fetch profile on first load
    if (!isLive) {
      const profile = await fetchProfile();
      const name = profile.display_name || 'You';
      const parts = name.split(' ');
      const heroName = document.querySelector('.hero-name');
      if (parts.length > 1) {
        heroName.innerHTML = `${parts[0]}<em>${parts.slice(1).join(' ')}</em>`;
      } else {
        heroName.innerHTML = `${name}<em>&nbsp;</em>`;
      }
    }

    isLive = true;
    const data = await fetchRangeData(range);
    renderLive(data, range);
  } catch (err) {
    console.error('Failed to load Spotify data:', err);
    // Fall back to mock data on error
    render(DATA[range]);
  } finally {
    showLoading(false);
  }
}

// ─── RENDER LIVE DATA ────────────────────────────────────────────────
// Uses the transformed shape from spotify.js
function renderLive(d, range) {
  // hero stats — show range-meaningful numbers
  animateNum('hours-val', d.hours);
  animateNum('tracks-val', d.tracks_list.length);
  animateNum('artists-val', d.uniqueArtists);
  animateNum('streak-val', d.streak);

  // vibe — always populated now (genre-based fallback when audio features unavailable)
  document.getElementById('vibe-id').textContent = d.vibeId;
  document.getElementById('vibe-desc').textContent = d.vibeDesc;

  // label
  const labels = { short: 'Last 4 Weeks', medium: 'Last 6 Months', long: 'All Time' };
  document.getElementById('tracks-label').textContent = labels[range];

  // audio features — show bars even from genre-estimated data
  const afEl = document.getElementById('af-list');
  if (d.audioFeatures.length > 0) {
    afEl.innerHTML = d.audioFeatures.map(f => `
      <div class="af-row">
        <span class="af-label">${f.label}</span>
        <div class="af-track"><div class="af-fill" style="width:${f.val*100}%; background:${f.color}; animation-delay:${Math.random()*0.4}s"></div></div>
        <span class="af-val">${Math.round(f.val*100)}%</span>
      </div>
    `).join('');
  } else {
    // Build feature bars from the radar estimates (genre-based)
    const radarLabels = ['Energy', 'Danceability', 'Valence', 'Acousticness', 'Instrumental'];
    const radarColors = ['#1db954', '#f5a623', '#e8445a', '#5b9cf6', '#a78bfa'];
    afEl.innerHTML = d.radar.slice(0, 5).map((val, i) => `
      <div class="af-row">
        <span class="af-label">${radarLabels[i]}</span>
        <div class="af-track"><div class="af-fill" style="width:${val*100}%; background:${radarColors[i]}; animation-delay:${i*0.1}s"></div></div>
        <span class="af-val">${Math.round(val*100)}%</span>
      </div>
    `).join('');
  }

  // tracks — uses real album art images
  const tracksList = document.getElementById('tracks-list');
  tracksList.innerHTML = d.tracks_list.map((t, i) => `
    <div class="track-row" style="animation-delay:${i*0.05}s">
      <span class="track-num">${i+1}</span>
      <span class="track-play">▶</span>
      ${t.image
        ? `<img class="track-art" src="${t.image}" alt="${t.name}" />`
        : `<div class="track-art">🎵</div>`}
      <div class="track-info">
        <div class="track-name">${t.name}</div>
        <div class="track-artist">${t.artist}</div>
      </div>
      <div class="track-pop"><div class="track-pop-fill" style="width:${t.pop*100}%"></div></div>
      <span class="track-duration">${t.duration}</span>
    </div>
  `).join('');

  // artists — uses real artist photos
  const artistsGrid = document.getElementById('artists-grid');
  artistsGrid.innerHTML = d.artists_list.map((a, i) => `
    <div class="artist-card" style="animation-delay:${i*0.06}s">
      ${a.image
        ? `<img class="artist-avatar" src="${a.image}" alt="${a.name}" style="object-fit:cover;" />`
        : `<div class="artist-avatar">🎤</div>`}
      <div class="artist-name">${a.name}</div>
      <div class="artist-rank">${a.rank}</div>
      ${a.genre ? `<div class="artist-genre">${a.genre}</div>` : ''}
    </div>
  `).join('');

  // genres
  const genreList = document.getElementById('genre-list');
  if (d.genres.length === 0) {
    genreList.innerHTML = '<p style="color:rgba(255,255,255,0.4); font-size:0.9rem; padding:1rem 0;">Genre data not available for your top artists.</p>';
  } else {
    genreList.innerHTML = d.genres.map((g, i) => `
      <div class="genre-row" style="animation-delay:${i*0.08}s">
        <span class="genre-name">${g.name}</span>
        <div class="genre-bar-track">
          <div class="genre-bar-fill" style="width:${g.pct}%; background:${g.color}; animation-delay:${i*0.1}s"></div>
        </div>
        <span class="genre-pct">${g.pct}%</span>
      </div>
    `).join('');
  }

  // recent — uses real album art
  const recentGrid = document.getElementById('recent-grid');
  recentGrid.innerHTML = d.recent.map((r, i) => `
    <div class="recent-card" style="animation-delay:${i*0.04}s">
      ${r.image
        ? `<img class="recent-art" src="${r.image}" alt="${r.name}" style="object-fit:cover;" />`
        : `<div class="recent-art">🎵</div>`}
      <div class="recent-info">
        <div class="recent-name">${r.name}</div>
        <div class="recent-artist">${r.artist}</div>
        <div class="recent-time">${r.time}</div>
      </div>
    </div>
  `).join('');

  drawRadar(d.radar);
}

// ─── RENDER MOCK DATA (fallback / pre-login) ─────────────────────────
function render(d) {
  // hero stats
  animateNum('hours-val', d.hours, d.hours > 999 ? d.hours.toLocaleString() : null);
  animateNum('tracks-val', d.tracks, d.tracks > 999 ? d.tracks.toLocaleString() : null);
  animateNum('artists-val', d.artists, d.artists > 999 ? d.artists.toLocaleString() : null);

  // vibe
  document.getElementById('vibe-id').textContent = d.vibeId;
  document.getElementById('vibe-desc').textContent = d.vibeDesc;

  // label
  const labels = { short: 'Last 4 Weeks', medium: 'Last 6 Months', long: 'All Time' };
  document.getElementById('tracks-label').textContent = labels[currentRange];

  // audio features
  const afEl = document.getElementById('af-list');
  afEl.innerHTML = d.audioFeatures.map(f => `
    <div class="af-row">
      <span class="af-label">${f.label}</span>
      <div class="af-track"><div class="af-fill" style="width:${f.val*100}%; background:${f.color}; animation-delay:${Math.random()*0.4}s"></div></div>
      <span class="af-val">${Math.round(f.val*100)}%</span>
    </div>
  `).join('');

  // tracks
  const tracksList = document.getElementById('tracks-list');
  tracksList.innerHTML = d.tracks.map((t, i) => `
    <div class="track-row" style="animation-delay:${i*0.05}s">
      <span class="track-num">${i+1}</span>
      <span class="track-play">▶</span>
      <div class="track-art">${t.emoji}</div>
      <div class="track-info">
        <div class="track-name">${t.name}</div>
        <div class="track-artist">${t.artist}</div>
      </div>
      <div class="track-pop"><div class="track-pop-fill" style="width:${t.pop*100}%"></div></div>
      <span class="track-duration">${t.duration}</span>
    </div>
  `).join('');

  // artists
  const artistsGrid = document.getElementById('artists-grid');
  artistsGrid.innerHTML = d.artists.map((a, i) => `
    <div class="artist-card" style="animation-delay:${i*0.06}s">
      <div class="artist-avatar">${a.emoji}</div>
      <div class="artist-name">${a.name}</div>
      <div class="artist-rank">${a.rank}</div>
      <div class="artist-genre">${a.genre}</div>
    </div>
  `).join('');

  // genres
  const genreList = document.getElementById('genre-list');
  genreList.innerHTML = d.genres.map((g, i) => `
    <div class="genre-row" style="animation-delay:${i*0.08}s">
      <span class="genre-name">${g.name}</span>
      <div class="genre-bar-track">
        <div class="genre-bar-fill" style="width:${g.pct}%; background:${g.color}; animation-delay:${i*0.1}s"></div>
      </div>
      <span class="genre-pct">${g.pct}%</span>
    </div>
  `).join('');

  // recent
  const recentGrid = document.getElementById('recent-grid');
  recentGrid.innerHTML = d.recent.map((r, i) => `
    <div class="recent-card" style="animation-delay:${i*0.04}s">
      <div class="recent-art">${r.emoji}</div>
      <div class="recent-info">
        <div class="recent-name">${r.name}</div>
        <div class="recent-artist">${r.artist}</div>
        <div class="recent-time">${r.time}</div>
      </div>
    </div>
  `).join('');

  drawRadar(d.radar);
}

// ─── ANIMATE NUMBERS ─────────────────────────────────────────────────
function animateNum(id, target, formatted) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = 0;
  const dur = 900;
  const startTime = performance.now();
  function step(now) {
    const progress = Math.min((now - startTime) / dur, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * ease);
    el.textContent = current >= 1000 ? current.toLocaleString() : current;
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = formatted || (target >= 1000 ? target.toLocaleString() : target);
  }
  requestAnimationFrame(step);
}
