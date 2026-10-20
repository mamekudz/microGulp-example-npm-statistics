/**
 * UTC calendar-day period helpers for npm download statistics.
 *
 * npm documents download counts on UTC calendar days with inclusive start/end
 * (https://github.com/npm/registry/blob/main/docs/download-counts.md).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const UTC_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Earliest date npm returns download data for (documented). */
export const NPM_DOWNLOADS_EARLIEST = '2015-01-10';
/** Single-package queries are limited to at most 18 months of data. */
export const NPM_DOWNLOADS_MAX_DAYS = Math.floor(18 * 30.44);

/**
 * @param {Date} [_date]
 * @returns {string} YYYY-MM-DD in UTC
 */
export function FormatUtcDate(_date = new Date()) {
	let year = _date.getUTCFullYear();
	let month = String(_date.getUTCMonth() + 1).padStart(2, '0');
	let day = String(_date.getUTCDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * @param {string} _text
 * @returns {boolean}
 */
export function IsUtcDateString(_text) {
	if (typeof _text !== 'string' || !UTC_DATE_RE.test(_text)) return false;
	let match = UTC_DATE_RE.exec(_text);
	let year = Number(match[1]);
	let month = Number(match[2]);
	let day = Number(match[3]);
	let date = new Date(Date.UTC(year, month - 1, day));
	return FormatUtcDate(date) === _text;
}

/**
 * @param {string} _text
 * @returns {Date}
 */
export function ParseUtcDate(_text) {
	if (!IsUtcDateString(_text)) {
		throw new Error(`Invalid UTC date (expected YYYY-MM-DD): ${_text}`);
	}
	let match = UTC_DATE_RE.exec(_text);
	return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/**
 * Yesterday in UTC - the last calendar day that can already be complete.
 * @param {Date} [_now]
 * @returns {string}
 */
export function DefaultPeriodEnd(_now = new Date()) {
	return FormatUtcDate(new Date(_now.getTime() - DAY_MS));
}

/**
 * Inclusive day count between two UTC dates.
 * @param {string} _start
 * @param {string} _end
 * @returns {number}
 */
export function InclusiveDayCount(_start, _end) {
	let startMs = ParseUtcDate(_start).getTime();
	let endMs = ParseUtcDate(_end).getTime();
	if (endMs < startMs) {
		throw new Error(`Period end ${_end} is before start ${_start}`);
	}
	return Math.floor((endMs - startMs) / DAY_MS) + 1;
}

/**
 * @param {string} _start
 * @param {number} _dayCount inclusive length
 * @returns {string}
 */
export function AddUtcDays(_start, _dayCount) {
	let date = ParseUtcDate(_start);
	date.setUTCDate(date.getUTCDate() + _dayCount);
	return FormatUtcDate(date);
}

/**
 * Ordered list of inclusive UTC days from start to end.
 * @param {string} _start
 * @param {string} _end
 * @returns {string[]}
 */
export function EnumerateUtcDays(_start, _end) {
	let days = [];
	let cursor = ParseUtcDate(_start);
	let endMs = ParseUtcDate(_end).getTime();
	while (cursor.getTime() <= endMs) {
		days.push(FormatUtcDate(cursor));
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return days;
}

/**
 * Builds current and immediately preceding comparison periods of equal length.
 *
 * @param {object} _input
 * @param {number} [_input.days]
 * @param {string} [_input.start]
 * @param {string} [_input.end]
 * @param {Date} [_now]
 * @returns {{ current: { start: string, end: string, days: number }, previous: { start: string, end: string, days: number } }}
 */
export function ResolveComparisonPeriods(_input = {}, _now = new Date()) {
	let end = _input.end ? String(_input.end) : DefaultPeriodEnd(_now);
	if (!IsUtcDateString(end)) {
		throw new Error(`Invalid period.end (UTC YYYY-MM-DD expected): ${_input.end}`);
	}
	let todayUtc = FormatUtcDate(_now);
	if (end > todayUtc) {
		throw new Error(`period.end ${end} is in the future (UTC today is ${todayUtc})`);
	}
	if (end >= todayUtc) {
		// Today is not a completed UTC day for npm stats.
		throw new Error(`period.end must be a completed UTC day before ${todayUtc}; got ${end}`);
	}

	let start;
	let days;
	if (_input.start != null && _input.start !== '') {
		start = String(_input.start);
		if (!IsUtcDateString(start)) {
			throw new Error(`Invalid period.start (UTC YYYY-MM-DD expected): ${_input.start}`);
		}
		days = InclusiveDayCount(start, end);
	} else {
		days = Number(_input.days ?? 7);
		if (!Number.isInteger(days) || days < 1) {
			throw new Error(`period.days must be a positive integer; got ${_input.days}`);
		}
		start = AddUtcDays(end, -(days - 1));
	}

	if (days > NPM_DOWNLOADS_MAX_DAYS) {
		throw new Error(`Period length ${days} exceeds npm single-query limit (~18 months / ${NPM_DOWNLOADS_MAX_DAYS} days)`);
	}
	if (start < NPM_DOWNLOADS_EARLIEST) {
		throw new Error(`Period start ${start} is before npm download history (${NPM_DOWNLOADS_EARLIEST})`);
	}

	let previousEnd = AddUtcDays(start, -1);
	let previousStart = AddUtcDays(previousEnd, -(days - 1));
	if (previousStart < NPM_DOWNLOADS_EARLIEST) {
		throw new Error(`Comparison period start ${previousStart} is before npm download history (${NPM_DOWNLOADS_EARLIEST})`);
	}

	return {
		current: { start, end, days },
		previous: { start: previousStart, end: previousEnd, days },
	};
}

/**
 * npm range period path segment (inclusive dates).
 * @param {{ start: string, end: string }} _period
 * @returns {string}
 */
export function FormatNpmRangePeriod(_period) {
	return `${_period.start}:${_period.end}`;
}
