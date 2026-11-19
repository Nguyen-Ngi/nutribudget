import type { ShoppingBranch } from '../../types/kitchen.ts'

const tanMyStore = 'https://sieuthi.kingfoodmart.com/kingfoodmart-supermarket-phu%E1%BB%9Dng-tan-m%E1%BB%B9-h%E1%BB%93-chi-minh-'

export const retailerBranches: readonly ShoppingBranch[] = [
  { id: 'king-q7-boulevard', retailerId: 'kingfoodmart', name: 'Q7 Boulevard',
    address: 'Block B1, Q7 Boulevard, Nguyễn Lương Bằng, phường Tân Mỹ', latitude: 10.70836649626, longitude: 106.73292250728,
    source: tanMyStore + '576734/Home', reviewedOn: '2026-11-19' },
  { id: 'king-green-view', retailerId: 'kingfoodmart', name: 'Green View',
    address: 'Khu S1-3, Green View, Nguyễn Lương Bằng, phường Tân Mỹ', latitude: 10.71908301, longitude: 106.72713901,
    source: tanMyStore + '528529/Home', reviewedOn: '2026-11-19' },
  { id: 'king-huynh-tan-phat', retailerId: 'kingfoodmart', name: '956 Huỳnh Tấn Phát',
    address: '956 Huỳnh Tấn Phát, phường Tân Mỹ', latitude: 10.72619732, longitude: 106.7336777,
    source: tanMyStore + '528508/Home', reviewedOn: '2026-11-19' },
  { id: 'win-landmark', retailerId: 'winmart', name: 'Landmark 81',
    address: 'Tầng B1, Vincom Center Landmark 81, 772 Điện Biên Phủ, phường Thạnh Mỹ Tây',
    latitude: 10.794575, longitude: 106.7220989, reviewedOn: '2026-11-19',
    source: 'https://vincom.com.vn/vincom-center-landmark-81/gioi-thieu',
    coordinateSource: 'https://www.google.com/maps?cid=17580183842352842166' },
]

// Public landmarks used as approximate origins. No browser location is requested.
export const shoppingAreas = retailerBranches.map(({ id, name, retailerId, latitude, longitude }) => ({
  id, name: `Gần ${name} (${retailerId === 'winmart' ? 'Thạnh Mỹ Tây' : 'Tân Mỹ'})`, latitude, longitude,
}))
