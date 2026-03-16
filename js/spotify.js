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
// Recently played is not range-specific — cache it globally
let recentCache = null;

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

// ─── Fetch recently played (once, not per range) ────────────────────
async function fetchRecentlyPlayed() {
  if (recentCache) return recentCache;
  const res = await spotifyFetch('/me/player/recently-played?limit=50');
  recentCache = res.items || [];
  return recentCache;
}

// ─── Fetch all data for a time range ─────────────────────────────────
async function fetchRangeData(range) {
  if (cache[range]) return cache[range];

  const timeRange = TIME_RANGE_MAP[range];

  // Fetch top tracks, top artists, and recently played in parallel
  const [topTracksRes, topArtistsRes, recentItems] = await Promise.all([
    spotifyFetch(`/me/top/tracks?time_range=${timeRange}&limit=50`),
    spotifyFetch(`/me/top/artists?time_range=${timeRange}&limit=50`),
    fetchRecentlyPlayed(),
  ]);

  const topTracks = topTracksRes.items || [];
  const topArtists = topArtistsRes.items || [];

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

  // ─── Stat pills (range-meaningful) ──────────────────────────────────

  // Count unique artists across top tracks for this range
  const uniqueArtistIds = new Set();
  topTracks.forEach(t => {
    (t.artists || []).forEach(a => uniqueArtistIds.add(a.id));
  });

  // Average popularity of top tracks (varies per range, 0-100)
  const avgPop = topTracks.length > 0
    ? Math.round(topTracks.reduce((sum, t) => sum + (t.popularity || 0), 0) / topTracks.length)
    : 0;

  // Estimated listening hours from recently played (same across ranges)
  const totalMs = recentItems.reduce((sum, item) => sum + (item.track?.duration_ms || 0), 0);
  const recentHours = Math.round(totalMs / 3600000 * 10) / 10;

  // Day streak from recently played (same across ranges)
  const streak = calcStreak(recentItems);

  // ─── Top tracks (first 10 for display) ──────────────────────────────
  const tracks = topTracks.slice(0, 10).map(t => ({
    name: t.name,
    artist: (t.artists || []).map(a => a.name).join(', '),
    duration: fmtDuration(t.duration_ms),
    pop: (t.popularity || 50) / 100,
    image: getImage(t.album?.images),
  }));

  // ─── Top artists (first 8 for display) ──────────────────────────────
  const artists = topArtists.slice(0, 8).map((a, i) => ({
    name: a.name,
    genre: (a.genres && a.genres.length > 0) ? a.genres[0] : '',
    rank: `#${i + 1}`,
    image: getImage(a.images),
  }));

  // ─── Genre aggregation from all artists ─────────────────────────────
  const genreCounts = {};
  topArtists.forEach(a => {
    (a.genres || []).forEach(g => {
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    });
  });

  // Also pull genres from top tracks' artists as a supplement
  // (track objects include basic artist info but not genres, so we use
  // the topArtists data which does include genres)

  const totalGenreHits = Object.values(genreCounts).reduce((a, b) => a + b, 0) || 1;
  const genres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count], i) => ({
      name: capitalizeGenre(name),
      pct: Math.round((count / totalGenreHits) * 100),
      color: GENRE_COLORS[i % GENRE_COLORS.length],
    }));

  // ─── Audio features / Vibe ──────────────────────────────────────────
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
  } else {
    // Generate a vibe from genre data when audio features are unavailable
    const vibeFromGenres = getVibeFromGenres(genres, avgPop);
    vibeId = vibeFromGenres.id;
    vibeDesc = vibeFromGenres.desc;

    // Build a rough radar from genre associations
    radar = estimateRadarFromGenres(genres);
  }

  // ─── Recently played cards ──────────────────────────────────────────
  const recent = recentItems.slice(0, 8).map(item => ({
    name: item.track.name,
    artist: (item.track.artists || []).map(a => a.name).join(', '),
    time: relativeTime(item.played_at),
    image: getImage(item.track.album?.images),
  }));

  return {
    vibeId,
    vibeDesc,
    hours: recentHours,
    uniqueArtists: uniqueArtistIds.size,
    avgPopularity: avgPop,
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

// Capitalize genre names nicely: "cloud rap" → "Cloud Rap"
function capitalizeGenre(name) {
  return name.replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Vibe from genres (fallback when audio features are blocked) ─────
function getVibeFromGenres(genres, avgPop) {
  if (genres.length === 0) {
    return { id: 'The Enigma', desc: 'Your taste is so unique that even Spotify can\'t categorize it. You listen on your own terms.' };
  }

  const topGenreNames = genres.map(g => g.name.toLowerCase());
  const allGenres = topGenreNames.join(' ');

  if (allGenres.match(/rap|hip.?hop|trap/))
    return { id: 'Bars & Beats', desc: 'Hip-hop runs through your veins. From underground flows to mainstream anthems, you live for the rhythm and the wordplay.' };
  if (allGenres.match(/rock|metal|punk|grunge/))
    return { id: 'Voltage', desc: 'Guitars, distortion, and raw energy. You\'re drawn to music that hits hard and doesn\'t apologize.' };
  if (allGenres.match(/r&b|soul|neo.?soul/))
    return { id: 'Velvet Ears', desc: 'Smooth, soulful, and emotionally rich. Your playlist is a mood — late nights, warm tones, and deep feelings.' };
  if (allGenres.match(/pop/))
    return { id: 'Main Character Energy', desc: 'Your playlist is a movie soundtrack and you\'re the lead. Catchy hooks, big choruses, and always ready for the moment.' };
  if (allGenres.match(/electro|edm|house|techno|dance/))
    return { id: 'Signal & Noise', desc: 'Synthesizers and drops are your language. You thrive where beats are engineered and the bass shakes the floor.' };
  if (allGenres.match(/indie|alt/))
    return { id: 'Off The Radar', desc: 'You don\'t follow trends — you set them. Indie sensibilities and a ear for the unconventional define your sound.' };
  if (allGenres.match(/country|folk|americana/))
    return { id: 'Open Road', desc: 'Stories, strings, and wide-open spaces. Your music carries the weight of real life and real emotion.' };
  if (allGenres.match(/jazz|blues/))
    return { id: 'The Connoisseur', desc: 'Improvisation and groove speak to you. You appreciate the craft, the swing, and the soul behind every note.' };
  if (allGenres.match(/classical|orchestr/))
    return { id: 'The Composer\'s Ear', desc: 'You hear layers where others hear noise. Orchestral depth and compositional mastery are your comfort zone.' };
  if (allGenres.match(/latin|reggaeton|salsa|bachata/))
    return { id: 'Fuego', desc: 'Rhythm is everything. Latin beats, infectious energy, and music that makes it impossible to stand still.' };

  if (avgPop < 40)
    return { id: 'Underground Architect', desc: 'Your artists don\'t chart — yet. You find music before the world catches on, digging deep where algorithms don\'t reach.' };

  return { id: 'Eclectic Archivist', desc: 'You cycle through phases — one genre this week, another the next. Your library is vast and your taste is genuinely hard to pin down.' };
}

// ─── Estimate radar values from genre names (rough approximation) ────
function estimateRadarFromGenres(genres) {
  // Default middle values
  let energy = 0.5, dance = 0.5, valence = 0.5, acoustic = 0.3, instrumental = 0.2, loudness = 0.5;

  const allGenres = genres.map(g => g.name.toLowerCase()).join(' ');

  if (allGenres.match(/rap|hip.?hop|trap/)) { energy = 0.75; dance = 0.7; valence = 0.45; loudness = 0.7; }
  if (allGenres.match(/rock|metal|punk/)) { energy = 0.85; dance = 0.4; valence = 0.4; loudness = 0.85; }
  if (allGenres.match(/pop/)) { energy = 0.65; dance = 0.7; valence = 0.65; loudness = 0.6; }
  if (allGenres.match(/r&b|soul/)) { energy = 0.5; dance = 0.65; valence = 0.5; acoustic = 0.4; }
  if (allGenres.match(/electro|edm|house|techno/)) { energy = 0.85; dance = 0.85; valence = 0.55; loudness = 0.8; instrumental = 0.4; }
  if (allGenres.match(/indie|alt/)) { energy = 0.55; dance = 0.5; valence = 0.45; acoustic = 0.4; }
  if (allGenres.match(/acoustic|folk|country/)) { energy = 0.4; dance = 0.45; valence = 0.55; acoustic = 0.75; }
  if (allGenres.match(/jazz|blues/)) { energy = 0.45; dance = 0.55; valence = 0.5; acoustic = 0.6; instrumental = 0.5; }
  if (allGenres.match(/classical|orchestr/)) { energy = 0.35; dance = 0.25; valence = 0.4; acoustic = 0.8; instrumental = 0.8; }
  if (allGenres.match(/cloud|lo.?fi|chill/)) { energy = 0.4; dance = 0.5; valence = 0.4; acoustic = 0.3; instrumental = 0.3; }

  return [energy, dance, valence, acoustic, instrumental, loudness];
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
