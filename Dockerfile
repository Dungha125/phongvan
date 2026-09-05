FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server

RUN mkdir -p /app/data && \
    echo '{"nextQueueNumber":1,"nextTableIndex":0,"people":[]}' > /app/data/data.json

ENV PORT=3001
ENV DATA_DIR=/app/data
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "server/index.js"]
