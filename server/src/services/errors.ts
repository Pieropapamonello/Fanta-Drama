export function isFirestoreQuotaError(error: unknown) {
  const value = error as { code?: unknown; message?: unknown; details?: unknown }
  return Number(value?.code) === 8 || /RESOURCE_EXHAUSTED|Quota exceeded/i.test(`${value?.message ?? ''} ${value?.details ?? ''}`)
}

export function runInBackground(task: Promise<unknown>, label: string) {
  void task.catch((error) => {
    if (isFirestoreQuotaError(error)) console.warn(`${label} skipped: Firestore quota exhausted.`)
    else console.error(`${label} failed`, error)
  })
}
