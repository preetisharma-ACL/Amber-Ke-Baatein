/**
 * DB latency ka breakdown / isolate where per-request database time goes.
 * Temporary diagnostic — deleted after the investigation.
 */
import dns from 'node:dns/promises'
import net from 'node:net'
import { performance } from 'node:perf_hooks'
import pg from 'pg'

import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
// apps/cms/src/scripts -> repo root is four levels up.
loadEnv({ path: path.resolve(dirname, '../../../../.env') })

const url = new URL(process.env.DATABASE_URL!)
const host = url.hostname
const port = Number(url.port || 5432)

const ms = (n: number) => `${n.toFixed(0)}ms`
const t = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  const start = performance.now()
  const out = await fn()
  console.log(`  ${label.padEnd(42)} ${ms(performance.now() - start)}`)
  return out
}

console.log(`\nhost: ${host}:${port}\n`)

console.log('── network ────────────────────────────────────────────')
const addrs = await t('DNS resolve', () => dns.lookup(host))
console.log(`  -> ${addrs.address}`)

/** कच्चा TCP handshake = एक बार का round trip / raw TCP RTT, one round trip. */
const tcpConnect = () =>
  new Promise<void>((resolve, reject) => {
    const start = performance.now()
    const socket = net.connect(port, host, () => {
      console.log(`  ${'TCP connect (1 round trip)'.padEnd(42)} ${ms(performance.now() - start)}`)
      socket.destroy()
      resolve()
    })
    socket.on('error', reject)
  })

for (let i = 0; i < 3; i++) await tcpConnect()

console.log('\n── postgres ───────────────────────────────────────────')
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await t('pg connect (TCP + TLS + auth)', () => client.connect())

for (let i = 0; i < 5; i++) {
  await t(`SELECT 1  (warm, run ${i + 1})`, () => client.query('SELECT 1'))
}

await t('SELECT count(*) FROM posts', () => client.query('SELECT count(*) FROM posts'))
await t('real list query (posts + join)', () =>
  client.query(
    'SELECT p.*, c.name FROM posts p LEFT JOIN categories c ON c.id = p.category_id ORDER BY p."order" DESC LIMIT 10',
  ),
)
await client.end()

console.log('\n── payload local API ──────────────────────────────────')
const { getPayload } = await import('payload')
const { default: payloadConfig } = await import('../payload.config')
const payload = await t('getPayload() init', async () => getPayload({ config: payloadConfig }))

for (let i = 0; i < 4; i++) {
  await t(`payload.find posts limit 10 depth 1 (${i + 1})`, () =>
    payload.find({ collection: 'posts', limit: 10, depth: 1, overrideAccess: true }),
  )
}
for (let i = 0; i < 2; i++) {
  await t(`payload.find posts limit 10 depth 0 (${i + 1})`, () =>
    payload.find({ collection: 'posts', limit: 10, depth: 0, overrideAccess: true }),
  )
}

console.log('')
process.exit(0)
