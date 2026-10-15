/** The Born Again mark: the v1 flame, renewed. Concept A of the design pass
 *  (docs/design/logo). Uses currentColor for the flame so it themes; the inner
 *  drop uses the surface colour passed in `drop`. */
export default function BornMark({
  size = 24,
  drop = 'var(--bg-secondary)'
}: {
  size?: number
  drop?: string
}): JSX.Element {
  return (
    <svg
      className="born-mark"
      width={size}
      height={size}
      viewBox="-30 -40 60 80"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M0,-36 C4,-22 24,-10 24,8 C24,23 13,33 0,33 C-13,33 -24,23 -24,8 C-24,-2 -19,-10 -13,-17 C-12,-9 -8,-5 -4,-6 C-6,-17 -5,-28 0,-36 Z"
        fill="currentColor"
      />
      <path
        d="M0,8 C5,14 9,18 9,22 C9,26 5,29 0,29 C-5,29 -9,26 -9,22 C-9,18 -4,14 0,8 Z"
        fill={drop}
      />
    </svg>
  )
}
