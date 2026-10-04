import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

import { Injectable } from '@nestjs/common'

import type { AuthHasher, AuthSecretGenerator } from '../../application/auth.ports.js'

const scrypt = promisify(scryptCallback)

export const AUTH_SCRYPT_SALT_BYTES = 16
export const AUTH_SCRYPT_DERIVED_KEY_BYTES = 64
export const AUTH_SCRYPT_COST = 16_384
export const AUTH_SCRYPT_BLOCK_SIZE = 8
export const AUTH_SCRYPT_PARALLELIZATION = 1
export const AUTH_SECRET_BYTES = 32
const AUTH_SCRYPT_MAX_MEMORY = 32 * 1024 * 1024

@Injectable()
export class NodeCryptoAuthHasher implements AuthHasher {
  async hash(value: string): Promise<string> {
    const salt = randomBytes(AUTH_SCRYPT_SALT_BYTES)
    const derivedKey = (await scrypt(value, salt, AUTH_SCRYPT_DERIVED_KEY_BYTES, {
      N: AUTH_SCRYPT_COST,
      r: AUTH_SCRYPT_BLOCK_SIZE,
      p: AUTH_SCRYPT_PARALLELIZATION,
      maxmem: AUTH_SCRYPT_MAX_MEMORY,
    })) as Buffer
    return `${salt.toString('base64url')}:${derivedKey.toString('base64url')}`
  }

  async verify(value: string, storedHash: string): Promise<boolean> {
    const [saltValue, hashValue] = storedHash.split(':')

    if (!saltValue || !hashValue) {
      return false
    }

    const salt = Buffer.from(saltValue, 'base64url')
    const expectedHash = Buffer.from(hashValue, 'base64url')
    const candidateHash = (await scrypt(value, salt, expectedHash.length, {
      N: AUTH_SCRYPT_COST,
      r: AUTH_SCRYPT_BLOCK_SIZE,
      p: AUTH_SCRYPT_PARALLELIZATION,
      maxmem: AUTH_SCRYPT_MAX_MEMORY,
    })) as Buffer

    return expectedHash.length === candidateHash.length && timingSafeEqual(expectedHash, candidateHash)
  }
}

@Injectable()
export class NodeCryptoSecretGenerator implements AuthSecretGenerator {
  nextSecret() {
    return randomBytes(AUTH_SECRET_BYTES).toString('base64url')
  }
}