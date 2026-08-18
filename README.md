# Discord Music Bot

> **Note & Disclaimer**
>
> After spending hours searching for a functional YouTube Discord bot and testing several existing GitHub projects without success, I decided to build one myself. This project was developed in a few hours using ChatGPT (Free Plan) to suit the needs of my private Discord server.
>
> **Please note:** I will not be maintaining this repository or troubleshooting problems for others, so **please do not open issues or pull requests**. You are more than welcome to fork, modify, or extend the codebase for your own use.

---

Node.js + `discord.js` + Docker Compose music bot with YouTube and Spotify support.

The bot uses `yt-dlp` for YouTube audio extraction and `@discordjs/voice` for Discord voice playback. Spotify URLs are resolved to matching YouTube tracks; Spotify audio itself is never downloaded or streamed.

---

## Features

- YouTube search
- YouTube URL playback
- Spotify track playback
- Spotify playlist playback
- Spotify album playback
- Spotify → YouTube track resolution
- Per-server playback queue
- Automatic playback of queued tracks
- Skip tracks
- Pause / resume
- Stop and clear queue
- Queue display
- Now playing information
- Volume control
- Voice channel management
- Dockerized deployment
- YouTube JavaScript challenge solving through Node.js
- YouTube PO-token support through `bgutil`

---

## Supported Sources

### YouTube

**Search:**
```text
/play Never Gonna Give You Up
/play ATFC - U Got Me
```

**YouTube URL:**
```text
/play https://www.youtube.com/watch?v=...
```

**Short YouTube URL:**
```text
/play https://youtu.be/...
```

> The bot searches YouTube when a normal text query is provided and selects the best matching result.

---

### Spotify

**Track:**
```text
/play https://open.spotify.com/track/...
```

**Playlist:**
```text
/play https://open.spotify.com/playlist/...
```

**Album:**
```text
/play https://open.spotify.com/album/...
```

> **Note:** Spotify URLs are used for **metadata only**.

**The bot:**
1. Reads the Spotify track metadata.
2. Searches YouTube for a matching track.
3. Resolves the YouTube result with `yt-dlp`.
4. Streams the resulting audio to Discord.

*This project does not download or stream Spotify audio.*

---

## Requirements

- Docker
- Docker Compose
- Discord bot application

> The current `@discordjs/voice` release requires **Node.js 22.12.0 or newer**. The Docker image uses Node.js 22.

### Discord Permissions

The bot should have:
- View Channels
- Send Messages
- Embed Links
- Connect
- Speak

The Discord application should also have the `applications.commands` OAuth scope so slash commands can be registered.

*You do not need to reinvite the bot just because you changed the JavaScript code.*

---

## Project Structure

```text
discord-music-bot/
├── Dockerfile
├── .dockerignore
├── docker-compose.yml
├── package.json
├── package-lock.json
└── src/
    ├── index.js
    ├── music.js
    ├── yt-dlp.js
    ├── spotify.js
    ├── config.js
    └── register-commands.js
```

---

## Environment Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env`:
   ```env
   DISCORD_TOKEN=your_bot_token
   DISCORD_CLIENT_ID=your_application_id
   DISCORD_GUILD_ID=your_test_server_id
   MAX_SPOTIFY_TRACKS=100
   ```

### Configuration Parameters

| Variable | Description |
| :--- | :--- |
| `DISCORD_TOKEN` | Discord bot token |
| `DISCORD_CLIENT_ID` | Discord application/client ID |
| `DISCORD_GUILD_ID` | Optional test server ID for guild command registration |
| `MAX_SPOTIFY_TRACKS` | Maximum number of Spotify tracks resolved from a playlist/album |

> For development and testing, set `DISCORD_GUILD_ID` to your server ID. Guild commands are updated much faster than global commands.
> **Do not commit `.env` to Git.**

---

## Build & Run

### Build
Build the Docker image:
```bash
docker compose build --no-cache
```

**The image contains:**
- Node.js 22
- FFmpeg
- Python 3
- `yt-dlp`
- `yt-dlp` JavaScript challenge support
- `bgutil` YouTube PO-token provider plugin
- Node.js dependencies

*The Docker image runs the bot as the non-root `node` user.*

### Start
Start the services:
```bash
docker compose up -d
```

View logs:
```bash
docker compose logs -f
```

View only the bot logs:
```bash
docker compose logs -f discord-music-bot
```

---

## Register Slash Commands

Register the Discord slash commands:
```bash
docker compose exec discord-music-bot node src/register-commands.js
```

Alternatively, if the bot container is not running:
```bash
docker compose run --rm discord-music-bot node src/register-commands.js
```

> With `DISCORD_GUILD_ID` configured, commands should appear in that server quickly.
> After changing the slash command definitions, run the registration command again.

A bot restart may also be useful after command registration:
```bash
docker compose restart discord-music-bot
```

---

## Commands

### `/play <query>`
**Examples:**
- `/play ATFC - U Got Me`
- `/play https://www.youtube.com/watch?v=...`
- `/play https://open.spotify.com/track/...`
- `/play https://open.spotify.com/playlist/...`

If music is already playing, the new track is added to the queue.

### `/skip`
Skips the currently playing track and starts the next queued track.

### `/stop`
Stops playback and clears the entire queue.

### `/pause`
Pauses the current track.

### `/resume`
Resumes playback.

### `/queue`
Shows:
- Currently playing track
- Upcoming tracks
- Track durations
- Up to 15 queued tracks

If more than 15 tracks are queued, the command indicates how many additional tracks remain.

### `/nowplaying`
Displays information about the currently playing track, including:
- Title
- Source
- Duration
- Thumbnail (when available)

### `/volume <0-200>`
**Examples:**
- `/volume 50`
- `/volume 100`
- `/volume 150`

The default volume is 100%.

### `/leave`
Stops playback, clears the queue, and disconnects the bot from the voice channel.

---

## Queue System

Each Discord server has its own independent player and queue stored in memory.

### Workflow Example

1. `/play ATFC - U Got Me` — Starts playback immediately.
2. While it is playing:
   - `/play Daft Punk - Get Lucky`
   - `/play The Weeknd - Blinding Lights`
   - `/play https://open.spotify.com/track/...`
   
   *(Adds the tracks to the queue)*
3. The bot automatically starts the next track when the current track finishes.

**Queue View Example:**
```text
Now playing:
U Got Me — ATFC

Up next:
1. Get Lucky
2. Blinding Lights
3. Another Song
```

> **Note:** The queue is stored in memory and will be cleared when the bot process is restarted.

---

## YouTube Extraction

The bot uses `yt-dlp` for YouTube extraction with the following configuration:
- **JavaScript runtime:** Node.js
- **YouTube client:** `web_embedded`
- **PO-token provider:** `bgutil`

The `yt-dlp` configuration includes the `bgutil` HTTP provider:
```text
http://bgutil-provider:4416
```
This helps with current YouTube extraction requirements, including PO-token and JavaScript challenge handling.

### Test `yt-dlp` Manually

Check installed versions:
```bash
docker compose exec discord-music-bot yt-dlp --version
docker compose exec discord-music-bot ffmpeg -version
```

Test a YouTube URL:
```bash
docker compose exec discord-music-bot yt-dlp \
  --js-runtimes node \
  --extractor-args "youtube:player_client=web_embedded;youtubepot-bgutilhttp:base_url=http://bgutil-provider:4416" \
  -f "bestaudio/best" \
  "https://www.youtube.com/watch?v=..."
```

### Updating `yt-dlp`

The Dockerfile downloads the current `yt-dlp` release when the image is built.

To update:
```bash
docker compose build --pull
docker compose up -d
```

For a completely fresh build:
```bash
docker compose build --no-cache --pull
docker compose up -d
```

---

## Architecture

### Playback Flows

#### YouTube Search
```text
Discord
   │ /play <search>
   ▼
Discord Bot ──► yt-dlp YouTube search ──► Best matching YouTube result ──► Queue ──► yt-dlp ──► YouTube audio stream ──► @discordjs/voice ──► Discord voice channel
```

#### YouTube URL
```text
Discord
   │ /play <YouTube URL>
   ▼
Discord Bot ──► Queue ──► yt-dlp ──► YouTube audio stream ──► @discordjs/voice ──► Discord voice channel
```

#### Spotify URL
```text
Discord
   │ /play <Spotify URL>
   ▼
Spotify URL metadata ──► Spotify track metadata ──► YouTube search ──► Matching YouTube result ──► Queue ──► yt-dlp ──► YouTube audio stream ──► @discordjs/voice ──► Discord voice channel
```

### Docker Services

The Docker Compose setup contains the music bot and the `bgutil` PO-token provider.

```text
┌─────────────────────────┐
│   discord-music-bot     │
│                         │
│ Node.js                 │
│ discord.js              │
│ @discordjs/voice        │
│ yt-dlp                  │
│ FFmpeg                  │
└────────────┬────────────┘
             │
             │ HTTP :4416
             ▼
┌─────────────────────────┐
│     bgutil-provider     │
│                         │
│ YouTube PO tokens       │
└─────────────────────────┘
```

The bot communicates with the provider using the Docker Compose service name: `http://bgutil-provider:4416`.

---

## Troubleshooting

### "This command is outdated, please try again in a few minutes"
Re-register the slash commands and restart:
```bash
docker compose exec discord-music-bot node src/register-commands.js
docker compose restart discord-music-bot
```
*This can happen after changing slash command definitions while Discord still has an older command interaction cached.*

### Container exits with "Invalid regular expression flags"
This was caused by an incorrectly escaped regular expression in an earlier version. The current version parses YouTube URLs using JavaScript's native `URL` API.

### Bot joins voice but no audio plays
1. Check the bot logs:
   ```bash
   docker compose logs -f discord-music-bot
   ```
2. Verify `yt-dlp` & `ffmpeg`:
   ```bash
   docker compose exec discord-music-bot yt-dlp --version
   docker compose exec discord-music-bot ffmpeg -version
   ```
3. Verify that `bgutil-provider` is running:
   ```bash
   docker compose ps
   ```
4. Make sure the bot has **Connect** and **Speak** permissions in the target voice channel.

### `yt-dlp` returns HTTP 403
Rebuild to get the latest `yt-dlp` release:
```bash
docker compose build --pull
docker compose up -d
```

### Spotify playlist resolution is slow
This is expected. Each Spotify track requires a separate YouTube search. The maximum number of Spotify tracks processed is controlled by `MAX_SPOTIFY_TRACKS` (default: 100).

### Spotify track resolves to the wrong YouTube video
The bot queries YouTube using `<title> <artist> official audio`. The selected video relies on YouTube search ranking algorithms.

### `/queue` is empty after restarting the bot
The queue is stored in-memory per-guild. Restarting the process flushes the active player state and queue.

### `register-commands.js` cannot be found
Application source files are located under `/app/src`. Ensure you execute:
```bash
docker compose exec discord-music-bot node src/register-commands.js
```

---

## Development

Source code directory structure:
```text
src/
├── index.js              # Discord client and slash command handling
├── music.js              # Per-guild players, playback and queue
├── yt-dlp.js             # YouTube search and yt-dlp process handling
├── spotify.js            # Spotify URL detection and metadata extraction
├── config.js             # Environment/configuration handling
└── register-commands.js  # Discord slash command registration
```

### Rebuilding After Source Changes
```bash
docker compose build
docker compose up -d
```

*(Optional) For slash command changes:*
```bash
docker compose exec discord-music-bot node src/register-commands.js
```

---
