const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const maxSpotifyTracks = Number.parseInt(
  process.env.MAX_SPOTIFY_TRACKS || "100",
  10
);

module.exports = {
  token: required("DISCORD_TOKEN"),
  clientId: required("DISCORD_CLIENT_ID"),
  guildId: process.env.DISCORD_GUILD_ID?.trim() || "",
  maxSpotifyTracks:
    Number.isFinite(maxSpotifyTracks) && maxSpotifyTracks > 0
      ? Math.min(maxSpotifyTracks, 100)
      : 100,
};
