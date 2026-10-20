import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BuildCsv, EscapeCsvField, WriteReportFiles, BuildReport } from '../src/report.mjs';
import { NormalizeConfig } from '../src/validate.mjs';
import { CompareAllPackages } from '../src/compare.mjs';
import { FetchOfflinePackages } from '../src/demo-data.mjs';
import { RunDownloadReport } from '../src/run-report.mjs';

test('CSV escaping masks quotes, commas and newlines', () => {
	assert.equal(EscapeCsvField('plain'), 'plain');
	assert.equal(EscapeCsvField('a,b'), '"a,b"');
	assert.equal(EscapeCsvField('say "hi"'), '"say ""hi"""');
	assert.equal(EscapeCsvField('line1\nline2'), '"line1\nline2"');
	let csv = BuildCsv(['a', 'b'], [['x,y', 'ok'], ['he said "no"', '1']]);
	assert.match(csv, /"x,y",ok/);
	assert.match(csv, /"he said ""no""",1/);
});

test('offline demo report writes files and never replaces live errors', async () => {
	let dir = mkdtempSync(join(tmpdir(), 'npm-stats-'));
	try {
		let config = NormalizeConfig({
			packages: ['demo-a', 'demo-b', '@scope/demo'],
			period: { end: '2026-09-07', days: 7 },
			mode: 'offline',
			outputDir: dir,
		});
		let current = FetchOfflinePackages(config.packages, config.periods.current);
		let previous = FetchOfflinePackages(config.packages, config.periods.previous);
		let comparisons = CompareAllPackages(current, previous, config.periods);
		let report = BuildReport({ config, packageComparisons: comparisons, fetchedAt: '2026-09-23T12:00:00.000Z' });
		assert.equal(report.mode, 'offline');
		assert.match(report.dataSource, /offline-demo/);
		let files = WriteReportFiles(report, dir);
		let json = JSON.parse(readFileSync(files.jsonPath, 'utf8'));
		assert.equal(json.packages.length, 3);
		assert.equal(json.completeness, 'complete');
		let csv = readFileSync(files.csvPath, 'utf8');
		assert.match(csv, /@scope\/demo/);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('live failures stay failed - offline scenario is explicit only', async () => {
	let dir = mkdtempSync(join(tmpdir(), 'npm-stats-live-'));
	try {
		let fetchImpl = async () => ({
			ok: false,
			status: 500,
			text: async () => JSON.stringify({ error: 'boom' }),
		});
		let result = await RunDownloadReport({
			config: NormalizeConfig({
				packages: ['gulp'],
				period: { end: '2026-09-07', days: 7 },
				mode: 'live',
				outputDir: dir,
				fetch: { timeoutMs: 1000, retries: 0, concurrency: 1, retryDelayMs: 1 },
			}),
			fetchImpl,
			present: false,
		});
		assert.equal(result.report.mode, 'live');
		assert.notEqual(result.report.completeness, 'complete');
		assert.equal(result.report.packages[0].current.sum, null);
		assert.equal(result.exitCode, 2);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('IsValidPackageName accepts scoped names', async () => {
	const { IsValidPackageName } = await import('../src/validate.mjs');
	assert.equal(IsValidPackageName('@babel/core'), true);
	assert.equal(IsValidPackageName('gulp'), true);
	assert.equal(IsValidPackageName('gulp,express'), false);
});
