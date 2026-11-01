// frigg
// Copyright (C) 2026 Carlos de Obaldia Pastor
// SPDX-License-Identifier: AGPL-3.0-or-later

// Simple debug logger with toggle
export let DEBUG = true;
export function setDebug(val: boolean) { DEBUG = val; }
// trace toggle (hardcoded default true as requested)
export let TRACE_ENABLED = true;
export function setTrace(val: boolean) { TRACE_ENABLED = val; }

// simple in-memory log buffer and subscription so the UI can show debug logs
const _logs: string[] = [];
type Subscriber = (msg: string) => void;
const _subs: Subscriber[] = [];

export function getLogs() { return _logs.slice(); }
export function clearLogs() { _logs.length = 0; _subs.forEach(s => s('__CLEARED__')); }
export function subscribeLogs(fn: Subscriber) { _subs.push(fn); return () => { const i = _subs.indexOf(fn); if (i >= 0) _subs.splice(i, 1); }; }

export function debugLog(...args: any[]) {
	const msg = args.map(a => {
		try { return typeof a === 'string' ? a : JSON.stringify(a); } catch { return String(a); }
	}).join(' ');
	if (DEBUG) console.log('[DEBUG]', ...args);
	_logs.push(msg);
	_subs.forEach(s => s(msg));
}

// simple trace events buffer (for frame-level tracing)
const _trace: any[] = [];
export function getTrace() { return _trace.slice(); }
export function clearTrace() { _trace.length = 0; }
export function traceEvent(ev: any) {
	if (!TRACE_ENABLED) return;
	try {
		const t = Object.assign({ ts: Date.now() }, ev);
		_trace.push(t);
		if (DEBUG) console.log('[TRACE]', t);
	} catch (e) { if (DEBUG) console.warn('traceEvent error', e); }
}