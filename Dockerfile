FROM oven/bun:1-alpine
# curl does the retailer requests (see `get` in src/retailers.ts).
RUN apk add --no-cache curl
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY src ./src
CMD ["bun", "src/index.ts"]
