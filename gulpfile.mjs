import { CheckPackageVersions, GetVersionString } from './tools/RecipeRelease.mjs';
CheckPackageVersions();
// ===========================================
// npm-statistics/gulpfile.mjs
// Fetch, compare and present npm download statistics.
// Works with plain gulp CLI and with the µGulp dashboard.
// ===========================================

import { InstallStringExtensions, Log, Warn, LogError, LogTable, LogChart, LogCallout, LogKeyValue, LogBadges } from 'gulp-mu-gulp-api';
import { RunDownloadReport } from './src/run-report.mjs';

InstallStringExtensions();

const API = { Log, Warn, LogError, LogTable, LogChart, LogCallout, LogKeyValue, LogBadges };

/**
 * @param {'live'|'offline'} _mode
 */
async function _RunMode(_mode) {
	let result = await RunDownloadReport({
		configPath: 'config.json',
		mode: _mode,
		api: API,
	});
	if (result.exitCode !== 0) {
		Warn('Report finished with partial or failed package data (exit <code format="int"/>).<context="task warning"/>', {
			code: result.exitCode,
		});
		// Non-zero process exit for CLI; µGulp still shows the structured output.
		if (!process.env.MICROGULP) process.exitCode = result.exitCode;
	} else {
		Log('Report complete.<context="task log"/>');
	}
	return result;
}

export async function REPORT() {
	Log('Building npm download report (mode from config, default live)…<context="task log"/>');
	const { LoadConfig } = await import('./src/validate.mjs');
	let config = LoadConfig('config.json');
	return _RunMode(config.mode === 'offline' ? 'offline' : 'live');
}
REPORT.µKeyBinding = { key: 'ctrl+shift+F1', mac: 'cmd+shift+F1' };
REPORT.µDisplayName = 'Build download report V<recipeVersion/><context="µDisplayName"/>'.i18xRegister();
REPORT.µDescription = 'Loads config.json, fetches or synthesizes download counts, compares equal periods, and writes JSON/CSV plus table/chart output.<context="µDescription"/>'.i18xRegister();
REPORT.µTooltip = 'Uses config.mode when set; otherwise live npm API.<context="µTooltip"/>'.i18xRegister();
REPORT.µIcon = '\uE90A';
REPORT.µGroup = 'Reports<context="µGroup"/>'.i18xRegister();
REPORT.µOrder = 10;
REPORT.µExecutionConcurrency = false;
REPORT.µPresentation = { icon: 'download' };

export async function REPORT_LIVE() {
	Log('Building LIVE npm download report…<context="task log"/>');
	return _RunMode('live');
}
REPORT_LIVE.µDisplayName = 'Live npm report V<recipeVersion/><context="µDisplayName"/>'.i18xRegister();
REPORT_LIVE.µDescription = 'Fetches download ranges from api.npmjs.org for the configured packages and compares the previous equal-length UTC period.<context="µDescription"/>'.i18xRegister();
REPORT_LIVE.µTooltip = 'Requires network access. Never falls back to demo data on failure.<context="µTooltip"/>'.i18xRegister();
REPORT_LIVE.µIcon = '\uE90F';
REPORT_LIVE.µGroup = 'Reports<context="µGroup"/>'.i18xRegister();
REPORT_LIVE.µOrder = 20;
REPORT_LIVE.µExecutionConcurrency = false;
REPORT_LIVE.µPresentation = { icon: 'download' };

export async function REPORT_OFFLINE() {
	Log('Building OFFLINE demo report with synthetic fixtures…<context="task log"/>');
	LogCallout({
		variant: 'warning',
		title: 'Offline demo',
		message: 'Explicit offline mode - synthetic data only.',
	});
	return _RunMode('offline');
}
REPORT_OFFLINE.µKeyBinding = { key: 'ctrl+shift+F9', mac: 'cmd+shift+F9' };
REPORT_OFFLINE.µDisplayName = 'Offline demo report V<recipeVersion/><context="µDisplayName"/>'.i18xRegister();
REPORT_OFFLINE.µDescription = 'Runs the same comparison and export pipeline on synthetic fixture data. Use this without network access.<context="µDescription"/>'.i18xRegister();
REPORT_OFFLINE.µTooltip = 'Marked offline - never used as a silent live fallback.<context="µTooltip"/>'.i18xRegister();
REPORT_OFFLINE.µIcon = '\uE916';
REPORT_OFFLINE.µGroup = 'Reports<context="µGroup"/>'.i18xRegister();
REPORT_OFFLINE.µOrder = 30;
REPORT_OFFLINE.µExecutionConcurrency = true;
REPORT_OFFLINE.µPresentation = { icon: 'test' };

export async function SHOW_CONFIG() {
	const { LoadConfig } = await import('./src/validate.mjs');
	let config = LoadConfig('config.json');
	LogKeyValue({
		title: 'Active configuration',
		items: [
			{ key: 'Packages', value: config.packages.join(', ') },
			{ key: 'Current', value: `${config.periods.current.start} … ${config.periods.current.end}` },
			{ key: 'Previous', value: `${config.periods.previous.start} … ${config.periods.previous.end}` },
			{ key: 'Mode', value: config.mode },
			{ key: 'Output', value: config.outputDir },
			{ key: 'Timeout ms', value: String(config.fetch.timeoutMs) },
			{ key: 'Retries', value: String(config.fetch.retries) },
			{ key: 'Concurrency', value: String(config.fetch.concurrency) },
		],
	});
}
SHOW_CONFIG.µDisplayName = 'Show configuration V<recipeVersion/><context="µDisplayName"/>'.i18xRegister();
SHOW_CONFIG.µDescription = 'Prints the resolved package list, UTC periods and fetch settings from config.json.<context="µDescription"/>'.i18xRegister();
SHOW_CONFIG.µIcon = '\uE914';
SHOW_CONFIG.µGroup = 'Reports<context="µGroup"/>'.i18xRegister();
SHOW_CONFIG.µOrder = 5;
SHOW_CONFIG.µExecutionConcurrency = true;
SHOW_CONFIG.µPresentation = { icon: 'docs' };

export async function RUN_TESTS() {
	Log('Running offline unit tests…<context="task log"/>');
	const { spawn } = await import('node:child_process');
	await new Promise((_resolve, _reject) => {
		let child = spawn(process.execPath, ['--test', 'tests'], {
			stdio: 'inherit',
			cwd: process.cwd(),
			env: { ...process.env, MICROGULP: undefined },
		});
		child.on('exit', (_code) => (_code === 0 ? _resolve() : _reject(new Error(`tests exited ${_code}`))));
		child.on('error', _reject);
	});
	Log('Tests passed.<context="task log"/>');
}
RUN_TESTS.µDisplayName = 'Run tests V<recipeVersion/><context="µDisplayName"/>'.i18xRegister();
RUN_TESTS.µDescription = 'Executes the network-free node:test suite for periods, compare, fetch validation and CSV escaping.<context="µDescription"/>'.i18xRegister();
RUN_TESTS.µIcon = '\uE90B';
RUN_TESTS.µGroup = 'Quality<context="µGroup"/>'.i18xRegister();
RUN_TESTS.µOrder = 10;
RUN_TESTS.µExecutionConcurrency = false;
RUN_TESTS.µPresentation = { icon: 'test' };

export const µGroups = 'open';

export const µI18xContext = { recipeVersion: GetVersionString() };
