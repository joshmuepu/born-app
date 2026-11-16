/** Counts how often a window's page stopped. A page that keeps stopping is started again only a few times a minute, so one that stops as soon as it
 *  loads cannot loop for ever. */
export class CrashGuard {
  private times: number[] = []
  constructor(
    private readonly max = 3,
    private readonly windowMs = 60_000,
    private readonly now: () => number = Date.now
  ) {}
  /** Records a stop; true if the page may be started again. */
  crashed(): boolean {
    const t = this.now()
    this.times = this.times.filter((x) => t - x < this.windowMs)
    this.times.push(t)
    return this.times.length <= this.max
  }
  /** The operator opened it again by hand: it gets its restarts back. */
  reset(): void {
    this.times = []
  }
}
