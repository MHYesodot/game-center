import { ConsoleLogger, Injectable } from '@nestjs/common'

@Injectable()
export class JsonLogger extends ConsoleLogger {
  override log(message: string, context?: string) {
    this.write('log', message, context)
  }

  override error(message: string, trace?: string, context?: string) {
    this.write('error', message, context, trace)
  }

  override warn(message: string, context?: string) {
    this.write('warn', message, context)
  }

  override debug(message: string, context?: string) {
    this.write('debug', message, context)
  }

  private write(level: string, message: string, context?: string, trace?: string) {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      context: context ?? 'Application',
      message,
      trace,
    }

    process.stdout.write(`${JSON.stringify(payload)}\n`)
  }
}