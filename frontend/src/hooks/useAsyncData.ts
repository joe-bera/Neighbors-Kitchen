import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { getApiError } from '../utils/apiError'

export interface AsyncData<T> {
  status: 'loading' | 'ready' | 'error'
  /** The latest loaded data. While new data loads, this still holds the previous result. */
  data: T | undefined
  error: string | null
  /** The API error code, such as 'NOT_FOUND' or 'NETWORK_ERROR'. */
  errorCode: string | null
  retry: () => void
}

interface Result<T> {
  key: string
  attempt: number
  data?: T
  error?: { code: string; message: string }
}

/**
 * Loads data with `loader` and loads again whenever `key` changes (for example, when filters change).
 * Answers that arrive for an out-of-date key are ignored, so fast typing never shows stale results.
 */
export function useAsyncData<T>(key: string, loader: () => Promise<T>): AsyncData<T> {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result<T> | null>(null)
  const load = useEffectEvent(loader)

  useEffect(() => {
    let cancelled = false
    load().then(
      (data) => {
        if (!cancelled) setResult({ key, attempt, data })
      },
      (error: unknown) => {
        if (!cancelled) {
          setResult((previous) => ({ key, attempt, data: previous?.data, error: getApiError(error) }))
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [key, attempt])

  // Stable between renders, so it can be used in effects (e.g. polling).
  const retry = useCallback(() => setAttempt((count) => count + 1), [])

  const isCurrent = result !== null && result.key === key && result.attempt === attempt
  const error = isCurrent ? result.error : undefined
  return {
    status: !isCurrent ? 'loading' : error ? 'error' : 'ready',
    data: result?.data,
    error: error?.message ?? null,
    errorCode: error?.code ?? null,
    retry,
  }
}
