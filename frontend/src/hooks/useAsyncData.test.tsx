// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useAsyncData } from './useAsyncData'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

type Key = 'first' | 'second'

describe('useAsyncData', () => {
  it('reports loading, then the loaded data', async () => {
    const request = deferred<string>()
    const { result } = renderHook(() => useAsyncData('key', () => request.promise))

    expect(result.current).toMatchObject({ status: 'loading', data: undefined })
    await act(async () => request.resolve('hello'))

    expect(result.current).toMatchObject({ status: 'ready', data: 'hello' })
  })

  it('keeps showing the previous data while new data loads', async () => {
    const requests = { first: deferred<string>(), second: deferred<string>() }
    const { result, rerender } = renderHook(({ key }: { key: Key }) => useAsyncData(key, () => requests[key].promise), {
      initialProps: { key: 'first' },
    })
    await act(async () => requests.first.resolve('first result'))

    rerender({ key: 'second' })

    expect(result.current).toMatchObject({ status: 'loading', data: 'first result' })
    await act(async () => requests.second.resolve('second result'))
    expect(result.current).toMatchObject({ status: 'ready', data: 'second result' })
  })

  it('ignores a slow response for a request that is no longer current', async () => {
    const requests = { first: deferred<string>(), second: deferred<string>() }
    const { result, rerender } = renderHook(({ key }: { key: Key }) => useAsyncData(key, () => requests[key].promise), {
      initialProps: { key: 'first' },
    })

    rerender({ key: 'second' })
    await act(async () => requests.second.resolve('second result'))
    await act(async () => requests.first.resolve('late first result'))

    expect(result.current).toMatchObject({ status: 'ready', data: 'second result' })
  })

  it('reports a friendly error and loads again on retry', async () => {
    let attempts = 0
    const { result } = renderHook(() =>
      useAsyncData('key', () => {
        attempts += 1
        return attempts === 1 ? Promise.reject(new Error('boom')) : Promise.resolve('recovered')
      }),
    )
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('Something went wrong. Please try again.')
    expect(result.current.errorCode).toBe('UNKNOWN_ERROR')

    act(() => result.current.retry())

    await waitFor(() => expect(result.current).toMatchObject({ status: 'ready', data: 'recovered' }))
    expect(attempts).toBe(2)
  })
})
