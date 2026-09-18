import { selectNodeForGroup } from 'tauri-plugin-mihomo-api'
import { expect, test, vi } from 'vitest'

import { useProxySelection as createProxySelection } from './use-proxy-selection'

vi.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useRef: (current: unknown) => ({ current }),
}))

vi.mock('tauri-plugin-mihomo-api', () => ({
  selectNodeForGroup: vi.fn(async () => {}),
  unfixedProxy: vi.fn(),
  getConnections: vi.fn(),
  closeConnection: vi.fn(),
}))

vi.mock('@/hooks/use-record-selection', () => ({
  useRecordSelection: () => async () => {},
  useForgetSelection: () => async () => {},
}))

vi.mock('@/hooks/use-verge', () => ({
  useVerge: () => ({ verge: {} }),
}))

vi.mock('@/services/cmds', () => ({
  syncTrayProxySelection: async () => {},
}))

test('preserves each pending group while coalescing repeated choices in that group', async () => {
  let releaseFirst = () => {}
  const firstRequest = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  vi.mocked(selectNodeForGroup).mockImplementationOnce(() => firstRequest)
  const { changeProxy } = createProxySelection()

  changeProxy('A', 'a')
  changeProxy('B', 'b1')
  changeProxy('C', 'c')
  changeProxy('B', 'b2')
  expect(selectNodeForGroup).toHaveBeenCalledTimes(1)

  releaseFirst()
  await vi.waitFor(() => {
    expect(selectNodeForGroup).toHaveBeenCalledTimes(3)
  })
  expect(vi.mocked(selectNodeForGroup).mock.calls).toEqual([
    ['A', 'a'],
    ['B', 'b2'],
    ['C', 'c'],
  ])
})
