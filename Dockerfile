FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN DATABASE_URL=file:./drizzle/seed.db node_modules/.bin/tsx scripts/seed.ts

FROM node:22-slim
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle/seed.db ./seed.db
COPY scripts/entrypoint.sh ./entrypoint.sh
RUN npm ci --omit=dev
RUN chmod +x entrypoint.sh
RUN mkdir -p /app/data

EXPOSE 3000
VOLUME /app/data
ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/data/creneau.db

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["./entrypoint.sh"]
