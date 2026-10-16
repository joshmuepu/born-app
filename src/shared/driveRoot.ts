/**
 * The removable/network "drive" a path lives on, or null for a place that is always there.
 * Windows: `E:\` or `\\server\share\`. macOS: `/Volumes/NAME`. Linux: `/media/user/NAME`, `/run/media/user/NAME`, `/mnt/NAME`.
 * Pure string work (no Node `path`), so the window can use it too, and it is tested for every platform on any machine.
 * C: is returned as well; callers treat a root that exists as "connected" and only a root that is absent as "not plugged in".
 */
export function driveRootOf(p: string, platform: string): string | null {
  if (platform === 'win32') {
    const d = /^([A-Za-z]):[\\/]/.exec(p)
    if (d) return `${d[1].toUpperCase()}:\\`
    const u = /^\\\\([^\\/?]+)\\([^\\/?]+)/.exec(p)
    if (u && u[1] !== '?') return `\\\\${u[1]}\\${u[2]}\\`
    return null
  }
  const parts = p.split('/').filter(Boolean)
  if (platform === 'darwin') return parts[0] === 'Volumes' && parts[1] ? `/Volumes/${parts[1]}` : null
  if (parts[0] === 'media' && parts[1] && parts[2]) return `/media/${parts[1]}/${parts[2]}`
  if (parts[0] === 'run' && parts[1] === 'media' && parts[2] && parts[3]) return `/run/media/${parts[2]}/${parts[3]}`
  if (parts[0] === 'mnt' && parts[1]) return `/mnt/${parts[1]}`
  return null
}

/** A friendly name for a drive root for messages ("E:", "the USB drive “YOUTH”", "\\server\share"). */
export function driveLabel(root: string): string {
  if (/^[A-Z]:\\$/.test(root)) return `drive ${root.slice(0, 2)}`
  if (root.startsWith('\\\\')) return `the network folder ${root.replace(/\\$/, '')}`
  const name = root.split('/').filter(Boolean).pop()
  return name ? `the drive “${name}”` : root
}
