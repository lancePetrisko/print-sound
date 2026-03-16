// ─── SPOTIFY API ─────────────────────────────────────────────────────
// Fetches real data from Spotify and transforms it into the shape render() expects

const SPOTIFY_BASE = 'https://api.spotify.com/v1';
const TIME_RANGE_MAP = { short: 'short_term', medium: 'medium_term', long: 'long_term' };
const GENRE_COLORS = ['#1db954', '#f5a623', '#5b9cf6', '#e8445a', '#a78bfa', '#fb923c', '#34d399', '#f472b6'];
const FEATURE_COLORS = {
  energy: '#1db954',
  danceability: '#f5a623',
  valence: '#e8445a',
  acousticness: '#5b9cf6',
  instrumentalness: '#a78bfa',
};

// Cache fetched data per time range so tab switching is instant
const cache = {};

async function spotifyFetch(endpoint) {
  const token = await Auth.getToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${SPOTIFY_BASE}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (res.status === 401) {
    await Auth.refresh();
    const retryToken = await Auth.getToken();
    const retry = await fetch(`${SPOTIFY_BASE}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${retryToken}` },
    });
    if (!retry.ok) throw new Error(`Spotify API error: ${retry.status}`);
    return retry.json();
  }

  if (!res.ok) throw new Error(`Spotify API error: ${res.status}`);
  return res.json();
}

// ─── Fetch user profile ──────────────────────────────────────────────
async function fetchProfile() {
  return spotifyFetch('/me');
}

// ─── Fetch all data for a time range ─────────────────────────────────
async function fetchRangeData(range) {
  if (cache[range]) return cache[range];

  const timeRange = TIME_RANGE_MAP[range];

  // Fetch top tracks, top artists, and recently played in parallel
  const [topTracksRes, topArtistsRes, recentRes] = await Promise.all([
    spotifyFetch(`/me/top/tracks?time_range=${timeRange}&limit=50`),
    spotifyFetch(`/me/top/artists?time_range=${timeRange}&limit=50`),
    spotifyFetch('/me/player/recently-played?limit=50'),
  ]);

  const topTracks = topTracksRes.items || [];
  const topArtists = topArtistsRes.items || [];
  const recentItems = recentRes.items || [];

  // Try to fetch audio features (may fail for newer Spotify apps)
  let audioProfile = null;
  try {
    if (topTracks.length > 0) {
      const ids = topTracks.map(t => t.id).join(',');
      const afRes = await spotifyFetch(`/audio-features?ids=${ids}`);
      const features = (afRes.audio_features || []).filter(Boolean);
      if (features.length > 0) {
        audioProfile = averageFeatures(features);
      }
    }
  } catch {
    // Audio features endpoint may be unavailable — gracefully continue
  }

  const data = transformData(topTracks, topArtists, recentItems, audioProfile);
  cache[range] = data;
  return data;
}

// ─── Transform raw Spotify data into the shape render() expects ──────
function transformData(topTracks, topArtists, recentItems, audioProfile) {
  // Format duration from ms → "m:ss"
  function fmtDuration(ms) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Get album art URL (300px) or fallback
  function getImage(images) {
    if (!images || images.length === 0) return null;
    return (images[1] || images[0]).url;
  }

  // Top tracks (first 10 for display)
  const tracks = topTracks.slice(0, 10).map(t => ({
    name: t.name,
    artist: t.artists.map(a => a.name).join(', '),
    duration: fmtDuration(t.duration_ms),
    pop: (t.popularity || 50) / 100,
    image: getImage(t.album?.images),
  }));

  // Top artists (first 8 for display)
  const artists = topArtists.slice(0, 8).map((a, i) => ({
    name: a.name,
    genre: a.genres.length > 0 ? a.genres[0] : 'Unknown',
    rank: `#${i + 1}`,
    image: getImage(a.images),
  }));

  // Genre aggregation from all artists
  const genreCounts = {};
  topArtists.forEach(a => {
    a.genres.forEach(g => {
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    });
  });
  const totalGenreHits = Object.values(genreCounts).reduce((a, b) => a + b, 0) || 1;
  const genres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count], i) => ({
      name,
      pct: Math.round((count / totalGenreHits) * 100),
      color: GENRE_COLORS[i % GENRE_COLORS.length],
    }));

  // Audio features
  let audioFeatures = [];
  let radar = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  let vibeId = 'Music Lover';
  let vibeDesc = 'Your listening spans a wide range of moods and styles.';

  if (audioProfile) {
    audioFeatures = [
      { label: 'Energy', val: audioProfile.energy, color: FEATURE_COLORS.energy },
      { label: 'Danceability', val: audioProfile.danceability, color: FEATURE_COLORS.danceability },
      { label: 'Valence', val: audioProfile.valence, color: FEATURE_COLORS.valence },
      { label: 'Acousticness', val: audioProfile.acousticness, color: FEATURE_COLORS.acousticness },
      { label: 'Instrumental', val: audioProfile.instrumentalness, color: FEATURE_COLORS.instrumentalness },
    ];

    // Normalize loudness from dB range (~-60 to 0) to 0-1
    const loudnessNorm = Math.min(1, Math.max(0, (audioProfile.loudness + 60) / 60));
    radar = [
      audioProfile.energy,
      audioProfile.danceability,
      audioProfile.valence,
      audioProfile.acousticness,
      audioProfile.instrumentalness,
      loudnessNorm,
    ];

    const vibe = getVibeIdentity(audioProfile);
    vibeId = vibe.id;
    vibeDesc = vibe.desc;
  }

  // Estimated listening hours from recently played
  const totalMs = recentItems.reduce((sum, item) => sum + (item.track?.duration_ms || 0), 0);
  const recentHours = Math.round(totalMs / 3600000 * 10) / 10;

  // Day streak — count consecutive days in recently played history
  const streak = calcStreak(recentItems);

  // Recently played cards
  const recent = recentItems.slice(0, 8).map(item => ({
    name: item.track.name,
    artist: item.track.artists.map(a => a.name).join(', '),
    time: relativeTime(item.played_at),
    image: getImage(item.track.album?.images),
  }));

  return {
    vibeId,
    vibeDesc,
    hours: recentHours,
    tracks: topTracks.length,
    artists: topArtists.length,
    streak,
    audioFeatures,
    tracks_list: tracks,
    artists_list: artists,
    genres,
    radar,
    recent,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function averageFeatures(features) {
  const keys = ['energy', 'danceability', 'valence', 'acousticness', 'instrumentalness', 'loudness'];
  const profile = {};
  keys.forEach(key => {
    const vals = features.map(f => f[key]).filter(v => v !== undefined && v !== null);
    profile[key] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });
  return profile;
}

function getVibeIdentity(profile) {
  if (profile.energy > 0.75 && profile.valence < 0.5)
    return { id: 'Late Night Explorer', desc: 'High energy, emotionally complex music with a taste for deep cuts. You discover artists before they\'re mainstream and return to albums obsessively.' };
  if (profile.danceability > 0.7 && profile.energy > 0.65)
    return { id: 'Main Character Energy', desc: 'Your playlist is a movie soundtrack and you\'re the lead. Dance-heavy, confident, and always ready for the moment.' };
  if (profile.acousticness > 0.5 && profile.energy < 0.5)
    return { id: 'Quiet Storm', desc: 'You find beauty in stripped-back, intimate sounds. Acoustic warmth and lyrical depth are your comfort zone.' };
  if (profile.instrumentalness > 0.4)
    return { id: 'The Thinker', desc: 'Words take a backseat — you prefer music that fills a room without demanding attention. Deep focus and ambient textures are your world.' };
  if (profile.valence > 0.7)
    return { id: 'Sunshine Syndicate', desc: 'Your music radiates warmth and positivity. Feel-good anthems and bright melodies are your signature.' };
  if (profile.energy > 0.7)
    return { id: 'Adrenaline Architect', desc: 'You crave intensity. Your top tracks hit hard, move fast, and rarely let up.' };
  if (profile.danceability > 0.65)
    return { id: 'Groove Operator', desc: 'Rhythm drives everything for you. You gravitate toward tracks with an irresistible pulse.' };
  if (profile.valence < 0.35)
    return { id: 'Melancholy Connoisseur', desc: 'You don\'t shy from heavy emotions. Your music digs deep — reflective, moody, and deeply personal.' };
  return { id: 'Eclectic Archivist', desc: 'You cycle through phases — indie one week, rap the next. Your library is vast and your taste is genuinely hard to pin down.' };
}

function relativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function calcStreak(recentItems) {
  if (recentItems.length === 0) return 0;

  const days = new Set();
  recentItems.forEach(item => {
    const d = new Date(item.played_at);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  });

  const sortedDays = [...days].sort().reverse();
  let streak = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    const curr = new Date(sortedDays[i]);
    const diffDays = Math.round((prev - curr) / 86400000);
    if (diffDays === 1) streak++;
    else break;
  }
  return streak;
}
