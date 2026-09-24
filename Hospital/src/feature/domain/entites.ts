export type ShiftType = 'D' | 'E' | 'N' | 'LEAVE';

export type NurseGrade = 'SENIOR' | 'JUNIOR';

export type RuleSeverity = 'ERROR' | 'WARNING';

export interface RuleViolation {
  ruleId: string; 
  severity: RuleSeverity;
  staffId?: string;
  staffName?: string;
  date?: string; // 'YYYY-MM-DD'
  message: string; // explanation of the violation
}

export interface Staff {
  id: string;
  fullName: string;
  grade: NurseGrade;
  wardId: string;
  icuCertExpiry: string | null; // 'YYYY-MM-DD' or null
  leaveDates: string[]; // ['YYYY-MM-DD']
}

export interface RosterCell {
  cellId: string;
  staffId: string;
  date: string; // 'YYYY-MM-DD'
  shift: ShiftType | null;
  version: number;
}

export interface Roster {
  wardCode: string;
  isoWeek: string; // e.g., '2026-W39'
  version: number;
  published: boolean;
  cells: RosterCell[];
}

export interface ShiftDefinition {
  type: ShiftType;
  startTime: string; // 'HH:mm'
  endTime: string; // 'HH:mm'
  spansNextDay: boolean;
}

export const SHIFT_DEFINITIONS: Record<Exclude<ShiftType, 'LEAVE'>, ShiftDefinition> = {
  D: { type: 'D', startTime: '07:00', endTime: '15:00', spansNextDay: false },
  E: { type: 'E', startTime: '15:00', endTime: '23:00', spansNextDay: false },
  N: { type: 'N', startTime: '23:00', endTime: '07:00', spansNextDay: true },
};