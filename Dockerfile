FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/lib/server/db/schema.ts ./src/lib/server/db/schema.ts
COPY entrypoint.sh ./
RUN npm ci --omit=dev && npm install tsx
RUN mkdir -p /app/data
RUN chmod +x entrypoint.sh

EXPOSE 3000
VOLUME /app/data
ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/data/creneau.db

ENTRYPOINT ["./entrypoint.sh"]
