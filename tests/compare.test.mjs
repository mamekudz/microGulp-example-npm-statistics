import test from 'node:test';
import assert from 'node:assert/strict';
import { ComputeChange, ComparePackageResults } from '../src/compare.mjs';

const PERIODS = {
	current: { start: '2026-09-01', end: '2026-09-07', days: 7 },
	previous: { start: '2026-08-25', end: '2026-08-31', days: 7 },
};

test('ComputeChange handles normal, zero previous, and nulls', () => {
	assert.deepEqual(ComputeChange(150, 100), { absolute: 50, percent: 50 });
	assert.deepEqual(ComputeChange(0, 0), { absolute: 0, percent: 0 });
	assert.deepEqual(ComputeChange(10, 0), { absolute: 10, percent: null });
	assert.deepEqual(ComputeChange(10, null), { absolute: null, percent: null });
	assert.deepEqual(ComputeChange(null, 5), { absolute: null, percent: null });
});

test('true zero downloads remain comparable', () => {
	let result = ComparePackageResults(
		{ package: 'zero-pkg', ok: true, status: 'ok', sum: 0 },
		{ package: 'zero-pkg', ok: true, status: 'ok', sum: 0 },
		PERIODS,
	);
	assert.equal(result.comparable, true);
	assert.equal(result.current.sum, 0);
	assert.equal(result.change.percent, 0);
});

test('incomplete or unknown packages are not coerced to zero', () => {
	let incomplete = ComparePackageResults(
		{ package: 'x', ok: false, status: 'incomplete', sum: null, error: 'missing', missingDays: ['2026-09-03'] },
		{ package: 'x', ok: true, status: 'ok', sum: 10 },
		PERIODS,
	);
	assert.equal(incomplete.comparable, false);
	assert.equal(incomplete.current.sum, null);
	assert.equal(incomplete.change.percent, null);

	let unknown = ComparePackageResults(
		{ package: '@scope/missing', ok: false, status: 'unknown_package', sum: null, error: 'not found' },
		{ package: '@scope/missing', ok: false, status: 'unknown_package', sum: null, error: 'not found' },
		PERIODS,
	);
	assert.equal(unknown.status, 'unknown_package');
	assert.equal(unknown.current.sum, null);
	assert.equal(unknown.previous.sum, null);
});
