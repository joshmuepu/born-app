/**
 * getLocalDateTree — bucket sermon_index by calendar date, handling the
 * approximate date codes (YY-MM00, YY-0000) and the undated Church Age Book.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { initSchema } from '../../main/schema'
import { getLocalDateTree } from '../../main/browseLocal'

let db: Database.Database

const ROWS: Array<[number, string]> = [
  [1, '56-0101'], // Jan 1 1956
  [2, '56-0101E'], // Jan 1 1956, evening — same day, two services
  [3, '56-0219'], // Feb 19 1956
  [4, '56-0200'], // Feb 1956, day unknown
  [5, '56-0000'], // 1956, month unknown
  [6, '63-1201M'], // Dec 1 1963
  [7, 'CAB 01 - Revelation'], // undated
  [8, 'CAB 05 - Pergamean'] // undated
]

beforeAll(() => {
  db = new Database(':memory:')
  initSchema(db)
  const ins = db.prepare(
    'INSERT INTO sermon_index (id, date_code, title, para_count, duration_min, is_book) VALUES (?, ?, ?, 0, 0, 0)'
  )
  for (const [id, code] of ROWS) ins.run(id, code, `Sermon ${id}`)
})

afterAll(() => db.close())

describe('getLocalDateTree', () => {
  const tree = () => getLocalDateTree(db)

  it('groups years ascending with a full count', () => {
    const t = tree()
    expect(t.years.map((y) => y.year)).toEqual([1956, 1963])
    expect(t.years[0].count).toBe(5) // ids 1-5
    expect(t.years[1].count).toBe(1) // id 6
  })

  it('collects same-day services under one day cell', () => {
    const jan = tree().years[0].months.find((m) => m.month === 1)!
    expect(jan.days).toEqual([{ day: 1, ids: [1, 2] }])
  })

  it('keeps a day-unknown code in the month, not on a day', () => {
    const feb = tree().years[0].months.find((m) => m.month === 2)!
    expect(feb.days.map((d) => d.day)).toEqual([19])
    expect(feb.unknownDayIds).toEqual([4])
    expect(feb.count).toBe(2) // the Feb 19 sermon + the day-unknown one
  })

  it('keeps a month-unknown code on the year', () => {
    expect(tree().years[0].unknownMonthIds).toEqual([5])
  })

  it('puts CAB / undated codes in undatedIds', () => {
    expect(tree().undatedIds).toEqual([7, 8])
  })

  it('resolves 2-digit years into the 1900s', () => {
    expect(tree().years[1].months[0].month).toBe(12)
    expect(tree().years[1].months[0].days).toEqual([{ day: 1, ids: [6] }])
  })
})
