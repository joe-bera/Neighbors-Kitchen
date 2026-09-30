# Neighbors Kitchen: one image that runs the whole app (API, website, background helper).
# Railway builds it from main (see railway.json). Design: docs/superpowers/specs/2026-09-29-phase8a-live-preview-design.md

FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/package.json backend/package-lock.json backend/
COPY frontend/package.json frontend/package-lock.json frontend/
RUN npm ci --prefix backend && npm ci --prefix frontend
COPY backend backend
COPY frontend frontend
RUN npm run build --prefix backend && npm run build --prefix frontend
# Keep only what the live site runs; the Prisma client is generated again for the trimmed packages.
WORKDIR /app/backend
RUN npm prune --omit=dev && npx prisma generate

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=build /app/backend/package.json /app/backend/package-lock.json ./
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
# The seed runs from TypeScript (tsx) in the pre-deploy step and imports these sources.
COPY --from=build /app/backend/src ./src
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/data ./data
COPY --from=build /app/frontend/dist /app/frontend/dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
