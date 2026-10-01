import 'reflect-metadata'

import { NestFactory } from '@nestjs/core'

import { AppModule } from '../../../../app.module.js'
import { DockerAllocationCleanupService } from '../docker-allocation-cleanup.service.js'

const dryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true'

const app = await NestFactory.createApplicationContext(AppModule, { logger: false })

try {
  const cleanupService = app.get(DockerAllocationCleanupService)
  const result = await cleanupService.cleanupOrphanedContainers({ dryRun })
  console.log(JSON.stringify(result, null, 2))
} finally {
  await app.close()
}