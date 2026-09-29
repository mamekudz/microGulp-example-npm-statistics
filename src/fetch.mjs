/**
 * npm download-count client (range API) with timeout, retries and concurrency.
 *
 * Official docs (checked 2026-09-23):
 * https://github.com/npm/registry/blob/main/docs/download-counts.md
 *
 * - UTC calendar days; start/end inclusive
 * - History from 2015-01-10; single queries max ~18 months
 * - Scoped packages work on single-package URLs; bulk comma lists do not
 * - Missing days are not the same as downloads: 0
 */

import { EnumerateUtcDays, FormatNpmRangePeriod } from './periods.mjs';

export const NPM_DOWNLOADS_API_BASE = 'https://api.npmjs.org/downloads';
export const NPM_DOWNLOADS_DOCS_URL = 'https://github.com/npm/registry/blob/main/docs/download-counts.md';

/**
 * Encode a package name for the downloads path. Scoped names keep `@scope/name`
 * with the slash percent-encoded so intermediaries do not split the path.
 * @param {string} _packageName
 * @returns {string}
 */
export function EncodePackagePath(_packageName) {
	if (_packageName.startsWith('@')) {
		let slash = _packageName.indexOf('/');
		if (slash > 0) {
			return encodeURIComponent(_packageName.slice(0, slash))
				+ '/'
				+ encodeURIComponent(_packageName.slice(slash + 1));
		}
	}
	return encodeURIComponent(_packageName);
}

/**
 * @param {{ start: string, end: string }} _period
 * @param {string} _packageName
 * @returns {string}
 */
export function BuildRangeUrl(_period, _packageName) {
	return `${NPM_DOWNLOADS_API_BASE}/range/${FormatNpmRangePeriod(_period)}/${EncodePackagePath(_packageName)}`;
}

/**
 * @param {object} _body
 * @param {{ start: string, end: string }} _period
 * @param {string} _packageName
 * @returns {object}
 */
export function ValidateRangeResponse(_body, _period, _packageName) {
	if (!_body || typeof _body !== 'object' || Array.isArray(_body)) {
		return { ok: false, status: 'invalid_response', error: 'Response is not a JSON object', downloadsByDay: null, sum: null, missingDays: [], extraDays: [] };
	}
	if (typeof _body.error === 'string' && _body.error) {
		let unknown = /not found/i.test(_body.error);
		return {
			ok: false,
			status: unknown ? 'unknown_package' : 'error',
			error: _body.error,
			downloadsByDay: null,
			sum: null,
			missingDays: [],
			extraDays: [],
		};
	}
	if (!Array.isArray(_body.downloads)) {
		return { ok: false, status: 'invalid_response', error: 'Response.downloads is not an array', downloadsByDay: null, sum: null, missingDays: [], extraDays: [] };
	}

	let expected = EnumerateUtcDays(_period.start, _period.end);
	let downloadsByDay = Object.create(null);
	for (let entry of _body.downloads) {
		if (!entry || typeof entry !== 'object') {
			return { ok: false, status: 'invalid_response', error: 'downloads[] entry is not an object', downloadsByDay: null, sum: null, missingDays: [], extraDays: [] };
		}
		let day = String(entry.day ?? '');
		if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
			return { ok: false, status: 'invalid_response', error: `Invalid day value: ${entry.day}`, downloadsByDay: null, sum: null, missingDays: [], extraDays: [] };
		}
		if (typeof entry.downloads !== 'number' || !Number.isFinite(entry.downloads) || entry.downloads < 0) {
			return { ok: false, status: 'invalid_response', error: `Invalid downloads value on ${day}`, downloadsByDay: null, sum: null, missingDays: [], extraDays: [] };
		}
		downloadsByDay[day] = entry.downloads;
	}

	let missingDays = expected.filter((_day) => !Object.prototype.hasOwnProperty.call(downloadsByDay, _day));
	let expectedSet = new Set(expected);
	let extraDays = Object.keys(downloadsByDay).filter((_day) => !expectedSet.has(_day)).sort();

	if (missingDays.length) {
		return {
			ok: false,
			status: 'incomplete',
			error: `Missing UTC days in response: ${missingDays.join(', ')}`,
			downloadsByDay,
			sum: null,
			missingDays,
			extraDays,
			start: String(_body.start ?? _period.start),
			end: String(_body.end ?? _period.end),
			package: String(_body.package ?? _packageName),
		};
	}

	let sum = expected.reduce((_total, _day) => _total + downloadsByDay[_day], 0);
	return {
		ok: true,
		status: 'ok',
		error: null,
		downloadsByDay,
		sum,
		missingDays: [],
		extraDays,
		start: String(_body.start ?? _period.start),
		end: String(_body.end ?? _period.end),
		package: String(_body.package ?? _packageName),
	};
}

/**
 * @param {number} _ms
 * @returns {Promise<void>}
 */
function _Sleep(_ms) {
	return new Promise((_resolve) => setTimeout(_resolve, _ms));
}

/**
 * @param {string} _url
 * @param {object} _options
 * @returns {Promise<{ ok: boolean, status: number, body: any, error?: string, retryable?: boolean }>}
 */
export async function FetchJson(_url, _options = {}) {
	let timeoutMs = Number(_options.timeoutMs ?? 15000);
	let fetchImpl = _options.fetchImpl || globalThis.fetch;
	if (typeof fetchImpl !== 'function') {
		return { ok: false, status: 0, body: null, error: 'fetch is not available', retryable: false };
	}
	let controller = new AbortController();
	let timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		let response = await fetchImpl(_url, {
			method: 'GET',
			headers: { Accept: 'application/json', 'User-Agent': 'microgulp-example-npm-statistics/1.0' },
			signal: controller.signal,
		});
		let text = await response.text();
		let body = null;
		try {
			body = text ? JSON.parse(text) : null;
		} catch {
			return { ok: false, status: response.status, body: null, error: 'Response is not valid JSON', retryable: false };
		}
		if (response.status === 404) {
			return { ok: false, status: 404, body, error: body?.error || 'package not found', retryable: false };
		}
		if (response.status === 429) {
			return { ok: false, status: 429, body, error: 'Rate limited by npm downloads API', retryable: true };
		}
		if (response.status >= 500) {
			return { ok: false, status: response.status, body, error: `HTTP ${response.status}`, retryable: true };
		}
		if (!response.ok) {
			return { ok: false, status: response.status, body, error: body?.error || `HTTP ${response.status}`, retryable: false };
		}
		return { ok: true, status: response.status, body };
	} catch (_error) {
		let message = _error?.name === 'AbortError' ? `Timed out after ${timeoutMs} ms` : String(_error?.message || _error);
		let retryable = _error?.name === 'AbortError' || /network|fetch|econn|enotfound|timed out/i.test(message);
		return { ok: false, status: 0, body: null, error: message, retryable };
	} finally {
		clearTimeout(timer);
	}
}

/**
 * @param {string} _packageName
 * @param {{ start: string, end: string }} _period
 * @param {object} _options
 * @returns {Promise<object>}
 */
export async function FetchPackageRange(_packageName, _period, _options = {}) {
	let url = BuildRangeUrl(_period, _packageName);
	let retries = Number(_options.retries ?? 2);
	let retryDelayMs = Number(_options.retryDelayMs ?? 500);
	let attempt = 0;
	let lastFailure = null;

	while (attempt <= retries) {
		let response = await FetchJson(url, _options);
		if (response.ok) {
			let validated = ValidateRangeResponse(response.body, _period, _packageName);
			return {
				package: _packageName,
				url,
				httpStatus: response.status,
				fetchedAt: new Date().toISOString(),
				attempts: attempt + 1,
				...validated,
			};
		}

		if (response.status === 404) {
			return {
				package: _packageName,
				url,
				httpStatus: 404,
				fetchedAt: new Date().toISOString(),
				attempts: attempt + 1,
				ok: false,
				status: 'unknown_package',
				error: response.error || 'package not found',
				downloadsByDay: null,
				sum: null,
				missingDays: [],
				extraDays: [],
			};
		}

		lastFailure = response;
		if (!response.retryable || attempt === retries) break;
		attempt += 1;
		await _Sleep(retryDelayMs * attempt);
	}

	let status = lastFailure?.status === 429 ? 'rate_limited'
		: /Timed out/i.test(lastFailure?.error || '') ? 'timeout'
			: 'error';
	return {
		package: _packageName,
		url,
		httpStatus: lastFailure?.status ?? 0,
		fetchedAt: new Date().toISOString(),
		attempts: attempt + 1,
		ok: false,
		status,
		error: lastFailure?.error || 'fetch failed',
		downloadsByDay: null,
		sum: null,
		missingDays: [],
		extraDays: [],
	};
}

/**
 * Run async work with a concurrency limit.
 * @template T
 * @param {T[]} _items
 * @param {number} _concurrency
 * @param {(item: T, index: number) => Promise<any>} _worker
 * @returns {Promise<any[]>}
 */
export async function MapWithConcurrency(_items, _concurrency, _worker) {
	let results = new Array(_items.length);
	let nextIndex = 0;
	let workers = Array.from({ length: Math.min(_concurrency, _items.length) }, async () => {
		while (true) {
			let index = nextIndex++;
			if (index >= _items.length) return;
			results[index] = await _worker(_items[index], index);
		}
	});
	await Promise.all(workers);
	return results;
}

/**
 * @param {string[]} _packages
 * @param {{ start: string, end: string }} _period
 * @param {object} _options
 * @returns {Promise<object[]>}
 */
export async function FetchPackagesForPeriod(_packages, _period, _options = {}) {
	let concurrency = Number(_options.concurrency ?? 3);
	return MapWithConcurrency(_packages, concurrency, (_name) => FetchPackageRange(_name, _period, _options));
}
