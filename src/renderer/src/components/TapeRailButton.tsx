import { Headphones } from 'lucide-react'
import { useTape } from '../useTape'

/** The "Tape" button of the left rail. It has its own small clock so only this button redraws once a second (a little equaliser while the tape plays). */
export default function TapeRailButton({ active, onClick }: { active: boolean; onClick: () => void }): JSX.Element {
  const { wire } = useTape(1000)
  const playing = wire?.status === 'playing'
  return (
    <button className={`rail-btn rail-btn--tape${active ? ' active' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined} title={playing ? 'Tape — playing' : 'Tape: recordings, follow-along, timing'}>
      <Headphones width={20} height={20} strokeWidth={1.9} aria-hidden="true" />
      <span>Tape</span>
      {playing && <span className="rail-eq" aria-label="The tape is playing"><i /><i /><i /></span>}
    </button>
  )
}
