import { check } from '@tauri-apps/plugin-updater'
import { afterEach, expect, test, vi } from 'vitest'

import {
  updateLastCheckTime,
  useUpdate as readUpdate,
} from '@/hooks/use-update'

import { fetchCacheData, setCacheData, useQuery } from './query-client'
import { APP_UPDATES_ENABLED, checkUpdateSafe } from './update'

vi.mock('@root/src-tauri/tauri.conf.json', () => ({
  plugins: { updater: { endpoints: [] } },
}))
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }))
vi.mock('@/hooks/use-verge', () => ({
  useVerge: () => ({ verge: { auto_check_update: true } }),
}))
vi.mock('./query-client', () => ({
  useQuery: vi.fn(() => ({ data: { available: true }, isFetching: true })),
  fetchCacheData: vi.fn(),
  setCacheData: vi.fn(),
}))

afterEach(() => vi.unstubAllGlobals())

test('does not invoke the updater plugin when no update source is configured', async () => {
  expect(APP_UPDATES_ENABLED).toBe(false)
  expect(await checkUpdateSafe()).toBeNull()
  expect(check).not.toHaveBeenCalled()
})

test('disables queries and manual checks without changing the last check time', async () => {
  const setItem = vi.fn()
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => '12345'), setItem })
  const result = readUpdate()

  expect(
    vi.mocked(useQuery).mock.calls.every(([options]) => !options.enabled),
  ).toBe(true)
  expect(await result.checkUpdate()).toEqual({ data: null })
  expect(await vi.mocked(useQuery).mock.calls[0][0].queryFn()).toBeNull()
  expect(updateLastCheckTime()).toBeNull()
  expect(fetchCacheData).not.toHaveBeenCalled()
  expect(check).not.toHaveBeenCalled()
  expect(setCacheData).not.toHaveBeenCalled()
  expect(setItem).not.toHaveBeenCalled()
  expect(result.updateInfo).toBeNull()
  expect(result.loading).toBe(false)
  expect(result.lastCheckUpdate).toBeNull()
})
