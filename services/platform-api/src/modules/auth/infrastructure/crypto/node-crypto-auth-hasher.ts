import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

import { Injectable } from '@nestjs/common'

import type { AuthHasher, AuthSecretGenerator } from '../../application/auth.ports.js'

const scrypt = promisify(scryptCallback)

@Injectable()
export class NodeCryptoAuthHasher implements AuthHasher {
  async hash(value: string): Promise<string> {
    const salt = randomBytes(16)
    const derivedKey = (await scrypt(value, salt, 64)) as Buffer
    return `${salt.toString('base64url')}:${derivedKey.toString('base64url')}`
  }

  async verify(value: string, storedHash: string): Promise<boolean> {
    const [saltValue, hashValue] = storedHash.split(':')

    if (!saltValue || !hashValue) {
      return false
    }

    const salt = Buffer.from(saltValue, 'base64url')
    const expectedHash = Buffer.from(hashValue, 'base64url')
    const candidateHash = (await scrypt(value, salt, expectedHash.length)) as Buffer

    return expectedHash.length === candidateHash.length && timingSafeEqual(expectedHash, candidateHash)
  }
}

@Injectable()
export class NodeCryptoSecretGenerator implements AuthSecretGenerator {
  nextSecret() {
    return randomBytes(32).toString('base64url')
  }
}