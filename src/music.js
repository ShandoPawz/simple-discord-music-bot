const {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
} = require("@discordjs/voice");

const {
  createAudioProcess,
  searchYouTube,
} = require("./yt-dlp");

class GuildPlayer {
  constructor(guild) {
    this.guild = guild;

    this.queue = [];
    this.current = null;
    this.connection = null;
    this.currentProcess = null;

    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
      },
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      this.cleanupProcess();

      this.playNext().catch((error) => {
        console.error(`[${guild.id}] playNext:`, error);
      });
    });

    this.player.on("error", (error) => {
      console.error(`[${guild.id}] audio player error:`, error);

      this.cleanupProcess();

      this.playNext().catch((nextError) => {
        console.error(`[${guild.id}] recovery:`, nextError);
      });
    });
  }

  async connect(channel) {
    if (this.connection) {
      const existingChannelId =
        this.connection.joinConfig.channelId;

      if (existingChannelId !== channel.id) {
        throw new Error(
          "I am already connected to another voice channel."
        );
      }

      return;
    }

    this.connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    this.connection.on("error", (error) => {
      console.error(
        `[${this.guild.id}] voice connection error:`,
        error
      );
    });

    this.connection.subscribe(this.player);

    await entersState(
      this.connection,
      VoiceConnectionStatus.Ready,
      20_000
    );
  }

  async addTracks(tracks) {
    if (!Array.isArray(tracks) || !tracks.length) {
      return [];
    }

    this.queue.push(...tracks);

    if (!this.current) {
      await this.playNext();
    }

    return tracks;
  }

  async addQuery(query) {
    const result = await searchYouTube(query);

    const track = {
      ...result,
      source: "YouTube",
      requestedBy: null,
    };

    await this.addTracks([track]);

    return track;
  }

  async addSpotifyTracks(tracks, onResolved) {
    const resolved = [];

    for (const track of tracks) {
      const youtube = await searchYouTube(
        `${track.title} ${track.artist} official audio`
      );

      const resolvedTrack = {
        ...youtube,
        title: track.artist
          ? `${track.title} — ${track.artist}`
          : track.title,
        source: "Spotify → YouTube",
        spotifyUrl: track.spotifyUrl,
      };

      resolved.push(resolvedTrack);

      if (typeof onResolved === "function") {
        await onResolved(
          resolvedTrack,
          resolved.length,
          tracks.length
        );
      }
    }

    await this.addTracks(resolved);

    return resolved;
  }

  async playNext() {
    if (!this.queue.length) {
      this.current = null;
      this.cleanupProcess();
      return;
    }

    this.current = this.queue.shift();

    const process = createAudioProcess(this.current.url);

    this.currentProcess = process;

    let stderr = "";

    process.stderr.setEncoding("utf8");

    process.stderr.on("data", (data) => {
      stderr += data;

      if (stderr.length > 4000) {
        stderr = stderr.slice(-4000);
      }
    });

    process.on("error", (error) => {
      console.error(
        `[${this.guild.id}] yt-dlp process error:`,
        error
      );

      if (
        this.player.state.status !==
        AudioPlayerStatus.Idle
      ) {
        this.player.stop(true);
      }
    });

    process.on("close", (code) => {
      if (code !== 0) {
        console.error(
          `[${this.guild.id}] yt-dlp exited ${code}: ${
            stderr.trim() || "unknown error"
          }`
        );
      }
    });

    const resource = createAudioResource(
      process.stdout,
      {
        inputType: StreamType.Arbitrary,
        inlineVolume: true,
        metadata: this.current,
      }
    );

    resource.volume.setVolume(1);

    this.player.play(resource);
  }

  getQueue() {
    return this.queue;
  }

  getCurrent() {
    return this.current;
  }

  remove(position) {
    const index = position - 1;

    if (index < 0 || index >= this.queue.length) {
      return null;
    }

    return this.queue.splice(index, 1)[0];
  }

  clearQueue() {
    const count = this.queue.length;

    this.queue.length = 0;

    return count;
  }

  shuffle() {
    for (
      let i = this.queue.length - 1;
      i > 0;
      i--
    ) {
      const j = Math.floor(Math.random() * (i + 1));

      [
        this.queue[i],
        this.queue[j],
      ] = [
        this.queue[j],
        this.queue[i],
      ];
    }

    return this.queue;
  }

  move(from, to) {
    const fromIndex = from - 1;
    const toIndex = to - 1;

    if (
      fromIndex < 0 ||
      fromIndex >= this.queue.length
    ) {
      return null;
    }

    if (
      toIndex < 0 ||
      toIndex >= this.queue.length
    ) {
      return null;
    }

    const [track] = this.queue.splice(
      fromIndex,
      1
    );

    this.queue.splice(toIndex, 0, track);

    return track;
  }

  cleanupProcess() {
    if (this.currentProcess) {
      this.currentProcess.removeAllListeners();
      this.currentProcess = null;
    }
  }

  pause() {
    return this.player.pause();
  }

  resume() {
    return this.player.unpause();
  }

  skip() {
    this.killCurrentProcess();

    return this.player.stop(true);
  }

  stop() {
    this.queue.length = 0;

    this.killCurrentProcess();

    this.current = null;

    this.player.stop(true);
  }

  leave() {
    this.stop();

    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }
  }

  killCurrentProcess() {
    if (!this.currentProcess) {
      return;
    }

    this.currentProcess.kill("SIGTERM");
    this.currentProcess = null;
  }

  setVolume(percent) {
    const resource = this.player.state.resource;

    if (!resource?.volume) {
      throw new Error(
        "There is no active audio resource."
      );
    }

    resource.volume.setVolume(
      Math.max(0, Math.min(200, percent)) / 100
    );
  }
}

const players = new Map();

function getPlayer(guild) {
  let player = players.get(guild.id);

  if (!player) {
    player = new GuildPlayer(guild);
    players.set(guild.id, player);
  }

  return player;
}

function destroyPlayer(guildId) {
  const player = players.get(guildId);

  if (player) {
    player.leave();
    players.delete(guildId);
  }
}

module.exports = {
  getPlayer,
  destroyPlayer,
};