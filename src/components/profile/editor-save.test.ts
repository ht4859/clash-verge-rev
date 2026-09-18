import * as yaml from 'js-yaml'
import { isValidElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EditorViewer } from './editor-viewer'
import { GroupsEditorViewer } from './groups-editor-viewer'
import { ProfileMore } from './profile-more'
import { ProxiesEditorViewer } from './proxies-editor-viewer'
import { RulesEditorViewer } from './rules-editor-viewer'

const mocks = vi.hoisted(() => ({
  state: new Map<number, unknown>(),
  cursor: 0,
  pending: Promise.resolve<unknown>(undefined),
  save: vi.fn(),
  read: vi.fn(),
  reload: vi.fn(),
  markSaved: vi.fn(),
  error: vi.fn(),
}))

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: (initial: unknown) => {
    const index = mocks.cursor++
    if (!mocks.state.has(index)) {
      mocks.state.set(
        index,
        typeof initial === 'function' ? initial() : initial,
      )
    }
    return [
      mocks.state.get(index),
      (value: unknown) => mocks.state.set(index, value),
    ]
  },
  useRef: (current: unknown) => ({ current }),
  useMemo: (calculate: () => unknown) => calculate(),
  useCallback: (callback: unknown) => callback,
  useEffect: () => {},
}))
vi.mock('ahooks', () => ({
  useLockFn: (callback: () => unknown) => () => {
    mocks.pending = Promise.resolve(callback())
    return mocks.pending
  },
}))
vi.mock('@mui/material', () => ({
  Autocomplete: 'Autocomplete',
  Box: 'Box',
  Badge: 'Badge',
  Button: 'Button',
  ButtonGroup: 'ButtonGroup',
  Chip: 'Chip',
  Dialog: 'Dialog',
  DialogActions: 'DialogActions',
  DialogContent: 'DialogContent',
  DialogTitle: 'DialogTitle',
  IconButton: 'IconButton',
  InputAdornment: 'InputAdornment',
  List: 'List',
  ListItem: 'ListItem',
  ListItemText: 'ListItemText',
  Menu: 'Menu',
  MenuItem: 'MenuItem',
  TextField: 'TextField',
  Typography: 'Typography',
  styled: (component: unknown) => () => component,
}))
vi.mock('@mui/icons-material', () => ({
  CloseFullscreenRounded: 'Icon',
  ContentPasteRounded: 'Icon',
  FeaturedPlayListRounded: 'Icon',
  FormatPaintRounded: 'Icon',
  OpenInFullRounded: 'Icon',
  RestartAltRounded: 'Icon',
  VerticalAlignBottomRounded: 'Icon',
  VerticalAlignTopRounded: 'Icon',
}))
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({}),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('react-hook-form', () => ({
  Controller: 'Controller',
  useForm: () => ({ control: {} }),
}))
vi.mock('@/components/base', () => ({
  BaseSearchBox: 'BaseSearchBox',
  BaseLoadingOverlay: 'BaseLoadingOverlay',
  MonacoEditor: 'MonacoEditor',
  Switch: 'Switch',
}))
vi.mock('@/services/cmds', () => ({
  readProfileFile: mocks.read,
  saveProfileFile: mocks.save,
  getNetworkInterfaces: vi.fn(),
  viewProfile: vi.fn(),
}))
vi.mock('@/services/notice-service', () => ({
  showNotice: { success: vi.fn(), error: mocks.error },
}))
vi.mock('@/services/states', () => ({ useThemeMode: () => 'light' }))
vi.mock('@/hooks/use-editor-document', () => ({
  useEditorDocument: () => ({
    value: 'draft: [',
    savedValue: 'old: true',
    loading: false,
    dirty: true,
    setValue: vi.fn(),
    reload: mocks.reload,
    markSaved: mocks.markSaved,
  }),
}))
vi.mock('./rule-item', () => ({ RuleItem: 'RuleItem' }))
vi.mock('./proxy-item', () => ({ ProxyItem: 'ProxyItem' }))
vi.mock('./group-item', () => ({ GroupItem: 'GroupItem' }))
vi.mock('./profile-box', () => ({ ProfileBox: 'ProfileBox' }))
vi.mock('./log-viewer', () => ({ LogViewer: 'LogViewer' }))
vi.mock('./grouped-virtual-list', () => ({
  buildGroupedItems: () => [],
  GroupedVirtualList: 'GroupedVirtualList',
}))

function findElement(
  node: ReactNode,
  type: unknown,
  label?: string,
): Record<string, unknown> {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, type, label)
      if (found.onClick || found.onSave) return found
    }
  } else if (isValidElement<Record<string, unknown>>(node)) {
    if (node.type === type && (!label || node.props.children === label))
      return node.props
    return findElement(node.props.children as ReactNode, type, label)
  }
  return {}
}

async function click(tree: ReactNode, label: string) {
  const button = findElement(tree, 'Button', label)
  expect(button.onClick).toBeTypeOf('function')
  ;(button.onClick as () => void)()
  await mocks.pending
}

beforeEach(() => {
  mocks.state.clear()
  mocks.cursor = 0
  mocks.pending = Promise.resolve()
  vi.clearAllMocks()
  vi.stubGlobal('document', { documentElement: { clientWidth: 1000 } })
})

afterEach(() => vi.unstubAllGlobals())

describe.each([
  {
    name: 'rules',
    Component: RulesEditorViewer,
    sequenceIndex: 12,
    item: 'DOMAIN,new.example,DIRECT',
  },
  {
    name: 'proxies',
    Component: ProxiesEditorViewer,
    sequenceIndex: 6,
    item: { name: 'new', type: 'direct' },
  },
  {
    name: 'groups',
    Component: GroupsEditorViewer,
    sequenceIndex: 8,
    item: { name: 'new', type: 'select', proxies: ['DIRECT'] },
  },
])('$name editor', ({ Component, sequenceIndex, item }) => {
  function render(visual: boolean) {
    mocks.state.set(0, 'old: true')
    mocks.state.set(1, 'draft: source')
    mocks.state.set(2, visual)
    mocks.state.set(sequenceIndex, [item])
    mocks.state.set(sequenceIndex + 1, [])
    mocks.state.set(sequenceIndex + 2, ['deleted'])
    const onClose = vi.fn()
    const onSave = vi.fn()
    const tree = Component({
      open: true,
      profileUid: 'profile',
      property: 'sequence',
      mergeUid: 'merge',
      groupsUid: 'groups',
      proxiesUid: 'proxies',
      onClose,
      onSave,
    })
    return { tree, onClose, onSave }
  }

  it.each([false, true])(
    'keeps the visual snapshot when validation returns %s',
    async (valid) => {
      mocks.save.mockResolvedValue(valid)
      const { tree, onClose, onSave } = render(true)
      await click(tree, 'shared.actions.save')
      expect(yaml.load(mocks.save.mock.calls[0][1])).toEqual({
        prepend: [item],
        append: [],
        delete: ['deleted'],
      })
      expect(mocks.read).not.toHaveBeenCalled()
      expect(onClose).toHaveBeenCalledTimes(valid ? 1 : 0)
      expect(onSave).toHaveBeenCalledTimes(valid ? 1 : 0)
      expect(mocks.error).not.toHaveBeenCalled()
    },
  )

  it('preserves a rejected source draft', async () => {
    mocks.save.mockResolvedValue(false)
    const { tree, onClose } = render(false)
    await click(tree, 'shared.actions.save')
    expect(mocks.save).toHaveBeenCalledWith('sequence', 'draft: source')
    expect(mocks.state.get(1)).toBe('draft: source')
    expect(mocks.read).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('flushes visual changes before opening source mode', async () => {
    const { tree } = render(true)
    await click(tree, 'shared.editorModes.advanced')
    expect(yaml.load(mocks.state.get(1) as string)).toEqual({
      prepend: [item],
      append: [],
      delete: ['deleted'],
    })
    expect(mocks.state.get(2)).toBe(false)
  })
})

describe('EditorViewer save result', () => {
  it.each([false, true])(
    'preserves the global draft unless validation returns true (%s)',
    async (valid) => {
      mocks.save.mockResolvedValue(valid)
      mocks.state.set(2, true)
      const globalEditor = ProfileMore({ id: 'Merge' })
      const props = findElement(globalEditor, EditorViewer)
      const onClose = vi.fn()
      mocks.state.clear()
      mocks.cursor = 0
      const tree = EditorViewer({
        open: true,
        value: 'draft: [',
        language: 'yaml',
        path: 'test',
        onSave: props.onSave as () => Promise<boolean>,
        onClose,
      })
      await click(tree, 'shared.actions.save')
      expect(mocks.reload).not.toHaveBeenCalled()
      expect(mocks.markSaved).toHaveBeenCalledTimes(valid ? 1 : 0)
      expect(onClose).toHaveBeenCalledTimes(valid ? 1 : 0)
    },
  )

  it('still closes after a legacy Promise<void> save', async () => {
    const onSave = vi.fn(async (): Promise<void> => {})
    const onClose = vi.fn()
    const tree = EditorViewer({
      open: true,
      value: '',
      language: 'css',
      path: 'theme',
      onSave,
      onClose,
    })
    await click(tree, 'shared.actions.save')
    expect(onSave).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })
})
