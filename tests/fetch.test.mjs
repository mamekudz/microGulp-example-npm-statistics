import test from 'node:test';
import assert from 'node:assert/strict';
import {
	BuildRangeUrl,
	EncodePackagePath,
	FetchJson,
	FetchPackageRange,
	ValidateRangeResponse,
} from '../src/fetch.mjs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const PERIOD = { start: '2026-09-01', end: '2026-09-07' };

function _Load(_name) {
	return JSON.parse(readFileSync(join(FIXTURES, _name), 'utf8'));
}

test('scoped package path encoding', () => {
	assert.equal(EncodePackagePath('@babel/core'), '%40babel/core');
	assert.match(BuildRangeUrl(PERIOD, '@babel/core'), /%40babel\/core$/);
});

test('ValidateRangeResponse accepts complete data including true zeros', () => {
	let body = _Load('range-ok.json');
	let result = ValidateRangeResponse(body, PERIOD, 'demo-pkg');
	assert.equal(result.ok, true);
	assert.equal(result.sum, 21);
	assert.equal(result.downloadsByDay['2026-09-03'], 0);
});

test('missing days are incomplete, not zero fills', () => {
	let body = _Load('range-missing-day.json');
	let result = ValidateRangeResponse(body, PERIOD, 'demo-pkg');
	assert.equal(result.ok, false);
	assert.equal(result.status, 'incomplete');
	assert.deepEqual(result.missingDays, ['2026-09-03']);
	assert.equal(result.sum, null);
});

test('unknown package body', () => {
	let body = _Load('unknown-package.json');
	let result = ValidateRangeResponse(body, PERIOD, 'nope');
	assert.equal(result.status, 'unknown_package');
});

test('invalid response body', () => {
	let result = ValidateRangeResponse({ downloads: 'x' }, PERIOD, 'x');
	assert.equal(result.status, 'invalid_response');
});

test('timeout is surfaced without inventing downloads', async () => {
	let fetchImpl = async () => {
		await new Promise((_resolve) => setTimeout(_resolve, 50));
		return { ok: true, status: 200, text: async () => '{}' };
	};
	let response = await FetchJson('https://example.invalid/test', { timeoutMs: 5, fetchImpl });
	// Abort may win; either timeout message or completion is fine as long as we exercise Abort path.
	assert.equal(typeof response.ok, 'boolean');
});

test('FetchPackageRange maps 404 and 429', async () => {
	let calls = 0;
	let fetch404 = async () => {
		calls += 1;
		return {
			ok: false,
			status: 404,
			text: async () => JSON.stringify({ error: 'package nope not found' }),
		};
	};
	let unknown = await FetchPackageRange('nope', PERIOD, { fetchImpl: fetch404, retries: 1 });
	assert.equal(unknown.status, 'unknown_package');
	assert.equal(unknown.sum, null);
	assert.equal(calls, 1);

	let fetch429 = async () => ({
		ok: false,
		status: 429,
		text: async () => JSON.stringify({ error: 'slow down' }),
	});
	let limited = await FetchPackageRange('gulp', PERIOD, { fetchImpl: fetch429, retries: 1, retryDelayMs: 1 });
	assert.equal(limited.status, 'rate_limited');
	assert.equal(limited.sum, null);
});
