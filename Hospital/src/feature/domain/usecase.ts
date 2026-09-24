import {
	validateRoster,
	type RuleOptions,
	type StaffingRequirements,
} from './rules';
import type { Roster, RuleViolation, Staff } from './entites';

export interface ValidateRosterInput {
	roster: Roster;
	staff: Staff[];
	requirements: StaffingRequirements;
	options?: RuleOptions;
	acknowledgedWarningKeys?: string[];
}

export interface RosterValidationResult {
	violations: RuleViolation[];
	errors: RuleViolation[];
	warnings: RuleViolation[];
	unacknowledgedWarnings: RuleViolation[];
	canPublish: boolean;
}

export function getViolationKey(violation: RuleViolation): string {
	return [
		violation.ruleId,
		violation.staffId ?? 'roster',
		violation.date ?? 'week',
		violation.message,
	].join(':');
}

export function validateRosterUseCase(input: ValidateRosterInput): RosterValidationResult {
	const violations = validateRoster(input.roster, input.staff, input.requirements, {
		...input.options,
		publish: true,
	});
	const errors = violations.filter((item) => item.severity === 'ERROR');
	const warnings = violations.filter((item) => item.severity === 'WARNING');
	const acknowledgedWarningKeys = new Set(input.acknowledgedWarningKeys ?? []);
	const unacknowledgedWarnings = warnings.filter(
		(item) => !acknowledgedWarningKeys.has(getViolationKey(item))
	);

	return {
		violations,
		errors,
		warnings,
		unacknowledgedWarnings,
		canPublish: !input.roster.published && errors.length === 0 && unacknowledgedWarnings.length === 0,
	};
}

export class RosterValidationOrchestrator {
	validate(input: ValidateRosterInput): RosterValidationResult {
		return validateRosterUseCase(input);
	}

	canPublish(input: ValidateRosterInput): boolean {
		return this.validate(input).canPublish;
	}
}
