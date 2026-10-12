// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ScreensMenu from '../../renderer/src/components/ScreensMenu'
import type { DisplayInfo } from '../../renderer/src/types'

const noop = (): void => {}
const baseDisplayInfo: DisplayInfo = {
  displays: [
    { id: 1, label: 'Built-in Display', shortLabel: 'Built-in Display (1920×1080)', name: null, isPrimary: true, isInternal: true },
    { id: 2, label: 'Projector', shortLabel: 'Projector (1920×1080)', name: null, isPrimary: false, isInternal: false }
  ],
  namedDisplays: [],
  targetId: 2,
  targetName: null,
  isFallback: false,
  isOverride: false,
  missingOverrideName: null,
  ambiguous: false,
  hasExternal: true,
  stageTargetId: null,
  stageTargetName: null,
  stageIsWindowed: true,
  stageIsOverride: false,
  stageMissingOverrideName: null,
  stageAmbiguous: false,
  stageClashesProjection: false
}

const baseProps = {
  displayInfo: baseDisplayInfo,
  projectionOpen: false,
  stageOpen: false,
  fontSize: 4.5,
  onToggleProjection: noop,
  onToggleStage: noop,
  onSetProjectionDisplay: noop,
  onSetStageDisplay: noop,
  onFontSize: noop,
  onRefreshDisplays: noop,
  onDisplayInfoChange: noop
}

/** Opens the "Screens" trigger button so the popover's contents render. */
function openMenu(): void {
  fireEvent.click(screen.getByRole('button', { name: /Screens/ }))
}

describe('ScreensMenu — stage display picker', () => {
  it('shows the stage screen picker before turning Stage on, same as Projection already does', () => {
    render(<ScreensMenu {...baseProps} />)
    openMenu()

    // Both role groups' "Automatic" row and the named display row should be
    // visible even though stageOpen is false — this used to be hidden for
    // Stage specifically until it was already on, with no way to pick a
    // screen ahead of time the way Projection always could.
    const automaticRows = screen.getAllByText('Automatic')
    expect(automaticRows.length).toBe(2) // one per role group
    expect(screen.getAllByText('Projector').length).toBeGreaterThan(0)
  })

  it('lets you pick a stage display before Stage is on', () => {
    const onSetStageDisplay = vi.fn()
    render(<ScreensMenu {...baseProps} onSetStageDisplay={onSetStageDisplay} />)
    openMenu()

    const projectorButtons = screen.getAllByText('Projector')
    // The second occurrence belongs to the Stage group (Projection renders first).
    fireEvent.click(projectorButtons[1])
    expect(onSetStageDisplay).toHaveBeenCalledWith(2)
  })

  it('warns up front that Automatic will float as a window when no spare screen is connected yet', () => {
    render(<ScreensMenu {...baseProps} />)
    openMenu()
    expect(
      screen.getByText(/will open a floating window instead/i)
    ).toBeInTheDocument()
  })

  it('still shows the plain "floating window" note once Stage is actually on', () => {
    render(<ScreensMenu {...baseProps} stageOpen={true} />)
    openMenu()
    expect(screen.getByText(/the stage monitor is a floating window you can move/i)).toBeInTheDocument()
  })

  it('warns about a clash before turning Stage on, not just after', () => {
    render(
      <ScreensMenu
        {...baseProps}
        displayInfo={{ ...baseDisplayInfo, stageClashesProjection: true, stageIsWindowed: false }}
      />
    )
    openMenu()
    expect(screen.getByText(/same screen as the projection/i)).toBeInTheDocument()
  })
})
