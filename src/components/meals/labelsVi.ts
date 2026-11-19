import { ingredients } from '../../data/meals/ingredients'
import type { IngredientId } from '../../data/meals/ingredients'
import type { Allergen, AnimalSource, Equipment, FoodGroup, MealSlot } from '../../types/meals'

export const slotLabels: Record<MealSlot, string> = { breakfast: 'Bữa sáng', lunch: 'Bữa trưa', dinner: 'Bữa tối' }
export const allergenLabels: Record<Allergen, string> = {
  eggs: 'trứng', fish: 'cá', shellfish: 'tôm, cua và hải sản có vỏ', soy: 'đậu nành', wheat: 'lúa mì', peanuts: 'đậu phộng',
}
export const animalLabels: Record<AnimalSource, string> = {
  egg: 'trứng', fish: 'cá', shellfish: 'hải sản có vỏ', pork: 'thịt heo', chicken: 'thịt gà', beef: 'thịt bò',
}
export const equipmentLabels: Record<Equipment, string> = {
  stovetop: 'bếp', pot: 'nồi', skillet: 'chảo', knife: 'dao', 'rice cooker': 'nồi cơm điện',
}
export const foodGroupLabels: Record<FoodGroup, string> = {
  grains: 'ngũ cốc', protein: 'đạm', vegetables: 'rau củ', fruit: 'trái cây', fats: 'chất béo', seasoning: 'gia vị',
}

export { ingredientLabels } from '../../data/meals/ingredientLabelsVi'

const quantityFormat = new Intl.NumberFormat('vi-VN')

export const formatQuantity = (quantity: number) => quantityFormat.format(quantity)

export function ingredientQuantity(id: IngredientId, quantity: number) {
  const unit = ingredients[id].unit
  return `${formatQuantity(quantity)}${unit === 'each' ? ' quả' : ' ' + unit}`
}
