const fetch = require("isomorphic-unfetch");
const spotify = require("spotify-url-info")(fetch);

function isSpotifyUrl(input) {
  try {
    const url = new URL(input);
    return (
      url.hostname === "open.spotify.com" ||
      url.hostname === "play.spotify.com" ||
      url.hostname === "spotify.link"
    );
  } catch {
    return false;
  }
}

function normalizeTrack(track) {
  if (!track) return null;

  const title =
    track.title ||
    track.name ||
    track.track ||
    track.track_name;

  if (!title) return null;

  let artist = "";

  if (Array.isArray(track.artist)) {
    artist = track.artist
      .map((a) => (typeof a === "string" ? a : a?.name))
      .filter(Boolean)
      .join(", ");
  } else if (typeof track.artist === "string") {
    artist = track.artist;
  } else if (track.artists && Array.isArray(track.artists)) {
    artist = track.artists
      .map((a) => (typeof a === "string" ? a : a?.name))
      .filter(Boolean)
      .join(", ");
  }

  return {
    title,
    artist,
    query: `${title} ${artist}`.trim(),
    spotifyUrl:
      track.link ||
      track.external_urls?.spotify ||
      track.href ||
      null,
  };
}

async function spotifyToTracks(url, maxTracks = 100) {
  let tracks;

  try {
    tracks = await spotify.getTracks(url);
  } catch (error) {
    throw new Error(`Could not read Spotify URL: ${error.message}`);
  }

  if (!Array.isArray(tracks) || tracks.length === 0) {
    // A track URL may not be returned by getTracks on every metadata path.
    const data = await spotify.getData(url);
    const one = normalizeTrack(data);
    tracks = one ? [one] : [];
  }

  const normalized = tracks
    .map(normalizeTrack)
    .filter(Boolean)
    .slice(0, maxTracks);

  if (!normalized.length) {
    throw new Error(
      "No playable track metadata could be read from that Spotify URL."
    );
  }

  return normalized;
}

module.exports = {
  isSpotifyUrl,
  spotifyToTracks,
};
