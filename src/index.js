require("dotenv").config();

const {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
} = require("discord.js");

const {
  token,
  maxSpotifyTracks,
} = require("./config");

const {
  destroyPlayer,
  getPlayer,
} = require("./music");

const {
  isSpotifyUrl,
  spotifyToTracks,
} = require("./spotify");

const {
  searchYouTube,
} = require("./yt-dlp");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

function getVoiceChannel(interaction) {
  const channel = interaction.member?.voice?.channel;

  if (!channel) {
    throw new Error("Join a voice channel first.");
  }

  return channel;
}

function isYouTubeUrl(input) {
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();

    return (
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be" ||
      host === "www.youtu.be"
    );
  } catch {
    return false;
  }
}

function formatDuration(seconds) {
  if (!seconds) {
    return "?:??";
  }

  const total = Math.floor(seconds);

  const hours = Math.floor(total / 3600);

  const minutes = Math.floor(
    (total % 3600) / 60
  );

  const secs = total % 60;

  if (hours) {
    return `${hours}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(secs).padStart(2, "0")}`;
  }

  return `${minutes}:${String(secs).padStart(
    2,
    "0"
  )}`;
}

function formatTrack(track) {
  if (!track) {
    return "Unknown track";
  }

  const duration = track.duration
    ? ` \`${formatDuration(track.duration)}\``
    : "";

  return `${track.title}${duration}`;
}

client.once(
  Events.ClientReady,
  (readyClient) => {
    console.log(
      `Logged in as ${readyClient.user.tag}`
    );

    readyClient.user.setActivity("/play", {
      type: 2,
    });
  }
);

client.on(
  Events.InteractionCreate,
  async (interaction) => {
    if (
      !interaction.isChatInputCommand() ||
      !interaction.guild
    ) {
      return;
    }

    try {
      const player = getPlayer(
        interaction.guild
      );

      switch (interaction.commandName) {
        // --------------------------------------------------
        // PLAY
        // --------------------------------------------------

        case "play": {
          const query =
            interaction.options.getString(
              "query",
              true
            );

          const voiceChannel =
            getVoiceChannel(interaction);

          await interaction.deferReply();

          await player.connect(
            voiceChannel
          );

          // Spotify
          if (isSpotifyUrl(query)) {
            const spotifyTracks =
              await spotifyToTracks(
                query,
                maxSpotifyTracks
              );

            await interaction.editReply(
              `🎵 Found **${spotifyTracks.length}** Spotify track(s). Resolving to YouTube...`
            );

            const resolved =
              await player.addSpotifyTracks(
                spotifyTracks,
                async (
                  _track,
                  count,
                  total
                ) => {
                  if (
                    count % 5 === 0 ||
                    count === total
                  ) {
                    await interaction
                      .editReply(
                        `🎵 Resolving Spotify tracks: **${count}/${total}**`
                      )
                      .catch(() => {});
                  }
                }
              );

            const first = resolved[0];

            const queuePosition =
              player.queue.length;

            await interaction.editReply({
              content:
                `▶️ Added **${resolved.length}** track(s) from Spotify.\n` +
                `Starting with **${first.title}**.` +
                (queuePosition > 0
                  ? `\n📋 **${queuePosition}** track(s) now in the queue.`
                  : ""),
              embeds: first.thumbnail
                ? [
                    new EmbedBuilder()
                      .setThumbnail(
                        first.thumbnail
                      ),
                  ]
                : [],
            });
          }

          // YouTube URL
          else if (isYouTubeUrl(query)) {
            const track =
              await searchYouTube(query);

            const wasPlaying =
              !!player.current;

            await player.addTracks([
              track,
            ]);

            if (wasPlaying) {
              await interaction.editReply(
                `📋 Added **${track.title}** to the queue at position **${player.queue.length}**.`
              );
            } else {
              await interaction.editReply({
                content: `▶️ Playing **${track.title}**`,
                embeds: track.thumbnail
                  ? [
                      new EmbedBuilder()
                        .setThumbnail(
                          track.thumbnail
                        ),
                    ]
                  : [],
              });
            }
          }

          // YouTube search
          else {
            const track =
              await player.addQuery(query);

            const position =
              player.queue.findIndex(
                (queued) =>
                  queued === track
              );

            // If it is already playing, position
            // will be -1.
            if (player.current === track) {
              await interaction.editReply({
                content: `▶️ Playing **${track.title}**`,
                embeds: track.thumbnail
                  ? [
                      new EmbedBuilder()
                        .setThumbnail(
                          track.thumbnail
                        ),
                    ]
                  : [],
              });
            } else {
              await interaction.editReply(
                `📋 Added **${track.title}** to the queue at position **${
                  position >= 0
                    ? position + 1
                    : player.queue.length
                }**.`
              );
            }
          }

          break;
        }

        // --------------------------------------------------
        // QUEUE
        // --------------------------------------------------

        case "queue": {
          if (
            !player.current &&
            !player.queue.length
          ) {
            await interaction.reply(
              "📭 Queue is empty."
            );

            break;
          }

          const lines = [];

          if (player.current) {
            lines.push(
              `🎵 **Now playing:** ${formatTrack(
                player.current
              )}`
            );

            lines.push("");
          }

          if (player.queue.length) {
            lines.push(
              `📋 **Up next — ${player.queue.length} track(s):**`
            );

            const visibleTracks =
              player.queue.slice(0, 15);

            visibleTracks.forEach(
              (track, index) => {
                lines.push(
                  `${index + 1}. ${formatTrack(
                    track
                  )}`
                );
              }
            );

            if (
              player.queue.length > 15
            ) {
              lines.push(
                "",
                `…and **${
                  player.queue.length - 15
                }** more.`
              );
            }
          } else {
            lines.push(
              "📭 **No more tracks queued.**"
            );
          }

          await interaction.reply(
            lines.join("\n")
          );

          break;
        }

        // --------------------------------------------------
        // REMOVE
        // --------------------------------------------------

        case "remove": {
          const position =
            interaction.options.getInteger(
              "position",
              true
            );

          if (!player.queue.length) {
            await interaction.reply(
              "📭 The queue is empty."
            );

            break;
          }

          if (
            position < 1 ||
            position > player.queue.length
          ) {
            await interaction.reply(
              `❌ Invalid position. The queue contains **${player.queue.length}** track(s).`
            );

            break;
          }

          const removed =
            player.remove(position);

          if (!removed) {
            await interaction.reply(
              "❌ Could not remove that track."
            );

            break;
          }

          await interaction.reply(
            `🗑️ Removed **${removed.title}** from the queue.`
          );

          break;
        }

        // --------------------------------------------------
        // CLEAR
        // --------------------------------------------------

        case "clear": {
          const count =
            player.clearQueue();

          if (!count) {
            await interaction.reply(
              "📭 The queue is already empty."
            );

            break;
          }

          await interaction.reply(
            `🗑️ Cleared **${count}** track(s) from the queue.\n` +
            (player.current
              ? `▶️ **${player.current.title}** will continue playing.`
              : "")
          );

          break;
        }

        // --------------------------------------------------
        // SHUFFLE
        // --------------------------------------------------

        case "shuffle": {
          if (player.queue.length < 2) {
            await interaction.reply(
              "🔀 You need at least **2 queued tracks** to shuffle."
            );

            break;
          }

          player.shuffle();

          await interaction.reply(
            `🔀 Shuffled **${player.queue.length}** queued track(s).`
          );

          break;
        }

        // --------------------------------------------------
        // MOVE
        // --------------------------------------------------

        case "move": {
          const from =
            interaction.options.getInteger(
              "from",
              true
            );

          const to =
            interaction.options.getInteger(
              "to",
              true
            );

          if (!player.queue.length) {
            await interaction.reply(
              "📭 The queue is empty."
            );

            break;
          }

          if (
            from < 1 ||
            from > player.queue.length
          ) {
            await interaction.reply(
              `❌ Invalid source position. Queue has **${player.queue.length}** track(s).`
            );

            break;
          }

          if (
            to < 1 ||
            to > player.queue.length
          ) {
            await interaction.reply(
              `❌ Invalid destination position. Queue has **${player.queue.length}** track(s).`
            );

            break;
          }

          if (from === to) {
            await interaction.reply(
              "ℹ️ The track is already at that position."
            );

            break;
          }

          const moved =
            player.move(from, to);

          if (!moved) {
            await interaction.reply(
              "❌ Could not move that track."
            );

            break;
          }

          await interaction.reply(
            `↕️ Moved **${moved.title}** from position **${from}** to **${to}**.`
          );

          break;
        }

        // --------------------------------------------------
        // SKIP
        // --------------------------------------------------

        case "skip": {
          if (!player.current) {
            await interaction.reply(
              "Nothing is currently playing."
            );

            break;
          }

          const title =
            player.current.title;

          const next =
            player.queue[0];

          player.skip();

          await interaction.reply(
            next
              ? `⏭️ Skipped **${title}**.\n▶️ Next: **${next.title}**`
              : `⏭️ Skipped **${title}**.`
          );

          break;
        }

        // --------------------------------------------------
        // STOP
        // --------------------------------------------------

        case "stop": {
          player.stop();

          await interaction.reply(
            "⏹️ Playback stopped and the queue was cleared."
          );

          break;
        }

        // --------------------------------------------------
        // PAUSE
        // --------------------------------------------------

        case "pause": {
          if (!player.current) {
            await interaction.reply(
              "Nothing is currently playing."
            );

            break;
          }

          player.pause();

          await interaction.reply(
            "⏸️ Paused."
          );

          break;
        }

        // --------------------------------------------------
        // RESUME
        // --------------------------------------------------

        case "resume": {
          if (!player.current) {
            await interaction.reply(
              "Nothing is currently playing."
            );

            break;
          }

          player.resume();

          await interaction.reply(
            "▶️ Resumed."
          );

          break;
        }

        // --------------------------------------------------
        // NOW PLAYING
        // --------------------------------------------------

        case "nowplaying": {
          if (!player.current) {
            await interaction.reply(
              "Nothing is currently playing."
            );

            break;
          }

          const track =
            player.current;

          const embed =
            new EmbedBuilder()
              .setTitle(track.title)
              .setURL(track.url)
              .setDescription(
                `Source: ${
                  track.source ||
                  "YouTube"
                }${
                  track.duration
                    ? ` • ${formatDuration(
                        track.duration
                      )}`
                    : ""
                }`
              );

          if (track.thumbnail) {
            embed.setThumbnail(
              track.thumbnail
            );
          }

          if (player.queue.length) {
            embed.addFields({
              name: "Up next",
              value: `${player.queue.length} track(s)`,
            });
          }

          await interaction.reply({
            embeds: [embed],
          });

          break;
        }

        // --------------------------------------------------
        // VOLUME
        // --------------------------------------------------

        case "volume": {
          const percent =
            interaction.options.getInteger(
              "percent",
              true
            );

          player.setVolume(percent);

          await interaction.reply(
            `🔊 Volume set to **${percent}%**.`
          );

          break;
        }

        // --------------------------------------------------
        // LEAVE
        // --------------------------------------------------

        case "leave": {
          destroyPlayer(
            interaction.guild.id
          );

          await interaction.reply(
            "👋 Disconnected and cleared the queue."
          );

          break;
        }

        default:
          break;
      }
    } catch (error) {
      console.error(error);

      const message =
        `❌ ${
          error?.message ||
          "Something went wrong."
        }`.slice(0, 1900);

      if (
        interaction.deferred ||
        interaction.replied
      ) {
        await interaction
          .editReply(message)
          .catch(() => {});
      } else {
        await interaction
          .reply(message)
          .catch(() => {});
      }
    }
  }
);

process.on("SIGINT", () =>
  client.destroy()
);

process.on("SIGTERM", () =>
  client.destroy()
);

client.login(token);