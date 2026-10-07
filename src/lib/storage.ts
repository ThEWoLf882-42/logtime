export function readSetting(key: string, fallback = '') {
  try {
    return localStorage.getItem(`logtime.${key}`) ?? fallback
  } catch {
    return fallback
  }
}
export function saveSetting(key: string, value: string) {
  try {
    localStorage.setItem(`logtime.${key}`, value)
  } catch {
    /* Browsing still works when storage is disabled. */
  }
}
// Required hours per cycle until someone sets their own.
export const DEFAULT_TARGET = 120

export function validTarget(value: string) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 1 && number <= 999
    ? number
    : DEFAULT_TARGET
}
