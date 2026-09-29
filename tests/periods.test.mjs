import test from 'node:test';
import assert from 'node:assert/strict';
import {
	AddUtcDays,
	DefaultPeriodEnd,
	EnumerateUtcDays,
	InclusiveDayCount,
	ResolveComparisonPeriods,
} from '../src/periods.mjs';

test('DefaultPeriodEnd is yesterday UTC', () => {
	let now = new Date(Date.UTC(2026, 8, 23, 15, 0, 0));
	assert.equal(DefaultPeriodEnd(now), '2026-09-22');
});

test('InclusiveDayCount and EnumerateUtcDays stay inclusive across month/year', () => {
	assert.equal(InclusiveDayCount('2025-12-30', '2026-01-02'), 4);
	assert.deepEqual(EnumerateUtcDays('2025-12-30', '2026-01-02'), [
		'2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02',
	]);
});

test('ResolveComparisonPeriods builds equal previous window', () => {
	let periods = ResolveComparisonPeriods({ end: '2026-09-07', days: 7 }, new Date(Date.UTC(2026, 8, 23)));
	assert.deepEqual(periods.current, { start: '2026-09-01', end: '2026-09-07', days: 7 });
	assert.deepEqual(periods.previous, { start: '2026-08-25', end: '2026-08-31', days: 7 });
	assert.equal(AddUtcDays('2026-09-01', -1), '2026-08-31');
});

test('ResolveComparisonPeriods rejects today and future UTC ends', () => {
	let now = new Date(Date.UTC(2026, 8, 23, 12, 0, 0));
	assert.throws(() => ResolveComparisonPeriods({ end: '2026-09-23', days: 1 }, now));
	assert.throws(() => ResolveComparisonPeriods({ end: '2026-09-24', days: 1 }, now));
});

test('explicit start/end month boundary', () => {
	let periods = ResolveComparisonPeriods({
		start: '2026-01-28',
		end: '2026-02-03',
	}, new Date(Date.UTC(2026, 8, 23)));
	assert.equal(periods.current.days, 7);
	assert.equal(periods.previous.start, '2026-01-21');
	assert.equal(periods.previous.end, '2026-01-27');
});
