import 'reflect-metadata'

import { RequestMethod } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module.js'
import { JsonLogger } from './common/logging/json-logger.service.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  const logger = app.get(JsonLogger)

  app.useLogger(logger)
  app.enableCors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
  app.enableShutdownHooks()
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  })

  const port = Number(process.env.PORT ?? '3000')
  await app.listen(port, '0.0.0.0')

  logger.log(`platform-api listening on ${port}`, 'Bootstrap')
}

void bootstrap()