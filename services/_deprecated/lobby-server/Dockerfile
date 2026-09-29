FROM node:24-alpine AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY services/_deprecated/lobby-server/package.json services/_deprecated/lobby-server/package.json

RUN npm install

COPY services/_deprecated/lobby-server ./services/_deprecated/lobby-server

RUN npm --prefix services/_deprecated/lobby-server run build

FROM node:24-alpine AS runtime

WORKDIR /app

COPY --from=build /workspace/services/_deprecated/lobby-server/package.json ./package.json
COPY --from=build /workspace/services/_deprecated/lobby-server/dist ./dist
COPY --from=build /workspace/node_modules ./node_modules

EXPOSE 4000

CMD ["node", "dist/server.js"]