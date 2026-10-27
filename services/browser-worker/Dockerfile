FROM mcr.microsoft.com/playwright:v1.49.1-jammy
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends xvfb x11vnc novnc websockify fonts-liberation && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js start.sh ./
RUN chmod +x start.sh
ENV DISPLAY=:99
ENV PROFILE_DIR=/data/profile
CMD ["./start.sh"]
