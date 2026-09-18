import { useSyncExternalStore } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const connect = vi.hoisted(() => vi.fn())

vi.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useMemo: (factory: () => unknown) => factory(),
  useSyncExternalStore: vi.fn((_subscribe, getSnapshot) => getSnapshot()),
}))

vi.mock('tauri-plugin-mihomo-api', () => ({
  MihomoWebSocket: { connect_connections: connect },
}))

const sockets: Array<{
  send: (data: string) => void
  close: () => Promise<void>
}> = []
let unsubscribe = () => {}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'],
  })
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  vi.stubGlobal('window', { setTimeout, clearTimeout })
  sockets.length = 0
  connect.mockImplementation(async () => {
    let listener = (_message: { type: string; data: string }) => {}
    const socket = {
      addListener: (callback: typeof listener) => {
        listener = callback
      },
      send: (data: string) => listener({ type: 'Text', data }),
      close: vi.fn(async () => {}),
    }
    sockets.push(socket)
    return socket
  })
})

afterEach(() => {
  unsubscribe()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const mount = async () => {
  const { useConnectionData: readConnectionData } = await import(
    './use-connection-data'
  )
  readConnectionData()
  const [subscribe, getSnapshot] = vi
    .mocked(useSyncExternalStore)
    .mock.calls.at(-1)!
  unsubscribe = subscribe(() => {})
  await vi.advanceTimersByTimeAsync(0)
  return {
    read: () =>
      (getSnapshot() as { activeConnections: IConnectionsItem[] })
        .activeConnections[0],
    resume: async () => {
      unsubscribe = subscribe(() => {})
      await vi.advanceTimersByTimeAsync(0)
    },
  }
}

const sendSnapshot = (download: number) => {
  sockets.at(-1)!.send(
    JSON.stringify({
      connections: [
        { id: 'download', metadata: {}, chains: [], upload: 0, download },
      ],
    }),
  )
}

test('uses the interval between received samples, including a throttled flush', async () => {
  const { read } = await mount()
  sendSnapshot(0)
  await vi.advanceTimersByTimeAsync(400)
  sendSnapshot(400)
  await vi.advanceTimersByTimeAsync(100)
  expect(read().curDownload).toBe(1000)

  await vi.advanceTimersByTimeAsync(1900)
  sendSnapshot(2400)
  expect(read().curDownload).toBe(1000)
})

test('resets the first sample after resubscribing without discarding the connection', async () => {
  const { read, resume } = await mount()
  sendSnapshot(1000)
  unsubscribe()
  await vi.advanceTimersByTimeAsync(60_000)
  await resume()
  sendSnapshot(61_000)
  expect(read().id).toBe('download')
  expect(read().curDownload).toBe(0)

  await vi.advanceTimersByTimeAsync(2000)
  sendSnapshot(63_000)
  expect(read().curDownload).toBe(1000)
})

test('resets the first sample after a websocket reconnect', async () => {
  const { read } = await mount()
  sendSnapshot(1000)
  sockets[0].send('Websocket error: disconnected')
  await vi.advanceTimersByTimeAsync(1000)
  expect(sockets).toHaveLength(2)
  sendSnapshot(10_000)
  expect(read().curDownload).toBe(0)
})
