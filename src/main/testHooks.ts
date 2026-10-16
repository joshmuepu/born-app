/**
 * Dev/test-only environment hooks (BORN_TEST_*). They answer native pickers without a dialog so automated
 * runs can drive real flows. A packaged (installed) app NEVER honours them, so a stray variable on a church
 * PC cannot change what a button does.
 */
export function testHook(name: string, packaged: boolean, env: NodeJS.ProcessEnv = process.env): string {
  if (packaged) return ''
  const v = env[name]
  return typeof v === 'string' ? v : ''
}
