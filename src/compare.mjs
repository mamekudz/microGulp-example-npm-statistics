/**
 * Compare two equally long download periods. Missing / failed values are never
 * coerced to zero downloads. Percent change is null when not computable.
 */

/**
 * Absolute and percent change. Previous null → percent null. Previous 0 with
 * non-zero current → percent null (not Infinity).
 *
 * @param {number|null|undefined} _current
 * @param {number|null|undefined} _previous
 * @returns {{ absolute: number|null, percent: number|null }}
 */
export function ComputeChange(_current, _previous) {
	if (_current == null || _previous == null || !Number.isFinite(_current) || !Number.isFinite(_previous)) {
		return { absolute: null, percent: null };
	}
	let absolute = _current - _previous;
	if (_previous === 0) {
		return { absolute, percent: _current === 0 ? 0 : null };
	}
	return { absolute, percent: (absolute / _previous) * 100 };
}

/**
 * @param {object} _currentResult fetch result for current period
 * @param {object} _previousResult fetch result for previous period
 * @param {{ current: object, previous: object }} _periods
 * @returns {object}
 */
export function ComparePackageResults(_currentResult, _previousResult, _periods) {
	let currentOk = _currentResult?.ok === true && _currentResult.status === 'ok';
	let previousOk = _previousResult?.ok === true && _previousResult.status === 'ok';
	let comparable = currentOk && previousOk;
	let change = comparable
		? ComputeChange(_currentResult.sum, _previousResult.sum)
		: { absolute: null, percent: null };

	let completeness = 'complete';
	if (!currentOk || !previousOk) {
		completeness = 'incomplete';
	}

	let packageStatus = 'ok';
	if (!currentOk && !previousOk) packageStatus = _currentResult?.status || _previousResult?.status || 'error';
	else if (!currentOk) packageStatus = _currentResult?.status || 'error';
	else if (!previousOk) packageStatus = _previousResult?.status || 'error';

	return {
		package: _currentResult?.package || _previousResult?.package,
		status: packageStatus,
		completeness,
		comparable,
		current: {
			period: _periods.current,
			status: _currentResult?.status,
			sum: currentOk ? _currentResult.sum : null,
			missingDays: _currentResult?.missingDays ?? [],
			error: _currentResult?.error ?? null,
			url: _currentResult?.url ?? null,
			httpStatus: _currentResult?.httpStatus ?? null,
			downloadsByDay: currentOk ? _currentResult.downloadsByDay : null,
		},
		previous: {
			period: _periods.previous,
			status: _previousResult?.status,
			sum: previousOk ? _previousResult.sum : null,
			missingDays: _previousResult?.missingDays ?? [],
			error: _previousResult?.error ?? null,
			url: _previousResult?.url ?? null,
			httpStatus: _previousResult?.httpStatus ?? null,
			downloadsByDay: previousOk ? _previousResult.downloadsByDay : null,
		},
		change: {
			absolute: change.absolute,
			percent: change.percent,
			percentComputable: change.percent != null,
		},
	};
}

/**
 * @param {object[]} _currentResults
 * @param {object[]} _previousResults
 * @param {{ current: object, previous: object }} _periods
 * @returns {object[]}
 */
export function CompareAllPackages(_currentResults, _previousResults, _periods) {
	let previousByName = new Map(_previousResults.map((_entry) => [_entry.package, _entry]));
	return _currentResults.map((_current) => ComparePackageResults(_current, previousByName.get(_current.package), _periods));
}
