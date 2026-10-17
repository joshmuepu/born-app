/**
 * Quick-start services (P-12): a few well-known passages already lined up, so a first service (or a funeral at short notice) starts with something real in
 * the queue. Public-domain King James readings; the operator adds the songs and the sermon. Plain data: the app resolves each reference like any other verse.
 */
export interface ServiceTemplate {
  id: string
  name: string
  /** one line, shown under the name */
  about: string
  readings: Array<{ label: string; reference: string }>
  /** what is left for the operator to add (said in the toast) */
  addNext: string
}

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    id: 'sunday',
    name: 'Sunday morning',
    about: 'A call to worship, the Lord’s Prayer and the benediction',
    readings: [
      { label: 'Call to worship', reference: 'Psalm 100:1-5' },
      { label: 'The Lord’s Prayer', reference: 'Matthew 6:9-13' },
      { label: 'Benediction', reference: 'Numbers 6:24-26' }
    ],
    addNext: 'Add the songs and the sermon next.'
  },
  {
    id: 'midweek',
    name: 'Midweek',
    about: 'Two short readings to open and close',
    readings: [
      { label: 'Opening reading', reference: 'Psalm 23:1-6' },
      { label: 'Closing reading', reference: 'Numbers 6:24-26' }
    ],
    addNext: 'Add a song and the teaching next.'
  },
  {
    id: 'funeral',
    name: 'Funeral or memorial',
    about: 'The readings most often asked for',
    readings: [
      { label: 'Psalm 23', reference: 'Psalm 23:1-6' },
      { label: 'The Father’s house', reference: 'John 14:1-6' },
      { label: 'Comfort', reference: '1 Thessalonians 4:13-18' },
      { label: 'A new heaven', reference: 'Revelation 21:1-4' }
    ],
    addNext: 'Add the hymns and the photos next.'
  }
]

export const templateById = (id: string): ServiceTemplate | undefined => SERVICE_TEMPLATES.find((t) => t.id === id)
