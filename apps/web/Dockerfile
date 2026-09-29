FROM node:24-alpine AS deps

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/platform-sdk-ts/package.json packages/platform-sdk-ts/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/observability/package.json packages/observability/package.json

RUN npm ci

FROM deps AS build

COPY apps/web ./apps/web
COPY packages ./packages

RUN npm --workspace @game-center/web run build

FROM deps AS dev

CMD ["npm", "--workspace", "@game-center/web", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

FROM nginx:1.27-alpine AS runtime

COPY infrastructure/docker/nginx/web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 80