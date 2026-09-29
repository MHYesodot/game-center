import { Injectable } from '@nestjs/common'

@Injectable()
export class PlayersService {
  status() {
    return { module: 'players', status: 'placeholder' }
  }
}