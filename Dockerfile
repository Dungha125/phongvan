FROM node:20-alpine

WORKDIR /app

COPY package.docker.json ./package.json
RUN npm install --omit=dev

COPY server ./server

ENV PORT=3001
ENV DATA_DIR=/app/data
ENV ROSTER_FILE=/app/server/roster.csv
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "server/index.js"]
