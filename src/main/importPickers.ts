/**
 * importPickers.ts — the file dialogs Songs > Import offers on this system. On Windows and Linux one dialog cannot pick files and folders together
 * (Electron then shows a folder chooser only, so a single .pro, .docx or .pdf could not be chosen); there the operator is asked which first.
 * macOS keeps the one dialog that does both.
 */
export type PickerProps = Array<'openFile' | 'openDirectory' | 'multiSelections'>
export function songImportPickers(platform: string): PickerProps[] {
  return platform === 'darwin' ? [['openFile', 'multiSelections', 'openDirectory']] : [['openFile', 'multiSelections'], ['openDirectory', 'multiSelections']]
}
