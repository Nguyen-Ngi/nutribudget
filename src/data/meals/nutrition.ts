import type { Nutrition } from '../../types/meals.ts'

// Illustrative estimates per serving. These values are not lab measurements.
export const illustrativeNutrition: Readonly<Record<string, Nutrition | undefined>> = {
  'chao-ga': { calories: 338, protein: 21, carbs: 45, fat: 8 },
  'banh-mi-trung': { calories: 408, protein: 19, carbs: 47, fat: 16 },
  'xoi-dau-xanh': { calories: 442, protein: 17, carbs: 78, fat: 8 },
  'chao-bi-do': { calories: 319, protein: 13, carbs: 62, fat: 2 },
  'bun-xao-chay': { calories: 410, protein: 16, carbs: 64, fat: 11 },
  'com-trang': { calories: 271, protein: 5, carbs: 60, fat: 1 },
  'com-gao-lut': { calories: 276, protein: 6, carbs: 57, fat: 2 },
  'ga-kho-sa': { calories: 239, protein: 23, carbs: 8, fat: 12 },
  'thit-kho-trung': { calories: 294, protein: 23, carbs: 7, fat: 19 },
  'dau-hu-sot-ca': { calories: 203, protein: 15, carbs: 8, fat: 12 },
  'ca-kho': { calories: 150, protein: 25, carbs: 6, fat: 3 },
  'trung-chien': { calories: 194, protein: 13, carbs: 2, fat: 15 },
  'bo-xao': { calories: 249, protein: 24, carbs: 6, fat: 14 },
  'tom-rim': { calories: 158, protein: 21, carbs: 6, fat: 5 },
  'dau-xanh-kho-nam': { calories: 287, protein: 17, carbs: 43, fat: 6 },
  'rau-muong-xao': { calories: 76, protein: 4, carbs: 6, fat: 5 },
  'bap-cai-xao': { calories: 91, protein: 2, carbs: 10, fat: 5 },
  'canh-bi-do': { calories: 37, protein: 1, carbs: 9, fat: 0 },
  'dua-leo-tron': { calories: 41, protein: 1, carbs: 10, fat: 0 },
  'canh-ca-chua': { calories: 42, protein: 3, carbs: 8, fat: 0 },
  'nam-xao': { calories: 95, protein: 3, carbs: 10, fat: 5 },
}
