import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { compareBaskets, defaultShopping } from '../src/algorithms/shopping.ts'
import { retailerReferences } from '../src/data/kitchen/retailerResearch.ts'
import { retailers } from '../src/data/kitchen/retailers.ts'
import manifest from '../src/data/meals/dishArt.json' with { type: 'json' }
import { recipes } from '../src/data/meals/recipes.ts'

test('each catalog recipe has one unique packaged image with attribution and a valid image signature', async () => {
  assert.equal(Object.keys(manifest).length, recipes.length)
  const digests = await Promise.all(recipes.map(async ({ id, name }) => {
    const asset = manifest[id]
    assert.ok(asset, id)
    assert.equal(asset.name, name)
    assert.match(asset.kind, /^(photo|illustration)$/)
    assert.match(asset.file, /^dish-(photos|illustrations)\/[a-z0-9-]+\.(jpg|webp)$/)
    assert.ok(asset.source && asset.author && asset.license && asset.attribution && asset.changes, id)
    assert.match(asset.licenseUrl, /^https:\/\//)
    if (asset.kind === 'photo') assert.match(asset.source, /^https:\/\/commons\.wikimedia\.org\//)
    const bytes = await readFile(new URL('../public/' + asset.file, import.meta.url))
    assert.ok(asset.file.endsWith('.webp') ?
      bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' :
      bytes[0] === 0xff && bytes[1] === 0xd8, asset.file)
    return createHash('sha256').update(bytes).digest('hex')
  }))
  assert.equal(new Set(digests).size, recipes.length)
})

test('a cheaper partial estimate exposes missing ingredients and ranks after a complete sample basket', () => {
  const requirements = [
    { ingredientId: 'egg', required: 2, onHand: 0, shortage: 2 },
    { ingredientId: 'white-rice', required: 100, onHand: 0, shortage: 100 },
  ]
  const today = '2026-11-19'
  const quotes = compareBaskets({ deadline: today, mealCount: 1, missingMeals: 0, requirements }, 'test', today, defaultShopping, new Set())
  const partial = quotes.find(({ stores }) => stores.length === 1 && stores[0].retailerId === 'produce')
  assert.ok(partial)
  assert.deepEqual(partial.proposal.uncovered, ['white-rice'])
  assert.ok(partial.total < quotes[0].total)
  assert.deepEqual(quotes[0].proposal.uncovered, [])
  assert.ok(retailerReferences.every(({ name }) => retailers.every((store) => store.name !== name)))
})
