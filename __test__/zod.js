import { Hoa } from 'hoa'
import { z as zod, zodValidator } from '../src/zod.js'

describe('Zod validator middleware for Hoa', () => {
  it('No schemas -> throws', async () => {
    const app = new Hoa()
    let error
    try {
      app.use(zodValidator())
    } catch (e) {
      error = e
    }
    expect(error && error.message).toBe('schemas should be an object')
  })

  it('Wrong schema -> throws', async () => {
    const app = new Hoa()
    let error
    try {
      app.use(zodValidator({ body: { key: 1 } }))
    } catch (e) {
      error = e
    }
    expect(error && error.message).toBe('Schema for "body" must be a Zod schema')
  })

  it('validate JSON body -> success', async () => {
    const app = new Hoa()
    app.use(async (ctx, next) => {
      const ct = ctx.req.get('content-type') || ''
      if (ct.includes('application/json')) {
        ctx.req.body = await ctx.req.json()
      }
      await next()
    })
    app.use(zodValidator({
      body: zod.object({
        key1: zod.string(),
        key2: zod.coerce.number()
      })
    }))
    app.use(async (ctx) => {
      ctx.res.body = {
        valid: ctx.req.body
      }
    })

    const res = await app.fetch(new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key1: '1', key2: '2', key3: '3' })
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      valid: { key1: '1', key2: 2 }
    })
  })

  it('validate JSON body -> fail', async () => {
    const app = new Hoa()
    app.use(async (ctx, next) => {
      const ct = ctx.req.get('content-type') || ''
      if (ct.includes('application/json')) {
        ctx.req.body = await ctx.req.json()
      }
      await next()
    })
    app.use(zodValidator({
      body: zod.object({
        key1: zod.string(),
        key2: zod.string()
      })
    }))

    const res = await app.fetch(new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key1: 1, key2: 2 })
    }))
    expect(res.status).toBe(400)
    const text = await res.text()
    expect(text.length > 0).toBe(true)
  })

  it('validate query -> success', async () => {
    const app = new Hoa()
    app.use(zodValidator({
      query: zod.object({ key1: zod.string(), key2: zod.string() })
    }))
    app.use(async (ctx) => { ctx.res.body = { valid: ctx.req.query } })

    const res = await app.fetch(new Request('http://localhost/?key1=1&key2=2&key3=3'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ valid: { key1: '1', key2: '2' } })
  })

  it('validate query -> fail', async () => {
    const app = new Hoa()
    app.use(zodValidator({
      query: zod.object({ key1: zod.number(), key2: zod.number() })
    }))

    const res = await app.fetch(new Request('http://localhost/?key1=1&key2=2'))
    expect(res.status).toBe(400)
    const text = await res.text()
    expect(text.length > 0).toBe(true)
  })

  it('validate headers -> success', async () => {
    const app = new Hoa()
    app.use(zodValidator({
      headers: zod.object({ 'x-foo': zod.literal('bar') }).passthrough()
    }))
    app.use(async (ctx) => {
      ctx.res.body = {
        'x-foo': ctx.req.headers['x-foo'],
        'x-extra': ctx.req.headers['x-extra']
      }
    })

    const res = await app.fetch(new Request('http://localhost/', {
      headers: { 'x-foo': 'bar', 'x-extra': 'keep' }
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ 'x-foo': 'bar', 'x-extra': 'keep' })
  })

  it('validate headers -> fail', async () => {
    const app = new Hoa()
    app.use(zodValidator({
      headers: zod.object({ 'x-foo': zod.literal('bar') }).passthrough()
    }))

    const res = await app.fetch(new Request('http://localhost/', {
      headers: { 'x-foo': 'baz' }
    }))
    expect(res.status).toBe(400)
    const text = await res.text()
    expect(text.split('; ').length).toBe(1)
    expect(text).toBe('Invalid input: expected "bar"')
  })

  it('404 when no handler sets response', async () => {
    const app = new Hoa()
    app.use(zodValidator({}))
    const res = await app.fetch(new Request('http://localhost/404'))
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('')
  })

  it('uses options.formatError for custom message', async () => {
    const app = new Hoa()
    app.use(zodValidator({
      query: zod.object({ id: zod.number() })
    }, {
      formatError: (err, ctx, key, value) => `custom:${key}:${String(value?.id)}` /* eslint-disable-line */
    }))

    const res = await app.fetch(new Request('http://localhost/?id=abc'))
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('custom:query:abc')
  })

  it('defaultFormatError aggregates unique messages', async () => {
    const app = new Hoa()
    app.use(zodValidator({
      body: zod.object({
        a: zod.number(),
        b: zod.number()
      })
    }))

    const res = await app.fetch(new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 'x', b: 'y' })
    }))

    expect(res.status).toBe(400)
    const text = await res.text()
    expect(text.split('; ').length).toBe(1)
    expect(text).toBe('Invalid input: expected number, received undefined')
  })

  it('defaultFormatError works when error is array without issues', async () => {
    const app = new Hoa()
    const fakeSchema = {
      safeParseAsync: async () => ({ success: false, error: [{ message: 'A' }, { message: 'A' }, { message: 'B' }] })
    }
    app.use(zodValidator({ query: fakeSchema }))

    const res = await app.fetch(new Request('http://localhost/'))
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('A; B')
  })

  it('validate URL parts on ctx.req -> success', async () => {
    const app = new Hoa()
    app.use(zodValidator({
      url: zod.instanceof(URL),
      href: zod.string().url(),
      origin: zod.string(),
      protocol: zod.literal('http:'),
      host: zod.literal('example.com:8080'),
      hostname: zod.literal('example.com'),
      port: zod.literal('8080'),
      pathname: zod.literal('/users'),
      search: zod.literal('?id=1'),
      hash: zod.literal('#frag'),
      method: zod.literal('GET')
    }))
    app.use(async (ctx) => {
      ctx.res.body = {
        href: ctx.req.href,
        origin: ctx.req.origin,
        protocol: ctx.req.protocol,
        host: ctx.req.host,
        hostname: ctx.req.hostname,
        port: ctx.req.port,
        pathname: ctx.req.pathname,
        search: ctx.req.search,
        hash: ctx.req.hash,
        method: ctx.req.method
      }
    })

    const res = await app.fetch(new Request('http://example.com:8080/users?id=1#frag', { method: 'GET' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      href: 'http://example.com:8080/users?id=1#frag',
      origin: 'http://example.com:8080',
      protocol: 'http:',
      host: 'example.com:8080',
      hostname: 'example.com',
      port: '8080',
      pathname: '/users',
      search: '?id=1',
      hash: '#frag',
      method: 'GET'
    })
  })

  it('validate aggregated URL parts on ctx.req -> fail with merged messages', async () => {
    const app = new Hoa()
    app.use(async (ctx, next) => {
      ctx.req.urlParts = {
        href: ctx.req.href,
        origin: ctx.req.origin,
        protocol: ctx.req.protocol,
        host: ctx.req.host,
        hostname: ctx.req.hostname,
        port: ctx.req.port,
        pathname: ctx.req.pathname,
        search: ctx.req.search,
        hash: ctx.req.hash,
        method: ctx.req.method
      }
      await next()
    })

    app.use(zodValidator({
      urlParts: zod.object({
        href: zod.literal('http://example.com:8080/users?id=1#frag'),
        origin: zod.literal('http://example.com:8080'),
        protocol: zod.literal('http:'),
        host: zod.literal('example.com:8080'),
        hostname: zod.literal('example.com'),
        port: zod.literal('8080'),
        pathname: zod.literal('/users'),
        search: zod.literal('?id=1'),
        hash: zod.literal('#frag'),
        method: zod.literal('GET')
      })
    }))

    const res = await app.fetch(new Request('https://foo.com:3000/posts?id=2#bad', { method: 'POST' }))
    expect(res.status).toBe(400)
    const text = await res.text()
    const msgs = text.split('; ')
    expect(msgs.length).toBe(10)
    expect(text).toContain('Invalid input: expected "http://example.com:8080/users?id=1#frag"')
    expect(text).toContain('Invalid input: expected "http://example.com:8080"')
    expect(text).toContain('Invalid input: expected "http:"')
    expect(text).toContain('Invalid input: expected "example.com:8080"')
    expect(text).toContain('Invalid input: expected "example.com"')
    expect(text).toContain('Invalid input: expected "8080"')
    expect(text).toContain('Invalid input: expected "/users"')
    expect(text).toContain('Invalid input: expected "?id=1"')
    expect(text).toContain('Invalid input: expected "#frag"')
    expect(text).toContain('Invalid input: expected "GET"')
  })
})
