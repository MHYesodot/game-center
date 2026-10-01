import http from 'node:http'

const port = Number(process.env.PORT ?? '7777')

const request = http.request(
  {
    host: '127.0.0.1',
    port,
    path: '/health',
    method: 'GET',
    timeout: 800,
  },
  (response) => {
    process.exit(response.statusCode === 200 ? 0 : 1)
  },
)

request.on('error', () => {
  process.exit(1)
})

request.on('timeout', () => {
  request.destroy(new Error('timeout'))
})

request.end()