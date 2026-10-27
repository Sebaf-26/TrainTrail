# The build output is plain JavaScript, so it is built on the builder's own
# platform. Emulated builds are slow, and Vite's native bundler crashes under
# Rosetta. Only the production dependencies, which include native modules, are
# installed for the target platform.
FROM --platform=$BUILDPLATFORM oven/bun:debian AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .

ENV NODE_ENV=production
RUN bun run build

FROM oven/bun:debian AS install
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM node:22-slim AS release
WORKDIR /app
COPY --from=install /app/node_modules node_modules
COPY --from=build /app/build build
COPY --from=build /app/package.json .
COPY --from=build /app/prisma/migrations ./prisma/migrations

COPY ./docker/migrate.js /app/docker/
COPY ./docker/admin.js /app/docker/
COPY ./docker/healthcheck.js /app/docker/
COPY ./docker/entrypoint.sh /app/bin/
COPY ./docker/traintrail-admin /app/bin/
COPY ./docker/traintrail-healthcheck /app/bin/
RUN chmod +x /app/bin/entrypoint.sh /app/bin/traintrail-admin /app/bin/traintrail-healthcheck

ENV PATH="${PATH}:/app/bin"
ENV BODY_SIZE_LIMIT=20M

ENV PUID=1000 PGID=1000
RUN mkdir -p /app/uploads && chown node:node /app/uploads

# No `USER`: the entrypoint fixes upload permissions as root, then drops to
# PUID:PGID before running anything else.
EXPOSE 3000/tcp
HEALTHCHECK --interval=5m --start-period=30s --start-interval=10s --retries=3 CMD ["traintrail-healthcheck"]
ENTRYPOINT [ "/app/bin/entrypoint.sh" ]
