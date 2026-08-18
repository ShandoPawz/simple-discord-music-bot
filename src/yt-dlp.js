const { spawn } = require("node:child_process");

const YTDLP = process.env.YTDLP_PATH || "yt-dlp";

const YTDLP_COMMON_ARGS = [
  "--js-runtimes",
  "node",
  "--remote-components",
  "ejs:github",
];

const YTDLP_EXTRACTOR_ARGS =
  "youtube:player_client=web_embedded,youtubepot-bgutilhttp:base_url=http://bgutil-provider:4416";

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP, [...YTDLP_COMMON_ARGS, ...args], {
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
            `yt-dlp exited with code ${code}: ${
              stderr.trim() || "unknown error"
            }`
          )
        );
      }
    });
  });
}

async function searchYouTube(query) {
  const { stdout } = await run([
    "--extractor-args",
    YTDLP_EXTRACTOR_ARGS,

    "--flat-playlist",
    "--dump-single-json",
    "--no-warnings",
    "--skip-download",

    `ytsearch10:${query}`,
  ]);

  let data;

  try {
    data = JSON.parse(stdout);
  } catch {
    throw new Error("yt-dlp returned invalid search data.");
  }

  const entries = (data.entries || []).filter((entry) => entry?.id);

  if (!entries.length) {
    throw new Error(`No YouTube result found for "${query}".`);
  }

  const normalize = (text) =>
    String(text || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

  const queryNormalized = normalize(query);
  const queryWords = queryNormalized
    .split(" ")
    .filter((word) => word.length >= 2);

  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "of",
    "to",
    "in",
    "on",
    "for",
    "with",
  ]);

  const meaningfulWords = queryWords.filter(
    (word) => !stopWords.has(word)
  );

  const badTerms = [
    "reaction",
    "reactions",
    "reacts",
    "react",
    "cover",
    "covers",
    "remix",
    "remixes",
    "karaoke",
    "live",
    "concert",
    "sped up",
    "slowed",
    "nightcore",
    "8d",
    "lyrics",
    "lyric video",
    "instrumental",
    "tutorial",
    "lesson",
    "review",
    "shorts",
    "short",
    "meme",
    "fan made",
    "fanmade",
  ];

  const musicTerms = [
    "official audio",
    "official music video",
    "official video",
    "audio",
    "music video",
    "topic",
  ];

  function scoreEntry(entry) {
    const title = normalize(entry.title);

    let score = 0;

    // --------------------------------------------------
    // Exact title match
    // --------------------------------------------------

    if (title === queryNormalized) {
      score += 2000;
    }

    // Entire query appears in title
    if (title.includes(queryNormalized)) {
      score += 1000;
    }

    // --------------------------------------------------
    // Word matching
    // --------------------------------------------------

    let matchedWords = 0;

    for (const word of meaningfulWords) {
      if (title.includes(word)) {
        matchedWords++;
        score += 150;
      }
    }

    // Reward matching most/all query words
    if (meaningfulWords.length > 0) {
      const matchRatio =
        matchedWords / meaningfulWords.length;

      score += Math.round(matchRatio * 500);
    }

    // --------------------------------------------------
    // Title structure
    // --------------------------------------------------

    // Query at the beginning is very strong for music.
    if (title.startsWith(queryNormalized)) {
      score += 600;
    }

    // --------------------------------------------------
    // Music-specific terms
    // --------------------------------------------------

    for (const term of musicTerms) {
      if (title.includes(term)) {
        score += 100;
      }
    }

    // --------------------------------------------------
    // Bad-result penalties
    // --------------------------------------------------

    for (const term of badTerms) {
      if (title.includes(term)) {
        score -= 400;
      }
    }

    // --------------------------------------------------
    // Duration heuristics
    // --------------------------------------------------

    const duration = Number(entry.duration) || 0;

    // Music tracks are commonly between ~1.5 and 10 minutes.
    if (duration >= 90 && duration <= 600) {
      score += 100;
    }

    // Very short videos are often Shorts/clips.
    if (duration > 0 && duration < 60) {
      score -= 300;
    }

    // Extremely long videos are less likely to be the requested track.
    if (duration > 900) {
      score -= 150;
    }

    return score;
  }

  const ranked = entries
    .map((entry) => ({
      entry,
      score: scoreEntry(entry),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];

  console.log(
    `[YouTube search] "${query}" → "${best.entry.title}" (${best.score})`
  );

  // Useful while testing:
  for (const result of ranked.slice(0, 5)) {
    console.log(
      `[YouTube search] ${result.score} → ${result.entry.title}`
    );
  }

  return {
    title: best.entry.title || query,
    url:
      best.entry.webpage_url ||
      `https://www.youtube.com/watch?v=${best.entry.id}`,
    duration: Number(best.entry.duration) || 0,
    thumbnail: best.entry.thumbnail || null,
  };
}

function createAudioProcess(url) {
  return spawn(
    YTDLP,
    [
      ...YTDLP_COMMON_ARGS,

      "--extractor-args",
      YTDLP_EXTRACTOR_ARGS,

      "--no-warnings",
      "--no-playlist",
      "--no-progress",
      "--quiet",

      "--format",
      "bestaudio/best",

      "--output",
      "-",

      url,
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
}

module.exports = {
  searchYouTube,
  createAudioProcess,
};