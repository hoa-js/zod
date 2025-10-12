export { z, z as zod } from 'zod'

/**
 * Zod validator middleware for Hoa.
 *
 * @param {Record<string, import('zod').ZodTypeAny>} schemas - Zod schemas keyed by field names on ctx.req.
 * @param {{ formatError?: (err: import('zod').ZodError, ctx: any, key: string, value: any) => string }} [options]
 * @returns {import('hoa').HoaMiddleware} Hoa middleware function
 */
export function zodValidator (schemas, options = {}) {
  if (!schemas || typeof schemas !== 'object') {
    throw new TypeError('schemas should be an object')
  }

  for (const key of Object.keys(schemas)) {
    const schema = schemas[key]
    if (!schema || typeof schema.safeParseAsync !== 'function') {
      throw new TypeError(`Schema for "${key}" must be a Zod schema`)
    }
  }

  return async function zodMiddleware (ctx, next) {
    for (const key of Object.keys(schemas)) {
      const schema = schemas[key]
      const value = ctx.req[key]

      const result = await schema.safeParseAsync(value)

      if (!result.success) {
        const err = result.error

        const message = typeof options.formatError === 'function'
          ? options.formatError(err, ctx, key, value)
          : defaultFormatError(err.issues || err)
        ctx.throw(400, message)
      } else {
        ctx.req[key] = result.data
      }
    }

    return next()
  }
}

/**
 * Convert ZodError into a readable error string.
 *
 * @param {import('zod').ZodError} err
 * @returns {string}
 */
function defaultFormatError (err) {
  return Array.from(new Set(err.map(e => e.message))).join('; ')
}
