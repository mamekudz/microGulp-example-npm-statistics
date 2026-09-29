/**
 * Configuration loading and validation for npm-statistics.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ResolveComparisonPeriods } from './periods.mjs';

const PACKAGE_NAME_RE = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i;

/**
 * @param {unknown} _name
 * @returns {boolean}
 */
export function IsValidPackageName(_name) {
	return typeof _name === 'string' && PACKAGE_NAME_RE.test(_name) && !_name.includes(',') && _name.length <= 214;
}

/**
 * @param {string} [_configPath]
 * @param {object} [_overrides]
 * @returns {object}
 */
export function LoadConfig(_configPath, _overrides = {}) {
	let path = resolve(_configPath || 'config.json');
	if (!existsSync(path)) {
		throw new Error(`Config file not found: ${path}`);
	}
	let raw;
	try {
		raw = JSON.parse(readFileSync(path, 'utf8'));
	} catch (_error) {
		throw new Error(`Invalid JSON in config ${path}: ${_error.message}`);
	}
	return NormalizeConfig({ ...raw, ..._overrides }, path);
}

/**
 * @param {object} _raw
 * @param {string} [_sourcePath]
 * @returns {object}
 */
export function NormalizeConfig(_raw, _sourcePath = '') {
	if (!_raw || typeof _raw !== 'object' || Array.isArray(_raw)) {
		throw new Error('Config must be a JSON object');
	}

	let packages = Array.isArray(_raw.packages) ? _raw.packages.map((_name) => String(_name).trim()) : [];
	if (!packages.length) {
		throw new Error('Config.packages must list at least one package name');
	}
	let seen = new Set();
	for (let name of packages) {
		if (!IsValidPackageName(name)) {
			throw new Error(`Invalid npm package name: ${name}`);
		}
		let key = name.toLowerCase();
		if (seen.has(key)) {
			throw new Error(`Duplicate package in config: ${name}`);
		}
		seen.add(key);
	}

	let periodInput = _raw.period && typeof _raw.period === 'object' ? _raw.period : {};
	let periods = ResolveComparisonPeriods(periodInput);

	let fetch = _raw.fetch && typeof _raw.fetch === 'object' ? _raw.fetch : {};
	let timeoutMs = Number(fetch.timeoutMs ?? 15000);
	let retries = Number(fetch.retries ?? 2);
	let concurrency = Number(fetch.concurrency ?? 3);
	let retryDelayMs = Number(fetch.retryDelayMs ?? 500);
	if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) {
		throw new Error('fetch.timeoutMs must be >= 1000');
	}
	if (!Number.isInteger(retries) || retries < 0 || retries > 5) {
		throw new Error('fetch.retries must be an integer 0..5');
	}
	if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
		throw new Error('fetch.concurrency must be an integer 1..8');
	}
	if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) {
		throw new Error('fetch.retryDelayMs must be >= 0');
	}

	let mode = String(_raw.mode ?? 'live').toLowerCase();
	if (mode !== 'live' && mode !== 'offline') {
		throw new Error(`Config.mode must be "live" or "offline"; got ${_raw.mode}`);
	}

	let outputDir = String(_raw.outputDir ?? 'reports').trim() || 'reports';

	return {
		sourcePath: _sourcePath,
		packages,
		period: periodInput,
		periods,
		fetch: { timeoutMs, retries, concurrency, retryDelayMs },
		mode,
		outputDir,
		dataSource: mode === 'offline'
			? 'offline-demo (synthetic fixtures)'
			: 'https://api.npmjs.org/downloads/range/{period}/{package}',
	};
}
