import { useSyncExternalStore } from 'react'
import { expect, test, vi } from 'vitest'

import delayManager from '@/services/delay'
import type { InteractableProxyMember } from '@/types/proxy-view'

import { useGroupsDelays as readGroupsDelays } from './use-group-delays'

vi.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useSyncExternalStore: vi.fn(),
}))

vi.mock('tauri-plugin-mihomo-api', () => ({
  delayProxyByName: vi.fn(async () => ({ delay: 120 })),
  healthcheckNodeInProvider: vi.fn(),
}))

test('keeps spaced group names intact in snapshots and subscriptions', async () => {
  const onSettle = vi.fn()
  let unsubscribe = () => {}
  vi.mocked(useSyncExternalStore).mockImplementation(
    (subscribe, getSnapshot) => {
      unsubscribe = subscribe(onSettle)
      return getSnapshot()
    },
  )
  const groups = ['US Proxy', 'US', 'Proxy', 'quote " and \\']
  const snapshot = readGroupsDelays(groups)
  const member: InteractableProxyMember = {
    kind: 'node',
    ref: { kind: 'node', name: 'node', recordId: 'node' },
    node: {
      recordId: 'node',
      name: 'node',
      type: 'Shadowsocks',
      alive: true,
      udp: false,
      xudp: false,
      tfo: false,
      mptcp: false,
      smux: false,
      history: [],
      source: { kind: 'core', proxyName: 'node' },
    },
  }

  try {
    expect([...snapshot.keys()]).toEqual(groups)
    expect(delayManager.groupsDelays(JSON.stringify(groups))).toBe(snapshot)
    await delayManager.checkDelay(member, 'US Proxy', 1000)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(onSettle).toHaveBeenCalledOnce()
    const nextSnapshot = delayManager.groupsDelays(JSON.stringify(groups))
    expect(nextSnapshot.get('US Proxy')).not.toBe(snapshot.get('US Proxy'))
    expect(nextSnapshot.get('US')).toBe(snapshot.get('US'))
  } finally {
    unsubscribe()
  }
})
