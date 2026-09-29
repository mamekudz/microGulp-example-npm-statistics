/**
 * Orchestrates config → fetch/compare → files → presentation.
 */

import { resolve } from 'node:path';
import { LoadConfig } from './validate.mjs';
import { FetchPackagesForPeriod } from './fetch.mjs';
import { FetchOfflinePackages } from './demo-data.mjs';
import { CompareAllPackages } from './compare.mjs';
import { BuildReport, PresentReport, ReportExitCode, WriteReportFiles } from './report.mjs';

/**
 * @param {object} _options
 * @returns {Promise<{ report: object, jsonPath: string, csvPath: string, exitCode: number }>}
 */
export async function RunDownloadReport(_options = {}) {
	let config = _options.config
		|| LoadConfig(_options.configPath, {
			mode: _options.mode,
			...( _options.period ? { period: _options.period } : {} ),
			...( _options.packages ? { packages: _options.packages } : {} ),
		});

	if (_options.mode) {
		config = { ...config, mode: _options.mode, dataSource: _options.mode === 'offline'
			? 'offline-demo (synthetic fixtures)'
			: config.dataSource };
	}

	let currentResults;
	let previousResults;
	let fetchedAt = new Date().toISOString();

	if (config.mode === 'offline') {
		currentResults = FetchOfflinePackages(config.packages, config.periods.current, _options.offlineScenario);
		previousResults = FetchOfflinePackages(config.packages, config.periods.previous, _options.offlineScenario);
	} else {
		currentResults = await FetchPackagesForPeriod(config.packages, config.periods.current, {
			...config.fetch,
			fetchImpl: _options.fetchImpl,
		});
		previousResults = await FetchPackagesForPeriod(config.packages, config.periods.previous, {
			...config.fetch,
			fetchImpl: _options.fetchImpl,
		});
	}

	let comparisons = CompareAllPackages(currentResults, previousResults, config.periods);
	let report = BuildReport({ config, packageComparisons: comparisons, fetchedAt, mode: config.mode });
	let outputDir = resolve(_options.cwd || process.cwd(), config.outputDir);
	let files = WriteReportFiles(report, outputDir);

	if (_options.present !== false) {
		if (!_options.api) {
			throw new Error('PresentReport requires gulp-mu-gulp-api helpers via options.api');
		}
		await PresentReport(report, _options.api);
		_options.api.Log?.('Wrote JSON report: <path/><context="task log"/>', { path: files.jsonPath });
		_options.api.Log?.('Wrote CSV report: <path/><context="task log"/>', { path: files.csvPath });
	}

	return {
		report,
		jsonPath: files.jsonPath,
		csvPath: files.csvPath,
		exitCode: ReportExitCode(report),
	};
}
