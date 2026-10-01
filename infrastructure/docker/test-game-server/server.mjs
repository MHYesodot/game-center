import http from 'node:http'

const port = Number(process.env.PORT ?? '7777')
const mode = process.env.TEST_MODE ?? 'normal'

const metadata = {
  allocationId: process.env.ALLOCATION_ID ?? null,
  sessionId: process.env.SESSION_ID ?? null,
  gameId: process.env.GAME_ID ?? null,
  gameVersion: process.env.GAME_VERSION ?? null,
  protocolVersion: process.env.PROTOCOL_VERSION ?? null,
}

const server = http.createServer((request, response) => {
  if (request.url === '/health') {
    const healthy = mode !== 'hang-health'
    response.writeHead(healthy ? 200 : 503, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ ok: healthy, mode }))
    return
  }

  if (request.url === '/metadata') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify(metadata))
    return
  }

  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify({ ok: true, mode }))
})

server.listen(port, '0.0.0.0', () => {
  if (mode === 'exit-immediately') {
    process.exit(1)
  }
})

async function shutdown() {
  await new Promise((resolve) => server.close(resolve))
  process.exit(0)
}

process.on('SIGTERM', () => {
  void shutdown()
})

process.on('SIGINT', () => {
  void shutdown()
})