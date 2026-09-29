import { Injectable } from '@nestjs/common'

@Injectable()
export class SocialService {
  status() {
    return { module: 'social', status: 'placeholder' }
  }
}