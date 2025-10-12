import type { ZodError, ZodTypeAny } from 'zod'
import type { HoaMiddleware } from 'hoa'

export { z, z as zod } from 'zod'

export interface ZodValidatorOptions {
  formatError?: (err: ZodError, ctx: any, key: string, value: any) => string
}

export function zodValidator (
  schemas: Record<string, ZodTypeAny>,
  options?: ZodValidatorOptions
): HoaMiddleware