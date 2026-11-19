import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { normalizedPack, parsePriceSnapshot } from '../src/data/kitchen/priceSnapshot.ts'

const destination = new URL('../src/data/kitchen/retailer-snapshot.json', import.meta.url)
const source = process.argv[2]
try {
  if (!source || process.argv.length !== 3) throw new Error('Cách dùng: npm run prices:import -- <tệp.json> hoặc --authorized-feed')
  let data
  if (source === '--authorized-feed') {
    const endpoint = process.env.NUTRIBUDGET_RETAILER_FEED_URL
    if (!endpoint) throw new Error('Chưa cấu hình NUTRIBUDGET_RETAILER_FEED_URL.')
    const url = new URL(endpoint)
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Nguồn giá cần dùng HTTPS.')
    const token = process.env.NUTRIBUDGET_RETAILER_FEED_TOKEN
    const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {},
      redirect: 'error', signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new Error(`Nguồn giá trả mã ${response.status}.`)
    const incoming = parsePriceSnapshot(await response.json())
    const current = parsePriceSnapshot(JSON.parse(readFileSync(destination, 'utf8')))
    const key = (row) => JSON.stringify([row.retailerId, row.ingredientId, row.productKey, normalizedPack(row)])
    const rows = new Map(current.observations.map((row) => [key(row), row]))
    for (const row of incoming.observations) {
      const previous = rows.get(key(row))
      if (!previous || (row.reviewedAt ?? row.observedOn) >= (previous.reviewedAt ?? previous.observedOn)) rows.set(key(row), row)
    }
    data = { version: 1, observations: [...rows.values()] }
  } else {
    data = parsePriceSnapshot(JSON.parse(readFileSync(source, 'utf8')))
  }
  const temporary = new URL(`./.retailer-snapshot.${process.pid}.tmp`, destination)
  writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' })
  renameSync(temporary, destination)
  console.log(`Đã nhập ${data.observations.length} quan sát giá.`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
