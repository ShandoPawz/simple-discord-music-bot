FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV YTDLP_PATH=/usr/local/bin/yt-dlp

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ffmpeg \
       python3 \
       ca-certificates \
       curl \
       unzip \
    && rm -rf /var/lib/apt/lists/*

# Install current yt-dlp
RUN curl -fsSL \
      https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
    && chmod 0755 /usr/local/bin/yt-dlp \
    && /usr/local/bin/yt-dlp --version

# Install bgutil PO-token provider plugin
RUN mkdir -p /usr/local/bin/yt-dlp-plugins/bgutil-ytdlp-pot-provider \
    && curl -fsSL \
      https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/download/1.3.1/bgutil-ytdlp-pot-provider.zip \
      -o /tmp/bgutil.zip \
    && unzip -q /tmp/bgutil.zip \
      -d /usr/local/bin/yt-dlp-plugins/bgutil-ytdlp-pot-provider \
    && rm -f /tmp/bgutil.zip

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

USER node

CMD ["node", "src/index.js"]