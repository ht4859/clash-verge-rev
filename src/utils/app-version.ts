import { version } from '@root/package.json'

export const displayVersion = version.replace(/^(\d+\.\d+)\.0$/, '$1')
