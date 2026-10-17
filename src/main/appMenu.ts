/**
 * appMenu.ts — BORN's own application menu. Electron's default menu has View → Reload / Force Reload / Toggle Developer Tools / Zoom In / Zoom Out and a Help menu that opens
 * Electron's website: a volunteer's stray Ctrl+R reloaded the operator window mid-service, and browser zoom is shared with the projector (interface size is CSS zoom here, on purpose).
 * This menu keeps what people really use (Edit, full screen, window, Quit) and sends Help / Shortcuts to the app's own screens. Reload and Developer Tools exist only in a development run.
 */
import { app, Menu, type MenuItemConstructorOptions } from 'electron'

export function buildAppMenuTemplate(o: { packaged: boolean; platform: NodeJS.Platform; appName: string; send: (action: 'help' | 'shortcuts') => void }): MenuItemConstructorOptions[] {
  const mac = o.platform === 'darwin'
  const t: MenuItemConstructorOptions[] = []
  if (mac) t.push({ label: o.appName, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] })
  t.push({ label: 'File', submenu: [{ role: mac ? 'close' : 'quit' }] })
  t.push({ label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] })
  const view: MenuItemConstructorOptions[] = [{ role: 'togglefullscreen' }]
  if (!o.packaged) view.push({ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' })
  t.push({ label: 'View', submenu: view })
  t.push({ label: 'Window', submenu: mac ? [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }] : [{ role: 'minimize' }, { role: 'close' }] })
  t.push({ role: 'help', submenu: [{ label: 'Open the manual', click: () => o.send('help') }, { label: 'Keyboard shortcuts', click: () => o.send('shortcuts') }] })
  return t
}

export function installAppMenu(send: (action: 'help' | 'shortcuts') => void): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildAppMenuTemplate({ packaged: app.isPackaged, platform: process.platform, appName: app.name, send })))
}
