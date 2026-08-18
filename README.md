# Discord Music Bot

Node.js + discord.js + Docker Compose music bot.

## Supported sources

### YouTube

```text
/play Never Gonna Give You Up
/play https://www.youtube.com/watch?v=...
/play https://youtu.be/...
```

### Spotify

```text
/play https://open.spotify.com/track/...
/play https://open.spotify.com/playlist/...
/play https://open.spotify.com/album/...
```

Spotify URLs are used for metadata. Audio is resolved to a matching YouTube result and played from YouTube; this project does not download or stream Spotify audio.

## Requirements

- Docker
- Docker Compose
- Discord bot application

The current `@discordjs/voice` release requires Node.js 22.12.0 or newer. The image uses Node 22.

## Discord permissions

The existing bot invitation is normally sufficient if the bot has:

- View Channels
- Send Messages
- Embed Links
- Connect
- Speak

The application should also have the `applications.commands` OAuth scope so slash commands can be registered.

You do NOT need to reinvite the bot just because you changed the JavaScript code.

## Setup

Copy:

```bash
cp .env.example .env
```

Edit:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
DISCORD_GUILD_ID=your_test_server_id
MAX_SPOTIFY_TRACKS=100
```

For testing, use your server's ID as `DISCORD_GUILD_ID`.

## Build

```bash
docker compose build --no-cache
```

The image installs:

- Node.js 22
- FFmpeg
- Python 3
- current yt-dlp
- Node dependencies

## Register slash commands

```bash
docker compose run --rm discord-music-bot node src/register-commands.js
```

With `DISCORD_GUILD_ID` set, commands should appear in that server quickly.

## Start

```bash
docker compose up -d
```

Logs:

```bash
docker compose logs -f
```

## Update yt-dlp

Rebuild the image:

```bash
docker compose build --pull
docker compose up -d
```

## Commands

```text
/play <query>
/skip
/stop
/pause
/resume
/queue
/nowplaying
/volume <0-200>
/leave
```

## Architecture

YouTube:

```text
Discord
   ↓
/play
   ↓
YouTube search / URL
   ↓
yt-dlp
   ↓
audio stream
   ↓
FFmpeg
   ↓
@discordjs/voice
   ↓
Discord voice channel
```

Spotify:

```text
Spotify URL
   ↓
spotify-url-info
   ↓
track metadata
   ↓
YouTube search
   ↓
yt-dlp
   ↓
FFmpeg
   ↓
Discord voice
```

## Troubleshooting

### Container exits with "Invalid regular expression flags"

That was caused by an incorrectly escaped regex in an earlier version. This version does not use that regex; YouTube URLs are parsed with `URL`.

### `npm ci` says package-lock.json is missing

This version deliberately uses:

```dockerfile
npm install --omit=dev
```

so a package-lock is not required. Once you want fully reproducible builds, commit a generated `package-lock.json` and change the Dockerfile to `npm ci --omit=dev`.

### Bot joins voice but no audio plays

Check:

```bash
docker compose logs -f
```

and verify:

```bash
docker compose exec discord-music-bot yt-dlp --version
docker compose exec discord-music-bot ffmpeg -version
```

Also make sure the bot has `Connect` and `Speak` permissions in the voice channel.

### Spotify playlist resolution is slow

That is expected: every Spotify track is resolved through a YouTube search before it is added to the queue. The maximum is controlled by:

```env
MAX_SPOTIFY_TRACKS=100
```

For a first test, use a Spotify track URL rather than a large playlist.
