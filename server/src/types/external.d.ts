declare module 'bcrypt' {
  export function hash(value: string, rounds: number): Promise<string>
  export function compare(value: string, hash: string): Promise<boolean>

  const bcrypt: {
    hash: typeof hash
    compare: typeof compare
  }
  export default bcrypt
}

declare module 'cors' {
  import { RequestHandler } from 'express'

  interface CorsOptions {
    origin?: string | string[]
  }

  export default function cors(options?: CorsOptions): RequestHandler
}

declare module 'jsonwebtoken' {
  export interface SignOptions {
    expiresIn?: string | number
  }

  export function sign(payload: object, secret: string, options?: SignOptions): string
  export function verify(token: string, secret: string): unknown

  const jwt: {
    sign: typeof sign
    verify: typeof verify
  }
  export default jwt
}
