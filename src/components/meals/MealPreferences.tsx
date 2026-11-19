import { allergens } from '../../types/meals'
import type { Diet, MealPreferences as Preferences } from '../../types/meals'
import { allergenLabels } from './labelsVi'
import { defaultPreferences } from '../../algorithms/mealRecipes'

const diets: [Diet, string][] = [
  ['any', 'Mọi chế độ ăn'], ['vegetarian', 'Ăn chay'], ['vegan', 'Thuần chay'], ['no pork', 'Không ăn thịt heo'], ['no beef', 'Không ăn thịt bò'],
]

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((value) => value !== item) : [...list, item]
}

export function MealPreferences({ preferences, onChange }: {
  preferences: Preferences
  onChange: (value: Preferences) => void
}) {
  return (
    <details className="meal-preferences">
      <summary>Chế độ ăn và dị ứng</summary>
      <div className="meal-preference-body">
        <label className="meal-field">
          <span>Chế độ ăn</span>
          <select value={preferences.diet} onChange={(event) => onChange({ ...preferences, diet: event.target.value as Diet })}>
            {diets.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <fieldset>
          <legend>Loại thành phần gây dị ứng</legend>
          <div className="meal-checks">
            {allergens.map((item) => (
              <label key={item}>
                <input type="checkbox" checked={preferences.allergens.includes(item)}
                  onChange={() => onChange({ ...preferences, allergens: toggle(preferences.allergens, item) })} />
                <span>{allergenLabels[item]}</span>
              </label>
            ))}
          </div>
          <p className="section-note">Kiểm tra thành phần trước khi chọn món.</p>
        </fieldset>
        <button type="button" className="meal-text-button" onClick={() => onChange(defaultPreferences)}>Đặt lại bộ lọc</button>
      </div>
    </details>
  )
}
