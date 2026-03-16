let currentRange = 'short';

function setRange(btn, range) {
  document.querySelectorAll('.time-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  currentRange = range;
  render(range);
}

function render(range) {
  const d = DATA[range];

  // hero stats
  animateNum('hours-val', d.hours, d.hours > 999 ? d.hours.toLocaleString() : null);
  animateNum('tracks-val', d.tracks, d.tracks > 999 ? d.tracks.toLocaleString() : null);
  animateNum('artists-val', d.artists, d.artists > 999 ? d.artists.toLocaleString() : null);

  // vibe
  document.getElementById('vibe-id').textContent = d.vibeId;
  document.getElementById('vibe-desc').textContent = d.vibeDesc;

  // label
  const labels = { short: 'Last 4 Weeks', medium: 'Last 6 Months', long: 'All Time' };
  document.getElementById('tracks-label').textContent = labels[range];

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

function animateNum(id, target, formatted) {
  const el = document.getElementById(id);
  const start = 0;
  const dur = 900;
  const startTime = performance.now();
  function step(now) {
    const progress = Math.min((now - startTime) / dur, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * ease);
    el.textContent = current >= 1000 ? current.toLocaleString() : current;
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = formatted || target;
  }
  requestAnimationFrame(step);
}

// ─── INTERSECTION OBSERVER ──────────────────────────────────────────
const obs = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1 });

document.querySelectorAll('.section').forEach(s => obs.observe(s));

// Init
render('short');
