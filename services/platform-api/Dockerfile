FROM node:24-alpine AS deps

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY services/platform-api/package.json services/platform-api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/platform-sdk-ts/package.json packages/platform-sdk-ts/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/observability/package.json packages/observability/package.json

RUN npm ci

FROM deps AS build

COPY services/platform-api ./services/platform-api
COPY packages ./packages

RUN npm --workspace @game-center/platform-api run build

FROM deps AS dev

CMD ["npm", "--workspace", "@game-center/platform-api", "run", "dev"]

FROM node:24-alpine AS runtime

WORKDIR /app

COPY --from=build /workspace/services/platform-api/package.json ./package.json
COPY --from=build /workspace/services/platform-api/dist ./dist
COPY --from=build /workspace/services/platform-api/drizzle ./drizzle
COPY --from=build /workspace/node_modules ./node_modules

EXPOSE 3000

CMD ["node", "dist/main.js"]