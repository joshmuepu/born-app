// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ScreensManager from '../../renderer/src/components/ScreensManager'
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
  onToggleProjection: noop,
  onToggleStage: noop,
  onSetProjectionDisplay: noop,
  onSetStageDisplay: noop,
  onRefreshDisplays: noop,
  onDisplayInfoChange: noop,
  outputs: [],
  onAddGraphicsOutput: noop,
  onRemoveOutput: noop,
  onSetOutputProfile: noop,
  onSetOutputAutoProfile: noop,
  onSetOutputSuppressed: noop,
  channels: [],
  availableTranslations: [],
  songbooks: [],
  onAddChannel: noop,
  onRemoveChannel: noop,
  onSetChannelTranslation: noop,
  onSetChannelSongbook: noop,
  onSetChannelSync: noop,
  onOpenChannel: noop,
  obsChannels: null,
  initialTab: 'displays' as const,
  onClose: noop
}

describe('ScreensManager — stage display picker', () => {
  it('shows the stage screen picker before turning Stage on, same as Congregation already does', () => {
    render(<ScreensManager {...baseProps} />)
    const automaticRows = screen.getAllByText('Automatic')
    expect(automaticRows.length).toBe(2) // one per role group
    expect(screen.getAllByText('Projector').length).toBeGreaterThan(0)
  })

  it('lets you pick a stage display before Stage is on', () => {
    const onSetStageDisplay = vi.fn()
    render(<ScreensManager {...baseProps} onSetStageDisplay={onSetStageDisplay} />)
    const projectorButtons = screen.getAllByText('Projector')
    // The second occurrence belongs to the Stage group (Congregation renders first).
    projectorButtons[1].click()
    expect(onSetStageDisplay).toHaveBeenCalledWith(2)
  })

  it('warns up front that Automatic will float as a window when no spare screen is connected yet', () => {
    render(<ScreensManager {...baseProps} />)
    expect(screen.getByText(/will open a floating window instead/i)).toBeInTheDocument()
  })

  it('still shows the plain "floating window" note once Stage is actually on', () => {
    render(<ScreensManager {...baseProps} stageOpen={true} />)
    expect(screen.getByText(/the stage monitor is a floating window you can move/i)).toBeInTheDocument()
  })

  it('warns about a clash before turning Stage on, not just after', () => {
    render(
      <ScreensManager
        {...baseProps}
        displayInfo={{ ...baseDisplayInfo, stageClashesProjection: true, stageIsWindowed: false }}
      />
    )
    expect(screen.getByText(/same screen as the projection/i)).toBeInTheDocument()
  })
})
