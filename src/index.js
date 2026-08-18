require("dotenv").config();

const {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
} = require("discord.js");

const { token, maxSpotifyTracks } = require("./config");
const { destroyPlayer, getPlayer } = require("./music");
const {
  isSpotifyUrl,
  spotifyToTracks,
} = require("./spotify");

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
  if (!seconds) return "?:??";

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      secs
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  readyClient.user.setActivity("/play", { type: 2 });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || !interaction.guild) {
    return;
  }

  try {
    const player = getPlayer(interaction.guild);

    switch (interaction.commandName) {
      case "play": {
        const query = interaction.options.getString("query", true);
        const voiceChannel = getVoiceChannel(interaction);

        await interaction.deferReply();

        await player.connect(voiceChannel);

        if (isSpotifyUrl(query)) {
          const spotifyTracks = await spotifyToTracks(
            query,
            maxSpotifyTracks
          );

          await interaction.editReply(
            `🎵 Found **${spotifyTracks.length}** Spotify track(s). Resolving to YouTube...`
          );

          const resolved = await player.addSpotifyTracks(
            spotifyTracks,
            async (_track, count, total) => {
              if (count % 5 === 0 || count === total) {
                await interaction
                  .editReply(
                    `🎵 Resolving Spotify tracks: **${count}/${total}**`
                  )
                  .catch(() => {});
              }
            }
          );

          const first = resolved[0];

          await interaction.editReply({
            content:
              `▶️ Added **${resolved.length}** track(s) from Spotify.\n` +
              `Starting with **${first.title}**.`,
            embeds: first.thumbnail
              ? [new EmbedBuilder().setThumbnail(first.thumbnail)]
              : [],
          });
        } else if (isYouTubeUrl(query)) {
          const track = {
            title: query,
            url: query,
            source: "YouTube",
          };

          await player.addTracks([track]);

          await interaction.editReply(`▶️ Added **${query}**`);
        } else {
          const track = await player.addQuery(query);

          await interaction.editReply(
            `▶️ Added **${track.title}**`
          );
        }

        break;
      }

      case "skip": {
        if (!player.current) {
          await interaction.reply("Nothing is currently playing.");
          break;
        }

        const title = player.current.title;
        player.skip();

        await interaction.reply(`⏭️ Skipped **${title}**`);
        break;
      }

      case "stop":
        player.stop();
        await interaction.reply(
          "⏹️ Playback stopped and the queue was cleared."
        );
        break;

      case "pause":
        if (!player.current) {
          await interaction.reply("Nothing is currently playing.");
          break;
        }

        player.pause();
        await interaction.reply("⏸️ Paused.");
        break;

      case "resume":
        player.resume();
        await interaction.reply("▶️ Resumed.");
        break;

      case "queue": {
        if (!player.current && !player.queue.length) {
          await interaction.reply("Queue is empty.");
          break;
        }

        const current = player.current
          ? `**Now playing:** ${player.current.title}\n\n`
          : "";

        const upcoming = player.queue
          .slice(0, 15)
          .map(
            (track, index) =>
              `${index + 1}. ${track.title}${
                track.duration
                  ? ` \`${formatDuration(track.duration)}\``
                  : ""
              }`
          )
          .join("\n");

        const more =
          player.queue.length > 15
            ? `\n…and ${player.queue.length - 15} more.`
            : "";

        await interaction.reply(
          current +
            (upcoming
              ? `**Up next:**\n${upcoming}${more}`
              : "No more tracks queued.")
        );

        break;
      }

      case "nowplaying": {
        if (!player.current) {
          await interaction.reply("Nothing is currently playing.");
          break;
        }

        const track = player.current;

        const embed = new EmbedBuilder()
          .setTitle(track.title)
          .setURL(track.url)
          .setDescription(
            `Source: ${track.source || "YouTube"}${
              track.duration
                ? ` • ${formatDuration(track.duration)}`
                : ""
            }`
          );

        if (track.thumbnail) {
          embed.setThumbnail(track.thumbnail);
        }

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "volume": {
        const percent = interaction.options.getInteger(
          "percent",
          true
        );

        player.setVolume(percent);

        await interaction.reply(
          `🔊 Volume set to **${percent}%**.`
        );

        break;
      }

      case "leave":
        destroyPlayer(interaction.guild.id);
        await interaction.reply("👋 Disconnected.");
        break;

      default:
        break;
    }
  } catch (error) {
    console.error(error);

    const message =
      `❌ ${error?.message || "Something went wrong."}`.slice(
        0,
        1900
      );

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(message).catch(() => {});
    } else {
      await interaction.reply(message).catch(() => {});
    }
  }
});

process.on("SIGINT", () => client.destroy());
process.on("SIGTERM", () => client.destroy());

client.login(token);
