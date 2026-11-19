import { retailerBranches, shoppingAreas } from '../data/kitchen/retailerLocations.ts'
import type { RealRetailerId, ShoppingBranch } from '../types/kitchen.ts'

type Point = Pick<ShoppingBranch, 'latitude' | 'longitude'>

export function distanceKm(from: Point, to: Point) {
  const radians = (angle: number) => angle * Math.PI / 180
  const latitude = Math.sin(radians(to.latitude - from.latitude) / 2)
  const longitude = Math.sin(radians(to.longitude - from.longitude) / 2)
  const a = latitude ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * longitude ** 2
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function locateBasket(ids: readonly RealRetailerId[], area: Point,
  branches: readonly ShoppingBranch[] = retailerBranches) {
  const stops = ids.flatMap((id) => {
    const closest = branches.filter(({ retailerId }) => retailerId === id)
      .map((branch) => ({ branch, km: distanceKm(area, branch) }))
      .sort((a, b) => a.km - b.km || a.branch.id.localeCompare(b.branch.id))[0]
    return closest ? [closest] : []
  })
  return { branches: stops.map(({ branch }) => branch), km: ids.length === stops.length ?
    stops.reduce((sum, { km }) => sum + km, 0) : undefined }
}

export const shoppingArea = (id: string) => shoppingAreas.find((area) => area.id === id)
