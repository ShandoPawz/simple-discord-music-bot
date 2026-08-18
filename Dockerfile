FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV YTDLP_PATH=/usr/local/bin/yt-dlp

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ffmpeg \
       python3 \
       ca-certificates \
       curl \
    && rm -rf /var/lib/apt/lists/*

# Always install a current yt-dlp release at image build time.
RUN curl -fsSL \
      https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
    && chmod 0755 /usr/local/bin/yt-dlp \
    && /usr/local/bin/yt-dlp --version

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

USER node

CMD ["node", "src/index.js"]
