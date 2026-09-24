/**
 * «5,9 млн», «250 тыс», «50000», «50 000», «1.2m», «300k» → число.
 * Пусто или мусор — null.
 */
export function parseHumanAmount(text) {
  const raw = String(text ?? '').toLowerCase().replaceAll(/\s/g, '').replace(',', '.')
  if (!raw) return null
  const match = /^(\d+(?:\.\d+)?)(млн|млрд|тыс\.?|m|k|м|к|т)?$/.exec(raw)
  if (!match) return null
  const multipliers = { млн: 1e6, m: 1e6, м: 1e6, млрд: 1e9, тыс: 1e3, 'тыс.': 1e3, k: 1e3, к: 1e3, т: 1e3 }
  return Number(match[1]) * (multipliers[match[2]] || 1)
}
