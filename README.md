## @hoajs/zod

Zod validator middleware for Hoa.

## Installation

```bash
$ npm i @hoajs/zod --save
```

## Quick Start

```js
import { Hoa } from 'hoa'
import { router } from '@hoajs/router'
import { z, zodValidator } from '@hoajs/zod'

const app = new Hoa()
app.extend(router())

app.get(
  '/users/:name',
  zodValidator({
    params: z.object({
      name: z.string()
    }),
    // query: z.object({...}),
    // headers: z.object({...}),
    // body: z.object({...}),
    // ...
  }),
  async (ctx) => {
    const name = ctx.req.params.name
    ctx.res.body = `Hello, ${name}!`
  }
)

export default app
```

## Documentation

The documentation is available on [hoa-js.com](https://hoa-js.com/middleware/validator/zod.html)

## Test (100% coverage)

```sh
$ npm test
```

## License

MIT
