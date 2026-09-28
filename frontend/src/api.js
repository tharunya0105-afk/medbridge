/**
 * MedBridge API client — all backend communication.
 * Base URL is proxied by Vite to localhost:8000.
 */
const BASE = '';

async function request(method, path, body, options = {}) {
  const config = {
    method,
    ...options,
  };

  if (body instanceof FormData) {
    config.body = body;
  } else if (body) {
    config.headers = { 'Content-Type': 'application/json', ...config.headers };
    config.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, config);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Health ────────────────────────────────────────────────────────────────────
export const getHealth = () => request('GET', '/api/health');

// ── Session ──────────────────────────────────────────────────────────────────
export const createSession = (lang = 'en') =>
  request('POST', `/api/session?lang=${encodeURIComponent(lang)}`);

export const deleteSession = (sessionId) =>
  request('DELETE', `/api/session/${sessionId}`);

// ── Extract ──────────────────────────────────────────────────────────────────
export async function extractFromImage(file, sessionId) {
  const fd = new FormData();
  fd.append('file', file);
  if (sessionId) fd.append('session_id', sessionId);
  return request('POST', '/api/extract', fd);
}

export async function extractFromDemo(demoCaseId, sessionId) {
  const fd = new FormData();
  fd.append('demo_case_id', demoCaseId);
  if (sessionId) fd.append('session_id', sessionId);
  return request('POST', '/api/extract', fd);
}

// ── Check ────────────────────────────────────────────────────────────────────
export const runCheck = (sessionId, meds) =>
  request('POST', '/api/check', { session_id: sessionId, meds });

// ── Explain ──────────────────────────────────────────────────────────────────
export const getExplanations = (sessionId, meds, lang = 'en') =>
  request('POST', '/api/explain', { session_id: sessionId, meds, lang });

// ── Teachback ────────────────────────────────────────────────────────────────
export const getTeachbackQuestions = (sessionId) =>
  request('GET', `/api/teachback?session_id=${encodeURIComponent(sessionId)}`);

export const submitTeachbackAnswer = (sessionId, questionId, selectedIndex) =>
  request('POST', '/api/teachback/answer', {
    session_id: sessionId,
    question_id: questionId,
    selected_index: selectedIndex,
  });

// ── Summary ──────────────────────────────────────────────────────────────────
export const getSummary = (sessionId) =>
  request('GET', `/api/summary/${sessionId}`);
