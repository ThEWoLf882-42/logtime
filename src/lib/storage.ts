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
export function validTarget(value: string) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 1 && number <= 999 ? number : 100
}
