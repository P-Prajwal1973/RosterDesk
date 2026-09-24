import { describe, expect, it } from 'vitest';
import { validateApprovedLeave, validateConsecutiveNights, validateIcuCertification, validateMinimumRest, validateOneShiftPerDay, validateWeeklyHours } from './rules';
import type { Roster, Staff } from './entites';

const nurse: Staff = { id: 'nurse-1', fullName: 'Priya Sharma', grade: 'SENIOR', wardId: 'ICU', icuCertExpiry: '2027-01-01', leaveDates: [] };
const roster = (cells: Roster['cells']): Roster => ({ wardCode: 'ICU', isoWeek: '2026-W40', version: 1, published: false, cells });
const cell = (date: string, shift: 'D' | 'E' | 'N') => ({ cellId: `${date}-${shift}`, staffId: nurse.id, date, shift, version: 1 });

describe('roster domain rules', () => {
  it('detects duplicate shifts on a calendar day', () => expect(validateOneShiftPerDay(roster([cell('2026-09-28', 'D'), cell('2026-09-28', 'E')]), [nurse])).toHaveLength(1));
  it('detects less than eleven hours rest', () => expect(validateMinimumRest(roster([cell('2026-09-28', 'E'), cell('2026-09-29', 'D')]), [nurse])).toHaveLength(1));
  it('flags weekly hours above forty', () => expect(validateWeeklyHours(roster(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'].map((date) => cell(date, 'D'))), [nurse])).toHaveLength(1));
  it('rejects expired ICU certification', () => expect(validateIcuCertification(roster([cell('2027-01-02', 'D')]), [{ ...nurse, icuCertExpiry: '2027-01-01' }])).toHaveLength(1));
  it('detects approved leave conflicts', () => expect(validateApprovedLeave(roster([cell('2026-09-28', 'D')]), [{ ...nurse, leaveDates: ['2026-09-28'] }])).toHaveLength(1));
  it('warns after four consecutive nights', () => expect(validateConsecutiveNights(roster(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'].map((date) => cell(date, 'N'))), [nurse])).toHaveLength(1));
});
