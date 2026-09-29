/**
 * Explicit offline demo fixtures. Never used as a silent fallback for live errors.
 */

import { EnumerateUtcDays } from './periods.mjs';
import { ValidateRangeResponse } from './fetch.mjs';

/**
 * Deterministic synthetic daily downloads for a package/period.
 * @param {string} _packageName
 * @param {{ start: string, end: string }} _period
 * @param {object} [_options]
 * @returns {object} raw npm-like range body
 */
export function BuildSyntheticRangeBody(_packageName, _period, _options = {}) {
	if (_options.unknown) {
		return { error: `package ${_packageName} not found` };
	}
	if (_options.invalid) {
		return { downloads: 'nope' };
	}
	let days = EnumerateUtcDays(_period.start, _period.end);
	if (_options.omitDay) {
		days = days.filter((_day) => _day !== _options.omitDay);
	}
	let base = Math.abs(_Hash(_packageName)) % 900 + 100;
	let downloads = days.map((_day, _index) => {
		if (_options.forceZeroDays?.includes(_day)) {
			return { day: _day, downloads: 0 };
		}
		return { day: _day, downloads: base + (_index * 3) };
	});
	return {
		start: _period.start,
		end: _period.end,
		package: _packageName,
		downloads,
	};
}

/**
 * @param {string[]} _packages
 * @param {{ start: string, end: string }} _period
 * @param {object} [_scenario]
 * @returns {object[]}
 */
export function FetchOfflinePackages(_packages, _period, _scenario = {}) {
	return _packages.map((_name) => {
		let options = {};
		if (_scenario.unknownPackages?.includes(_name)) options.unknown = true;
		if (_scenario.incompletePackages?.[_name]) options.omitDay = _scenario.incompletePackages[_name];
		if (_scenario.invalidPackages?.includes(_name)) options.invalid = true;
		if (_scenario.zeroPackages?.[_name]) options.forceZeroDays = _scenario.zeroPackages[_name];

		let body = BuildSyntheticRangeBody(_name, _period, options);
		if (body.error) {
			return {
				package: _name,
				url: `offline://fixture/${_name}`,
				httpStatus: 404,
				fetchedAt: new Date().toISOString(),
				attempts: 1,
				ok: false,
				status: 'unknown_package',
				error: body.error,
				downloadsByDay: null,
				sum: null,
				missingDays: [],
				extraDays: [],
			};
		}
		let validated = ValidateRangeResponse(body, _period, _name);
		return {
			package: _name,
			url: `offline://fixture/${_name}`,
			httpStatus: 200,
			fetchedAt: new Date().toISOString(),
			attempts: 1,
			...validated,
		};
	});
}

function _Hash(_text) {
	let hash = 0;
	for (let index = 0; index < _text.length; index++) {
		hash = ((_hashShift(hash) + _text.charCodeAt(index)) | 0);
	}
	return hash;
}

function _hashShift(_hash) {
	return (_hash << 5) - _hash;
}
