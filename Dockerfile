FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 appuser

COPY --from=deps /app/node_modules ./node_modules

COPY --chown=appuser:nodejs . .

USER appuser

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "src/server.js"]
