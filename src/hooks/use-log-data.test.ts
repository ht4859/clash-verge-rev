import type { MihomoWebSocket } from 'tauri-plugin-mihomo-api'
import { expect, test, vi } from 'vitest'

import { getClashLogs } from '@/services/cmds'

import { useClashLog } from './use-clash-log'
import { useLogData as readLogData } from './use-log-data'
import { useMihomoWsSubscription } from './use-mihomo-ws-subscription'

vi.mock('./use-clash-log', () => ({ useClashLog: vi.fn() }))
vi.mock('@/services/cmds', () => ({ getClashLogs: vi.fn() }))
vi.mock('./use-mihomo-ws-subscription', () => ({
  useMihomoWsSubscription: vi.fn(() => ({
    response: { data: [] },
    refresh: vi.fn(),
    setData: vi.fn(),
  })),
}))

test('loads the new log level when remounting with an existing previous-level cache', async () => {
  const logs: ILogItem[] = [
    { type: 'debug', payload: 'debug message', time: '' },
    { type: 'error', payload: 'error message', time: '' },
  ]
  const snapshots = new Map<string, ILogItem[]>()
  vi.mocked(getClashLogs).mockResolvedValue(logs)

  const mount = async (logLevel: IClashLog['logLevel']) => {
    vi.mocked(useClashLog).mockReturnValue([
      { enable: true, logLevel, logFilter: 'all', logOrder: 'asc' },
      vi.fn(),
    ])
    readLogData()
    type Options = Parameters<typeof useMihomoWsSubscription<ILogItem[]>>[0]
    const options = vi
      .mocked(useMihomoWsSubscription)
      .mock.calls.at(-1)![0] as Options
    const key = options.buildSubscriptKey(12345)!
    const handlers = options.setupHandlers({
      next: (_error, update) => {
        const data =
          typeof update === 'function' ? update(snapshots.get(key)) : update
        if (data) snapshots.set(key, data)
      },
      scheduleReconnect: async () => {},
      isMounted: () => true,
    })
    await handlers.onConnected?.({} as MihomoWebSocket)
    handlers.cleanup?.()
    return snapshots.get(key)
  }

  expect(await mount('DEBUG')).toEqual(logs)
  expect(await mount('ERROR')).toEqual([logs[1]])
  expect(await mount('SILENT')).toEqual([])
})
