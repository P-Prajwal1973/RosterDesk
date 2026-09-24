import { getShiftStartAndEndTimes } from '../../core/hospitalTime';
import type {
	Roster,
	RosterCell,
	RuleViolation,
	RuleSeverity,
	ShiftType,
	Staff,
} from './entites';

export interface StaffingRequirement {
	total: number;
	seniors: number;
}

export type StaffingRequirements = Record<Exclude<ShiftType, 'LEAVE'>, StaffingRequirement>;

export interface RuleOptions {
	timezone?: string;
	publish?: boolean;
	additionalCells?: RosterCell[];
}

const WORKING_SHIFTS: ReadonlyArray<Exclude<ShiftType, 'LEAVE'>> = ['D', 'E', 'N'];

function violation(
	ruleId: string,
	severity: RuleSeverity,
	message: string,
	staff?: Staff,
	date?: string
): RuleViolation {
	return {
		ruleId,
		severity,
		message,
		...(staff && { staffId: staff.id, staffName: staff.fullName }),
		...(date && { date }),
	};
}

function isWorkingShift(shift: ShiftType | null): shift is Exclude<ShiftType, 'LEAVE'> {
	return shift !== null && shift !== 'LEAVE';
}

function getStaffCells(cells: RosterCell[], staffId: string): RosterCell[] {
	return cells.filter((cell) => cell.staffId === staffId && cell.shift !== null);
}

function getShiftLabel(shift: Exclude<ShiftType, 'LEAVE'>): string {
	return shift === 'D' ? 'Day' : shift === 'E' ? 'Evening' : 'Night';
}

export function validateOneShiftPerDay(roster: Roster, staff: Staff[]): RuleViolation[] {
	const staffById = new Map(staff.map((person) => [person.id, person]));
	const violations: RuleViolation[] = [];

	for (const person of staff) {
		const cellsByDate = new Map<string, RosterCell[]>();
		for (const cell of getStaffCells(roster.cells, person.id)) {
			const cells = cellsByDate.get(cell.date) ?? [];
			cells.push(cell);
			cellsByDate.set(cell.date, cells);
		}

		for (const [date, cells] of cellsByDate) {
			if (cells.length > 1) {
				violations.push(violation(
					'R1',
					'ERROR',
					`${person.fullName} has more than one shift on ${date}`,
					staffById.get(person.id),
					date
				));
			}
		}
	}

	return violations;
}

export function validateMinimumRest(
	roster: Roster,
	staff: Staff[],
	timezone?: string,
	additionalCells: RosterCell[] = []
): RuleViolation[] {
	const violations: RuleViolation[] = [];
	const cells = [...roster.cells, ...additionalCells];

	for (const person of staff) {
		const shifts = getStaffCells(cells, person.id)
			.filter((cell): cell is RosterCell & { shift: Exclude<ShiftType, 'LEAVE'> } => isWorkingShift(cell.shift))
			.map((cell) => ({
				cell,
				times: getShiftStartAndEndTimes(cell.date, cell.shift, timezone),
			}))
			.sort((left, right) => left.times.start.getTime() - right.times.start.getTime());

		for (let index = 1; index < shifts.length; index += 1) {
			const previous = shifts[index - 1];
			const current = shifts[index];
			const restHours = (current.times.start.getTime() - previous.times.end.getTime()) / 3_600_000;

			if (restHours < 11) {
				violations.push(violation(
					'R2',
					'ERROR',
					`${person.fullName} has only ${formatHours(restHours)}h rest between ${getShiftLabel(previous.cell.shift)} (${previous.cell.date}) and ${getShiftLabel(current.cell.shift)} (${current.cell.date})`,
					person,
					current.cell.date
				));
			}
		}
	}

	return violations;
}

function formatHours(hours: number): string {
	return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

export function validateWeeklyHours(roster: Roster, staff: Staff[], timezone?: string): RuleViolation[] {
	const violations: RuleViolation[] = [];

	for (const person of staff) {
		const hours = getStaffCells(roster.cells, person.id)
			.filter((cell): cell is RosterCell & { shift: Exclude<ShiftType, 'LEAVE'> } => isWorkingShift(cell.shift))
			.reduce((total, cell) => {
				const times = getShiftStartAndEndTimes(cell.date, cell.shift, timezone);
				return total + (times.end.getTime() - times.start.getTime()) / 3_600_000;
			}, 0);

		if (hours > 48) {
			violations.push(violation('R3', 'ERROR', `${person.fullName} is scheduled for ${formatHours(hours)}h this week, exceeding the 48h limit`, person));
		} else if (hours > 40) {
			violations.push(violation('R3', 'WARNING', `${person.fullName} is scheduled for ${formatHours(hours)}h this week, exceeding 40h`, person));
		}
	}

	return violations;
}

export function validateIcuCertification(roster: Roster, staff: Staff[]): RuleViolation[] {
	if (roster.wardCode !== 'ICU') {
		return [];
	}

	const staffById = new Map(staff.map((person) => [person.id, person]));
	return roster.cells
		.filter((cell) => isWorkingShift(cell.shift))
		.flatMap((cell) => {
			const person = staffById.get(cell.staffId);
			if (!person || (person.icuCertExpiry !== null && person.icuCertExpiry > cell.date)) {
				return [];
			}

			return [violation(
				'R4',
				'ERROR',
				`${person.fullName} has no valid ICU certification for ${cell.date}`,
				person,
				cell.date
			)];
		});
}

export function validateApprovedLeave(roster: Roster, staff: Staff[]): RuleViolation[] {
	const staffById = new Map(staff.map((person) => [person.id, person]));
	return roster.cells
		.filter((cell) => isWorkingShift(cell.shift))
		.flatMap((cell) => {
			const person = staffById.get(cell.staffId);
			if (!person || !person.leaveDates.includes(cell.date)) {
				return [];
			}

			return [violation(
				'R5',
				'ERROR',
				`${person.fullName} is on approved leave on ${cell.date}`,
				person,
				cell.date
			)];
		});
}

export function validateConsecutiveNights(
	roster: Roster,
	staff: Staff[],
	timezone?: string,
	additionalCells: RosterCell[] = []
): RuleViolation[] {
	const violations: RuleViolation[] = [];
	const cells = [...roster.cells, ...additionalCells];

	for (const person of staff) {
		const nights = getStaffCells(cells, person.id)
			.filter((cell) => cell.shift === 'N')
			.map((cell) => ({ cell, start: getShiftStartAndEndTimes(cell.date, 'N', timezone).start }))
			.sort((left, right) => left.start.getTime() - right.start.getTime());
		let consecutiveNights = 0;

		for (let index = 0; index < nights.length; index += 1) {
			const previous = nights[index - 1];
			const current = nights[index];
			const isConsecutive = previous !== undefined && current.start.getTime() - previous.start.getTime() === 24 * 3_600_000;
			consecutiveNights = isConsecutive ? consecutiveNights + 1 : 1;

			if (consecutiveNights === 4) {
				violations.push(violation(
					'R6',
					'WARNING',
					`${person.fullName} has more than 3 consecutive Night shifts ending on ${current.cell.date}`,
					person,
					current.cell.date
				));
			}
		}
	}

	return violations;
}

export function validateCoverage(
	roster: Roster,
	staff: Staff[],
	requirements: StaffingRequirements,
	publish = false
): RuleViolation[] {
	const staffById = new Map(staff.map((person) => [person.id, person]));
	const dates = [...new Set(roster.cells.map((cell) => cell.date))];
	const violations: RuleViolation[] = [];

	for (const date of dates) {
		for (const shift of WORKING_SHIFTS) {
			const assigned = roster.cells.filter((cell) => cell.date === date && cell.shift === shift);
			const seniorCount = assigned.filter((cell) => staffById.get(cell.staffId)?.grade === 'SENIOR').length;
			const requirement = requirements[shift];

			if (assigned.length < requirement.total || seniorCount < requirement.seniors) {
				const gaps = [
					assigned.length < requirement.total ? `${requirement.total - assigned.length} nurse(s)` : '',
					seniorCount < requirement.seniors ? `${requirement.seniors - seniorCount} senior(s)` : '',
				].filter(Boolean).join(' and ');

				violations.push(violation(
					'R7',
					publish ? 'ERROR' : 'WARNING',
					`${roster.wardCode} has ${gaps} missing for ${getShiftLabel(shift)} on ${date}`,
					undefined,
					date
				));
			}
		}
	}

	return violations;
}

export function validateRoster(
	roster: Roster,
	staff: Staff[],
	requirements: StaffingRequirements,
	options: RuleOptions = {}
): RuleViolation[] {
	return [
		...validateOneShiftPerDay(roster, staff),
		...validateMinimumRest(roster, staff, options.timezone, options.additionalCells),
		...validateWeeklyHours(roster, staff, options.timezone),
		...validateIcuCertification(roster, staff),
		...validateApprovedLeave(roster, staff),
		...validateConsecutiveNights(roster, staff, options.timezone, options.additionalCells),
		...validateCoverage(roster, staff, requirements, options.publish),
	];
}
