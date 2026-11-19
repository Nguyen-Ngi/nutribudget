import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lookupRetailerPrices } from '../src/data/kitchen/priceLookup.ts'

const oil = {
  retailerId: 'kingfoodmart', ingredientId: 'oil', productKey: 'simply-soybean-oil-1l',
  packQuantity: 1, unit: 'l', observedOn: '2026-11-19', reviewedAt: '2026-11-19T07:00:00Z',
  verification: 'product', product: 'Dầu đậu nành Simply', pack: '1 lít/chai', priceVnd: 62000,
  url: 'https://kingfoodmart.com/dau-nanh-dau-tong-hop/dau-dau-nanh-simply-chai-1l',
}
const now = () => Date.parse('2026-11-19T07:01:00Z')
const signal = new AbortController().signal
const endpoint = '/api/retailer-prices'
const request = (...observations) => async () => Response.json({ version: 1, observations })

test('requests only missing ingredients and uses a validated fresh price for the matching package', async () => {
  const result = await lookupRetailerPrices(endpoint, ['oil'], signal, async (url, options) => {
    assert.equal(url, endpoint + '?ingredients=oil')
    assert.equal(options.signal, signal)
    assert.equal(options.credentials, 'omit')
    return request(oil)()
  }, now)
  assert.equal(result.found, 1)
  const store = result.catalog.find(({ id }) => id === 'kingfoodmart')
  assert.deepEqual(store.observations.filter(({ productKey }) => productKey === oil.productKey).map(({ priceVnd }) => priceVnd), [62000])
})

test('expired responses cannot override snapshots and fresh out-of-stock responses suppress the stored offer', async () => {
  const outdated = await lookupRetailerPrices(endpoint, ['oil'], signal, request({ ...oil, reviewedAt: '2026-11-19T06:00:00Z' }), now)
  assert.equal(outdated.found, 0)
  assert.ok(outdated.catalog.find(({ id }) => id === 'kingfoodmart').observations.some(({ priceVnd }) => priceVnd === 63000))
  const unavailable = await lookupRetailerPrices(endpoint, ['oil'], signal, request({ ...oil, availability: 'unavailable' }), now)
  assert.equal(unavailable.found, 0)
  const offers = unavailable.catalog.find(({ id }) => id === 'kingfoodmart').observations.filter(({ productKey }) => productKey === oil.productKey)
  assert.deepEqual(offers.map(({ availability }) => availability), ['unavailable'])
  await assert.rejects(() => lookupRetailerPrices(endpoint, ['oil'], signal, request({ ...oil, url: 'https://invalid.example/product' }), now), /không hợp lệ/)
})
