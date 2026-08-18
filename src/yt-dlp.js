const { spawn } = require("node:child_process");

const YTDLP = process.env.YTDLP_PATH || "yt-dlp";

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (data) => {
      stdout += data;
    });

    child.stderr.on("data", (data) => {
      stderr += data;
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(
            `yt-dlp exited with code ${code}: ${stderr.trim() || "unknown error"}`
          )
        );
      }
    });
  });
}

async function searchYouTube(query) {
  const { stdout } = await run([
    "--flat-playlist",
    "--dump-single-json",
    "--no-warnings",
    "--skip-download",
    `ytsearch1:${query}`,
  ]);

  let data;
  try {
    data = JSON.parse(stdout);
  } catch {
    throw new Error("yt-dlp returned invalid search data.");
  }

  const entry = data.entries?.[0];

  if (!entry?.id) {
    throw new Error(`No YouTube result found for "${query}".`);
  }

  return {
    title: entry.title || query,
    url:
      entry.webpage_url ||
      `https://www.youtube.com/watch?v=${entry.id}`,
    duration: Number(entry.duration) || 0,
    thumbnail: entry.thumbnail || null,
  };
}

function createAudioProcess(url) {
  const process = spawn(
    YTDLP,
    [
      "--no-warnings",
      "--no-playlist",
      "--no-progress",
      "--quiet",
      "--format",
      "bestaudio[ext=webm]/bestaudio/best",
      "--output",
      "-",
      url,
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  return process;
}

module.exports = {
  searchYouTube,
  createAudioProcess,
};
