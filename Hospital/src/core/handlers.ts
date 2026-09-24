import type { Roster, RosterCell, ShiftType, Staff } from '../feature/domain/entites';

export interface Ward {
	code: string;
	name: string;
	color: string;
}

export interface SwapRequest {
	id: string;
	fromStaffId: string;
	toStaffId: string;
	wardCode: string;
	date: string;
	shift: Exclude<ShiftType, 'LEAVE'>;
	status: 'PENDING' | 'APPROVED' | 'REJECTED';
	reason?: string;
}

export interface StaffingRequirements {
	D: { total: number; seniors: number };
	E: { total: number; seniors: number };
	N: { total: number; seniors: number };
}

export const wards: Ward[] = [
	{ code: 'ICU', name: 'Intensive Care', color: '#e46a4b' },
	{ code: 'WARD-A', name: 'North Wing', color: '#2d8f87' },
	{ code: 'WARD-B', name: 'South Wing', color: '#d49a3a' },
];

export const requirementsByWard: Record<string, StaffingRequirements> = {
	ICU: { D: { total: 5, seniors: 2 }, E: { total: 4, seniors: 1 }, N: { total: 3, seniors: 1 } },
	'WARD-A': { D: { total: 4, seniors: 1 }, E: { total: 3, seniors: 1 }, N: { total: 2, seniors: 0 } },
	'WARD-B': { D: { total: 4, seniors: 1 }, E: { total: 3, seniors: 1 }, N: { total: 2, seniors: 0 } },
};

const staff: Staff[] = Array.from({ length: 15 }, (_, index) => {
	const ward = wards[index % wards.length];
	const firstNames = ['Priya', 'Arjun', 'Maya', 'Noah', 'Kavya', 'Ishaan', 'Anika', 'Rohan'];
	const lastNames = ['Sharma', 'Patel', 'Rao', 'Mehta', 'Singh', 'Nair'];
	return {
		id: `staff-${String(index + 1).padStart(3, '0')}`,
		fullName: `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / 8) % lastNames.length]}`,
		grade: index % 4 === 0 ? 'SENIOR' : 'JUNIOR',
		wardId: ward.code,
		icuCertExpiry: ward.code === 'ICU' ? (index % 7 === 0 ? '2026-10-07' : '2027-12-31') : null,
		leaveDates: index % 11 === 0 ? ['2026-09-29'] : [],
	};
});

const rosterStore = new Map<string, Roster>();
const swapStore: SwapRequest[] = [
	{ id: 'swap-1', fromStaffId: 'staff-001', toStaffId: 'staff-005', wardCode: 'ICU', date: '2026-09-29', shift: 'N', status: 'PENDING' },
	{ id: 'swap-2', fromStaffId: 'staff-004', toStaffId: 'staff-008', wardCode: 'WARD-A', date: '2026-09-30', shift: 'E', status: 'PENDING' },
	{ id: 'swap-3', fromStaffId: 'staff-010', toStaffId: 'staff-014', wardCode: 'WARD-B', date: '2026-10-01', shift: 'D', status: 'PENDING' },
];
const idempotencyResults = new Map<string, unknown>();
const STORAGE_KEY = 'rosterdesk-api-state';

function persistState(): void {
	if (typeof window === 'undefined') return;
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
		rosters: [...rosterStore.entries()],
		swaps: swapStore,
	}));
}

function restoreState(): void {
	if (typeof window === 'undefined') return;
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (!stored) return;
		const state = JSON.parse(stored) as { rosters?: Array<[string, Roster]>; swaps?: SwapRequest[] };
		state.rosters?.forEach(([key, roster]) => rosterStore.set(key, roster));
		if (state.swaps) {
			swapStore.splice(0, swapStore.length, ...state.swaps);
		}
	} catch {
		window.localStorage.removeItem(STORAGE_KEY);
	}
}

restoreState();

function wait<T>(value: T, signal?: AbortSignal, min = 180, max = 650): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = window.setTimeout(() => resolve(value), min + Math.floor(Math.random() * (max - min)));
		if (signal) {
			signal.addEventListener('abort', () => {
				window.clearTimeout(timer);
				reject(new DOMException('Request aborted', 'AbortError'));
			}, { once: true });
		}
	});
}

function weekDates(isoWeek: string): string[] {
	const [, weekText] = isoWeek.split('-W');
	const week = Number(weekText);
	const start = new Date(Date.UTC(2026, 8, 28 + (week - 40) * 7));
	return Array.from({ length: 7 }, (_, index) => {
		const date = new Date(start);
		date.setUTCDate(start.getUTCDate() + index);
		return date.toISOString().slice(0, 10);
	});
}

function rosterKey(wardCode: string, isoWeek: string): string {
	return `${wardCode}:${isoWeek}`;
}

function createRoster(wardCode: string, isoWeek: string): Roster {
	const dates = weekDates(isoWeek);
	const wardStaff = staff.filter((person) => person.wardId === wardCode).slice(0, 36);
	const cells: RosterCell[] = wardStaff.flatMap((person, personIndex) => dates.map((date, dayIndex) => ({
		cellId: `${person.id}-${date}`,
		staffId: person.id,
		date,
		shift: personIndex < 12 && (personIndex + dayIndex) % 5 !== 0 ? (['D', 'E', 'N'][(personIndex + dayIndex) % 3] as ShiftType) : null,
		version: 1,
	})));
	return { wardCode, isoWeek, version: 1, published: false, cells };
}

function getOrCreateRoster(wardCode: string, isoWeek: string): Roster {
	const key = rosterKey(wardCode, isoWeek);
	const current = rosterStore.get(key);
	if (current) return current;
	const created = createRoster(wardCode, isoWeek);
	rosterStore.set(key, created);
	return created;
}

function cloneRoster(roster: Roster): Roster {
	return { ...roster, cells: roster.cells.map((cell) => ({ ...cell })) };
}

export async function getWards(signal?: AbortSignal): Promise<Ward[]> {
	return wait(wards, signal);
}

export async function getStaff(wardCode: string, query = '', signal?: AbortSignal): Promise<Staff[]> {
	const normalized = query.trim().toLowerCase();
	const result = staff.filter((person) => person.wardId === wardCode && (!normalized || person.fullName.toLowerCase().includes(normalized)));
	const latency = normalized.length < 3 ? 900 : 260;
	return wait(result, signal, latency, latency + 120);
}

export async function getRoster(wardCode: string, isoWeek: string, signal?: AbortSignal): Promise<Roster> {
	return cloneRoster(await wait(getOrCreateRoster(wardCode, isoWeek), signal));
}

export async function updateRosterCell(cellId: string, shift: ShiftType | null, version: number, failNextWrite = false): Promise<RosterCell> {
	await wait(undefined, undefined, 300, 700);
	if (failNextWrite || Math.random() < 0.15) throw new Error('The server rejected this write. Try again.');
	for (const roster of rosterStore.values()) {
		const cell = roster.cells.find((candidate) => candidate.cellId === cellId);
		if (!cell) continue;
		if (cell.version !== version) {
			const error = new Error('Roster changed by another manager');
			(error as Error & { code?: number; current?: RosterCell }).code = 409;
			(error as Error & { current?: RosterCell }).current = { ...cell };
			throw error;
		}
		cell.shift = shift;
		cell.version += 1;
		roster.version += 1;
		persistState();
		return { ...cell };
	}
	throw new Error('Cell not found');
}

export async function getSwaps(signal?: AbortSignal): Promise<SwapRequest[]> {
	return wait(swapStore.map((swap) => ({ ...swap })), signal);
}

export async function approveSwap(id: string, key: string): Promise<SwapRequest> {
	if (idempotencyResults.has(key)) return idempotencyResults.get(key) as SwapRequest;
	await wait(undefined, undefined, 300, 700);
	const swap = swapStore.find((item) => item.id === id);
	if (!swap) throw new Error('Swap request not found');
	for (const roster of rosterStore.values()) {
		if (roster.wardCode !== swap.wardCode || roster.published) continue;
		const fromCell = roster.cells.find((cell) => cell.staffId === swap.fromStaffId && cell.date === swap.date && cell.shift === swap.shift);
		const toCell = roster.cells.find((cell) => cell.staffId === swap.toStaffId && cell.date === swap.date);
		if (!fromCell || !toCell) throw new Error('Swap could not be applied to the current roster');
		fromCell.shift = null;
		fromCell.version += 1;
		toCell.shift = swap.shift;
		toCell.version += 1;
		roster.version += 1;
	}
	swap.status = 'APPROVED';
	persistState();
	idempotencyResults.set(key, { ...swap });
	return { ...swap };
}

export async function rejectSwap(id: string, reason: string): Promise<SwapRequest> {
	await wait(undefined, undefined, 300, 700);
	const swap = swapStore.find((item) => item.id === id);
	if (!swap) throw new Error('Swap request not found');
	swap.status = 'REJECTED';
	swap.reason = reason;
	persistState();
	return { ...swap };
}

export async function publishRoster(wardCode: string, isoWeek: string, key: string): Promise<Roster> {
	if (idempotencyResults.has(key)) return idempotencyResults.get(key) as Roster;
	await wait(undefined, undefined, 350, 750);
	const roster = getOrCreateRoster(wardCode, isoWeek);
	roster.published = true;
	roster.version += 1;
	persistState();
	const result = cloneRoster(roster);
	idempotencyResults.set(key, result);
	return result;
}
