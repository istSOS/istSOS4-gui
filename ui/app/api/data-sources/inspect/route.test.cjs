/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the actual route with mocked upstream responses. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const { test } = require('node:test')
const ts = require('typescript')

const filename = path.join(__dirname, 'route.ts')
const route = new Module(filename, module)
route.filename = filename
route.paths = module.paths
route.require = (name) =>
  name === 'next/server'
    ? { NextResponse: Response }
    : Module.prototype.require.call(route, name)
route._compile(
  ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  filename
)

async function inspect(body) {
  const response = await route.exports.POST(
    new Request('http://gui.test/api/data-sources/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
  assert.equal(response.status, 200)
  return response.json()
}

test('the login availability check reaches a POST-only endpoint instead of the GET resource handler', async (context) => {
  const calls = []
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options })
    return Response.json(
      options.method === 'POST'
        ? { detail: 'Username and password are required' }
        : { message: "Invalid resource path: unknown collection 'Login'" },
      { status: options.method === 'POST' ? 422 : 404 }
    )
  })
  assert.deepEqual(
    await inspect({
      mode: 'login-check',
      apiRoot: ' https://istsos.test/tsdb/v1.1/// ',
    }),
    { ok: true }
  )
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://istsos.test/tsdb/v1.1/Login')
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(
    calls[0].options.headers['Content-Type'],
    'application/x-www-form-urlencoded'
  )
  const body = new URLSearchParams(calls[0].options.body)
  assert.equal(body.get('grant_type'), 'password')
  assert.equal(body.has('username'), false)
  assert.equal(body.has('password'), false)
})

test('credential validation responses confirm login availability', async (context) => {
  let status = 400
  context.mock.method(globalThis, 'fetch', async () =>
    Response.json({}, { status })
  )
  for (status of [200, 400, 401, 403, 422])
    assert.deepEqual(
      await inspect({
        mode: 'login-check',
        apiRoot: 'https://istsos.test/v1.1',
      }),
      { ok: true }
    )
})

test('missing and unavailable login endpoints remain distinguishable', async (context) => {
  let status = 404
  context.mock.method(globalThis, 'fetch', async () => {
    if (status === null) throw new TypeError('fetch failed')
    return Response.json({}, { status })
  })
  for (const [code, errorCode] of [
    [404, 'validation_login_missing'],
    [500, 'validation_login_check_failed'],
    [503, 'validation_login_check_failed'],
    [null, 'validation_login_check_failed'],
  ]) {
    status = code
    assert.deepEqual(
      await inspect({
        mode: 'login-check',
        apiRoot: 'https://istsos.test/v1.1',
      }),
      { ok: false, errorCode }
    )
  }
})

test('authenticated login still requires valid credentials before returning access', async (context) => {
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/Login')) {
      assert.equal(options.method, 'POST')
      const body = new URLSearchParams(options.body)
      assert.equal(body.get('username'), 'editor')
      assert.equal(body.get('password'), 'test-password')
      return Response.json({ access_token: 'test-access-token' })
    }
    assert.equal(options.headers.Authorization, 'Bearer test-access-token')
    return Response.json({ value: [] })
  })
  assert.deepEqual(
    await inspect({
      mode: 'authenticated',
      apiRoot: 'https://istsos.test/v1.1',
      username: 'editor',
      password: 'test-password',
    }),
    {
      ok: true,
      networkEnabled: true,
      status: 'online',
      error: null,
      accessToken: 'test-access-token',
    }
  )
})

test('authenticated requests report real missing routes separately from rejected credentials', async (context) => {
  let status = 404
  context.mock.method(globalThis, 'fetch', async () =>
    Response.json({}, { status })
  )
  for (const [code, errorCode] of [
    [404, 'validation_login_missing'],
    [401, 'validation_login_failed'],
  ]) {
    status = code
    assert.deepEqual(
      await inspect({
        mode: 'authenticated',
        apiRoot: 'https://istsos.test/v1.1',
        username: 'editor',
        password: 'test-password',
      }),
      { ok: false, errorCode }
    )
  }
})
