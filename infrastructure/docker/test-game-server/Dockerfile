FROM node:24-alpine

WORKDIR /app

COPY server.mjs ./server.mjs
COPY healthcheck.mjs ./healthcheck.mjs

RUN addgroup -S gamecenter && adduser -S gamecenter -G gamecenter && chown -R gamecenter:gamecenter /app

USER gamecenter

ENV PORT=7777

EXPOSE 7777

HEALTHCHECK --interval=1s --timeout=1s --retries=20 CMD ["node", "healthcheck.mjs"]

CMD ["node", "server.mjs"]