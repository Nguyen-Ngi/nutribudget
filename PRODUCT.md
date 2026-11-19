# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React, TypeScript, and Vite.

## Users

University students managing a home-cooking budget. The first prototype is for a student startup competition.

## Product Purpose

Help students choose affordable, nutritious meals, compare grocery shopping options, and keep track of ingredients and remaining budget.

## Capabilities and Constraints

- Students enter a home-cooking budget, a flexible number of days, and an optional start date. Ingredient price data informs budget allocation.
- Students choose individual dishes from an extensible, structured recipe database. Daily schedules and portions are flexible. Recipes do not offer direct ingredient substitutions.
- Shopping compares sourced merchandise prices for complete baskets with equivalent products and quantities. Shopping confirmation uses clearly labeled estimates. Price-driven plan changes require user confirmation.
- Inventory combines manual entries, confirmed purchases, and cooking consumption.
- The app uses deterministic algorithms. The prototype runs in the browser and stores budget data locally. AI integrations, machine learning, and scraping are outside the prototype scope.
- The prototype includes budget setup, a remaining balance, a manual grocery expense ledger, period history, and Vietnamese meal planning, shopping, pantry tracking, and cooking confirmation.

## Budget accounting

One period is open at a time. Dates are inclusive and use the device’s local calendar. Starting a new period early requires confirmation and archives the current period with its original dates and linked expenses. Periods keep their chosen date ranges, including any overlap after an early replacement.

The planning buffer is a percentage of the starting total, including approved carry-over. It stays in the remaining balance. Only the positive recorded balance from the immediately preceding completed period can carry forward. The new period records explicit approval and retains the estimated status of the source balance.

Only recorded grocery expenses change the balance. Manual entries can use an estimated or verified price. A shopping confirmation uses a stable purchase reference and saves the estimated expense, purchase record, and inventory movement together. Recipe selection and forecasts leave the ledger unchanged.


## Meal planning

Lunch and dinner start enabled. Students choose any number of individual dishes for each date and slot, set each dish’s servings in half-portion steps, and explicitly save or clear the meal. Saved meals with a shared serving count still use that count for each dish. Shopping, forecasts, and cooking round shared ingredient totals up once per meal to whole pantry units. Previously paused selections stay paused until the user explicitly saves them for use. Archived budgets keep their meal selections. Budget date edits protect linked expenses, confirmed meals, and cooking records. Meals already outside the period from earlier edits stay visible in Planned meals.

The dish catalog uses search, categories, and optional diet and allergen filters. Individual dish estimates are illustrative. Saving meals does not change expenses or inventory.

## Shopping and pantry

Shopping automatically offsets future saved meals against pantry stock and compares complete baskets using whole-pack public price snapshots within a 30-day review window. Comparability requires the same products, pack sizes, and pack counts. With an optional public shopping-area landmark, verified branches can contribute approximate straight-line distance and store count. Up to three distinct options can surface when the evidence supports a price, convenience, or balance recommendation. Unknown delivery and travel fees are excluded from new estimates. Recorded fees remain attached to older plans and purchases.

After approval, Shopping shows a checklist grouped by retailer and selected branch where available. Checking an item records the purchase, its estimated expense, and the pantry addition together. A changed meal or pantry shortage can trigger a list update that starts from remaining requirements and preserves prior purchases.

When any required item lacks a usable price, Shopping lists the missing ingredients and quantities. New checkout plans require complete priced coverage. Previously saved unpriced or expired lines can be refreshed from the current catalog. Approval preserves the chosen retailer, quantities, and available source evidence. Completed purchases keep their historical source and amount.

Pantry tracks raw stock in whole grams, milliliters, or pieces and persists across budgets. Tap water is an untracked household supply. Stock corrections record a reason. Cooking checks and deducts all tracked recipe quantities, records the original meal and budget, and locks that meal against edits. Cooking on an active budget may be confirmed ahead of the scheduled meal date. Past meals can be cooked from existing pantry stock or stock added manually. They are outside the upcoming shopping list.

The existing budget storage key holds the versioned kitchen journal alongside the ledger. One localStorage write commits a purchase and its matching expense. Failed writes retain the previous snapshot. On read, the journal is checked against its purchase expenses and stock history. Unreadable budget, kitchen, or meal storage is preserved. Affected writes pause until the saved data can be read. For invalid kitchen records, the accessible budget history remains visible. Web Locks serialize budget and meal writes when available.
