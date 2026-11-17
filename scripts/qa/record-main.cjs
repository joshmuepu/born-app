/* QA helper (scripts only, never shipped), loaded with --require: native message boxes and links handed to the operating system are recorded in
 * <profile>/qa-main-events.json instead of being shown or opened. A message box answers with the number in <profile>/qa-dialog-answer (0 if none);
 * an open-file dialog answers with the paths in <profile>/qa-open-paths.json (cancelled if none). */
const { dialog, shell } = require('electron')
const fs = require('fs'), path = require('path')
const dir = process.env.BORN_USER_DATA_DIR
const file = path.join(dir, 'qa-main-events.json')
const rec = (e) => { let a = []; try { a = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { /* first */ } a.push(e); fs.writeFileSync(file, JSON.stringify(a)) }
dialog.showMessageBoxSync = (...args) => {
  const o = args.find((a) => a && typeof a === 'object' && 'message' in a)
  let answer = 0
  try { answer = Number(fs.readFileSync(path.join(dir, 'qa-dialog-answer'), 'utf8')) || 0 } catch { /* default */ }
  rec({ dialog: o ? o.message : '', answer, buttons: o ? o.buttons : null, defaultId: o ? o.defaultId : null, cancelId: o ? o.cancelId : null })
  return answer
}
shell.openExternal = async (u) => { rec({ openExternal: String(u) }) }
dialog.showOpenDialog = async (...args) => {
  const o = args.find((a) => a && typeof a === 'object' && 'properties' in a)
  let paths = []
  try { paths = JSON.parse(fs.readFileSync(path.join(dir, 'qa-open-paths.json'), 'utf8')) } catch { /* none */ }
  rec({ openDialog: o ? o.properties : null, paths })
  return { canceled: paths.length === 0, filePaths: paths }
}

