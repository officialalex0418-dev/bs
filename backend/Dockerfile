# ---------- Stage 1: Dependencies ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---------- Stage 2: Production Runner ----------
FROM node:20-alpine AS runner
ENV NODE_ENV=production

# Install tini for proper process signal handling (SIGTERM, SIGINT)
RUN apk add --no-cache tini wget

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./

USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]