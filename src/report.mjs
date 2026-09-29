/**
 * JSON / CSV report writers and console + µGulp presentation helpers.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NPM_DOWNLOADS_DOCS_URL } from './fetch.mjs';

/**
 * Escape a CSV field (RFC 4180 style).
 * @param {unknown} _value
 * @returns {string}
 */
export function EscapeCsvField(_value) {
	if (_value == null) return '';
	let text = String(_value);
	if (/[",\r\n]/.test(text)) {
		return `"${text.replace(/"/g, '""')}"`;
	}
	return text;
}

/**
 * @param {string[]} _headers
 * @param {Array<Array<unknown>>} _rows
 * @returns {string}
 */
export function BuildCsv(_headers, _rows) {
	let lines = [_headers.map(EscapeCsvField).join(',')];
	for (let row of _rows) {
		lines.push(row.map(EscapeCsvField).join(','));
	}
	return lines.join('\n') + '\n';
}

/**
 * @param {number|null|undefined} _value
 * @param {number} [_digits]
 * @returns {string}
 */
export function FormatNumberOrNa(_value, _digits = 0) {
	if (_value == null || !Number.isFinite(_value)) return 'n/a';
	if (_digits > 0) return _value.toFixed(_digits);
	return String(Math.trunc(_value));
}

/**
 * @param {object} _report
 * @returns {{ headers: string[], rows: Array<Array<unknown>> }}
 */
export function BuildCsvTable(_report) {
	let headers = [
		'package',
		'status',
		'completeness',
		'current_start',
		'current_end',
		'current_sum',
		'previous_start',
		'previous_end',
		'previous_sum',
		'change_absolute',
		'change_percent',
		'percent_computable',
		'current_error',
		'previous_error',
	];
	let rows = _report.packages.map((_entry) => [
		_entry.package,
		_entry.status,
		_entry.completeness,
		_entry.current.period.start,
		_entry.current.period.end,
		_entry.current.sum,
		_entry.previous.period.start,
		_entry.previous.period.end,
		_entry.previous.sum,
		_entry.change.absolute,
		_entry.change.percent,
		_entry.change.percentComputable,
		_entry.current.error,
		_entry.previous.error,
	]);
	return { headers, rows };
}

/**
 * @param {object} _report
 * @param {string} _outputDir
 * @returns {{ jsonPath: string, csvPath: string }}
 */
export function WriteReportFiles(_report, _outputDir) {
	mkdirSync(_outputDir, { recursive: true });
	let stamp = _report.fetchedAt.replace(/[:.]/g, '-');
	let base = `npm-downloads_${_report.periods.current.start}_${_report.periods.current.end}_${stamp}`;
	let jsonPath = join(_outputDir, `${base}.json`);
	let csvPath = join(_outputDir, `${base}.csv`);
	writeFileSync(jsonPath, JSON.stringify(_report, null, '\t') + '\n', 'utf8');
	let csv = BuildCsvTable(_report);
	writeFileSync(csvPath, BuildCsv(csv.headers, csv.rows), 'utf8');
	return { jsonPath, csvPath };
}

/**
 * Build the canonical report object.
 * @param {object} _args
 * @returns {object}
 */
export function BuildReport(_args) {
	let {
		config,
		packageComparisons,
		fetchedAt = new Date().toISOString(),
		mode = config.mode,
	} = _args;

	let okCount = packageComparisons.filter((_entry) => _entry.status === 'ok' && _entry.comparable).length;
	let failedCount = packageComparisons.length - okCount;
	let completeness = failedCount === 0 ? 'complete' : (okCount === 0 ? 'failed' : 'partial');

	return {
		schemaVersion: 1,
		mode,
		dataSource: config.dataSource,
		docsUrl: NPM_DOWNLOADS_DOCS_URL,
		timezone: 'UTC',
		dateSemantics: 'Inclusive completed UTC calendar days. Missing days are not treated as zero downloads.',
		fetchedAt,
		configPath: config.sourcePath || null,
		packagesRequested: config.packages.slice(),
		periods: config.periods,
		completeness,
		summary: {
			packageCount: packageComparisons.length,
			okCount,
			failedCount,
		},
		packages: packageComparisons,
	};
}

/**
 * Exit code: 0 all ok, 2 partial/all package failures, 1 reserved for fatal elsewhere.
 * @param {object} _report
 * @returns {number}
 */
export function ReportExitCode(_report) {
	if (_report.completeness === 'complete') return 0;
	return 2;
}

/**
 * Present table + chart via gulp-mu-gulp-api (CLI fallback included).
 * Missing values are omitted from the chart series (never forced to 0 bars).
 *
 * @param {object} _report
 * @param {object} _api `{ Log, Warn, LogTable, LogChart, LogCallout, LogKeyValue, LogBadges }`
 */
export async function PresentReport(_report, _api) {
	let { Log, Warn, LogTable, LogChart, LogCallout, LogKeyValue, LogBadges } = _api;

	Log('npm download report (<mode/>)<context="task log"/>', { mode: _report.mode });
	LogKeyValue({
		title: 'Report metadata',
		items: [
			{ key: 'Data source', value: _report.dataSource },
			{ key: 'Fetched at', value: _report.fetchedAt },
			{ key: 'Timezone', value: _report.timezone },
			{ key: 'Current period', value: `${_report.periods.current.start} … ${_report.periods.current.end} (${_report.periods.current.days} days)` },
			{ key: 'Previous period', value: `${_report.periods.previous.start} … ${_report.periods.previous.end} (${_report.periods.previous.days} days)` },
			{ key: 'Completeness', value: _report.completeness },
		],
	});

	if (_report.mode === 'offline') {
		LogCallout({
			variant: 'warning',
			title: 'Offline demo mode',
			message: 'Synthetic fixture data — not live npm downloads.',
		});
	}

	LogBadges({
		title: 'Status',
		items: [
			{ label: `ok ${_report.summary.okCount}`, variant: 'success' },
			{ label: `failed ${_report.summary.failedCount}`, variant: _report.summary.failedCount ? 'error' : 'info' },
			{ label: _report.completeness, variant: _report.completeness === 'complete' ? 'success' : 'warning' },
		],
	});

	LogTable({
		columns: [
			{ id: 'package', label: 'Package' },
			{ id: 'status', label: 'Status' },
			{ id: 'current', label: 'Current' },
			{ id: 'previous', label: 'Previous' },
			{ id: 'absolute', label: 'Δ abs' },
			{ id: 'percent', label: 'Δ %' },
		],
		rows: _report.packages.map((_entry) => ({
			package: _entry.package,
			status: _entry.status,
			current: FormatNumberOrNa(_entry.current.sum),
			previous: FormatNumberOrNa(_entry.previous.sum),
			absolute: FormatNumberOrNa(_entry.change.absolute),
			percent: _entry.change.percentComputable
				? FormatNumberOrNa(_entry.change.percent, 2)
				: 'n/a',
		})),
		hyphenate: false,
	});

	let chartSeries = _report.packages
		.filter((_entry) => _entry.comparable && _entry.current.sum != null)
		.map((_entry) => ({
			label: _entry.package,
			value: _entry.current.sum,
		}));
	if (chartSeries.length) {
		LogChart({
			title: 'Current-period downloads (complete packages only)',
			unit: 'downloads',
			series: chartSeries,
		});
	} else {
		Warn('No complete package totals available for the chart.<context="task warning"/>');
	}

	for (let entry of _report.packages) {
		if (entry.status === 'ok' && entry.comparable) continue;
		LogCallout({
			variant: 'error',
			title: entry.package,
			message: [
				`status=${entry.status}`,
				entry.current.error ? `current: ${entry.current.error}` : null,
				entry.previous.error ? `previous: ${entry.previous.error}` : null,
				!entry.change.percentComputable ? 'percent change not computable' : null,
			].filter(Boolean).join(' · '),
		});
	}
}
