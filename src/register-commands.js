require("dotenv").config();

const {
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");

const {
  token,
  clientId,
  guildId,
} = require("./config");

const commands = [
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play YouTube or Spotify music")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("YouTube URL/search or Spotify track/playlist/album URL")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the current track"),

  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop playback and clear the queue"),

  new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Pause playback"),

  new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Resume playback"),

  new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the current queue"),

  new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Show the current track"),

  new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Set volume from 0 to 200 percent")
    .addIntegerOption((option) =>
      option
        .setName("percent")
        .setDescription("Volume percentage")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(200)
    ),

  new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Disconnect from voice"),
].map((command) => command.toJSON());

(async () => {
  const rest = new REST({ version: "10" }).setToken(token);

  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  console.log(
    `Registering commands ${
      guildId ? `in guild ${guildId}` : "globally"
    }...`
  );

  await rest.put(route, { body: commands });

  console.log("Commands registered successfully.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
