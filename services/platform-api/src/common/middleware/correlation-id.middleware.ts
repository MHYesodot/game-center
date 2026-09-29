import { randomUUID } from 'node:crypto'

import { Injectable, NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const requestId = request.header('x-request-id') ?? randomUUID()

    response.setHeader('x-request-id', requestId)
    request.headers['x-request-id'] = requestId

    next()
  }
}