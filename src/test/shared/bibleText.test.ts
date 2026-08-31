import { describe, it, expect } from 'vitest'
import { stripMarginalNotes } from '../../shared/bibleText'

describe('stripMarginalNotes', () => {
  it('drops a trailing "Heb." gloss', () => {
    expect(
      stripMarginalNotes(
        'And they heard the voice of the LORD God walking in the garden in the cool of the day: and Adam and his wife hid themselves from the presence of the LORD God amongst the trees of the garden. cool: Heb. wind'
      )
    ).toBe(
      'And they heard the voice of the LORD God walking in the garden in the cool of the day: and Adam and his wife hid themselves from the presence of the LORD God amongst the trees of the garden.'
    )
  })

  it('drops a "Heb." gloss mid-sentence lemma (Genesis 3:6)', () => {
    expect(
      stripMarginalNotes(
        'And when the woman saw that the tree was good for food, and that it was pleasant to the eyes, and a tree to be desired to make one wise, she took of the fruit thereof, and did eat, and gave also unto her husband with her; and he did eat. pleasant: Heb. a desire'
      ).endsWith('and he did eat.')
    ).toBe(true)
  })

  it('drops several stacked glosses (Psalm 23:2)', () => {
    expect(
      stripMarginalNotes(
        'He maketh me to lie down in green pastures: he leadeth me beside the still waters. green: Heb. pastures of tender grass still: Heb. waters of quietness'
      )
    ).toBe('He maketh me to lie down in green pastures: he leadeth me beside the still waters.')
  })

  it('drops a "Gr." gloss', () => {
    expect(stripMarginalNotes('Even so faith, if it hath not works, is dead, being alone. alone: Gr. by itself')).toBe(
      'Even so faith, if it hath not works, is dead, being alone.'
    )
  })

  it('drops stacked "That is," alternative readings (Genesis 26:33)', () => {
    expect(
      stripMarginalNotes(
        'And he called it Shebah: therefore the name of the city is Beersheba unto this day. Shebah: That is, an oath Beersheba: that is, the well of the oath'
      )
    ).toBe('And he called it Shebah: therefore the name of the city is Beersheba unto this day.')
  })

  it('drops a short "or," alternative reading', () => {
    expect(
      stripMarginalNotes(
        'And the LORD God took the man, and put him into the garden of Eden to dress it and to keep it. the man: or, Adam'
      )
    ).toBe(
      'And the LORD God took the man, and put him into the garden of Eden to dress it and to keep it.'
    )
  })

  it('keeps a genuine "; or," clause that is real scripture (1 Kings 21:2, ASV)', () => {
    const real =
      'And Ahab spake unto Naboth, saying, Give me thy vineyard, that I may have it for a garden of herbs, because it is near unto my house; and I will give thee for it a better vineyard than it: or, if it seem good to thee, I will give thee the worth of it in money.'
    expect(stripMarginalNotes(real)).toBe(real)
  })

  it('leaves a clean verse untouched', () => {
    const clean = 'Jesus wept.'
    expect(stripMarginalNotes(clean)).toBe(clean)
  })

  it('leaves a verse with an internal colon untouched (Psalm 23:1)', () => {
    const v = 'The LORD is my shepherd: I shall not want.'
    expect(stripMarginalNotes(v)).toBe(v)
  })
})
