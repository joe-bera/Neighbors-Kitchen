/** Keeps the first meal from each chef (in the given order), so a featured row shows variety. */
export function pickOnePerChef<T extends { chef: { id: string } }>(meals: T[], limit: number): T[] {
  const seenChefs = new Set<string>()
  const picked: T[] = []
  for (const meal of meals) {
    if (picked.length === limit) break
    if (seenChefs.has(meal.chef.id)) continue
    seenChefs.add(meal.chef.id)
    picked.push(meal)
  }
  return picked
}
