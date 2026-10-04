export function badPlayerHeader(request: { header(name: string): string | undefined }) {
  return request.header('x-player-id')
}