import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req, Res, UseGuards } from '@nestjs/common'
import type { AuthSession, IssueRealtimeTicketResponse, LoginRequest, RegisterRequest } from '@game-center/contracts'
import type { Request, Response } from 'express'

import { AuthService } from '../application/auth.service.js'
import { AUTH_SETTINGS, type AuthSettings } from '../application/auth.ports.js'
import { buildSessionCookie, clearSessionCookie, readSessionCookie } from './auth.cookies.js'
import { requireAuthenticatedPlayer } from './authenticated-request.js'
import { AuthenticatedPlayerGuard } from './authenticated-player.guard.js'
import { issueRealtimeTicketRequestSchema, loginRequestSchema, registerRequestSchema } from './auth.schemas.js'

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(AUTH_SETTINGS) private readonly authSettings: AuthSettings,
  ) {}

  @Get('status')
  status() {
    return this.authService.status()
  }

  @Post('register')
  async register(@Body() body: unknown, @Res({ passthrough: true }) response: Response): Promise<AuthSession> {
    const result = await this.authService.register(registerRequestSchema.parse(body) as RegisterRequest)
    this.setSessionCookie(response, result.token)
    return result.session
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown, @Res({ passthrough: true }) response: Response): Promise<AuthSession> {
    const result = await this.authService.login(loginRequestSchema.parse(body) as LoginRequest)
    this.setSessionCookie(response, result.token)
    return result.session
  }

  @Get('session')
  @UseGuards(AuthenticatedPlayerGuard)
  session(@Req() request: Request): AuthSession {
    return this.authService.toAuthSession(requireAuthenticatedPlayer(request))
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.authService.logout(readSessionCookie(request))
    response.setHeader('Set-Cookie', clearSessionCookie(this.isSecureCookie()))
  }

  @Post('realtime-ticket')
  @UseGuards(AuthenticatedPlayerGuard)
  @HttpCode(HttpStatus.OK)
  issueRealtimeTicket(@Req() request: Request, @Body() body: unknown): Promise<IssueRealtimeTicketResponse> {
    return this.authService.issueRealtimeTicket(requireAuthenticatedPlayer(request), issueRealtimeTicketRequestSchema.parse(body))
  }

  private setSessionCookie(response: Response, token: string) {
    response.setHeader('Set-Cookie', buildSessionCookie(token, this.authSettings.sessionTtlMs, this.isSecureCookie()))
  }

  private isSecureCookie() {
    return process.env.NODE_ENV === 'production'
  }
}