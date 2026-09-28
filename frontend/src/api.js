/**
 * MedBridge API client with resilient client-side fallbacks.
 * Communicates with FastAPI backend when available, and falls back to
 * internal deterministic rules engine for GitHub Pages or offline use.
 */
import {
  DEMO_CASES,
  evaluateRulesClientSide,
  generateExplanationsClientSide,
  generateQuestionsClientSide,
} from './mockData';

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
export const getHealth = async () => {
  try {
    return await request('GET', '/api/health');
  } catch (e) {
    return { status: 'ok', demo_mode: true, local_fallback: true };
  }
};

// ── Session ──────────────────────────────────────────────────────────────────
export const createSession = async (lang = 'en') => {
  try {
    return await request('POST', `/api/session?lang=${encodeURIComponent(lang)}`);
  } catch (e) {
    return {
      session_id: 'session-' + Date.now(),
      created_at: new Date().toISOString(),
      lang,
    };
  }
};

export const deleteSession = async (sessionId) => {
  try {
    return await request('DELETE', `/api/session/${sessionId}`);
  } catch (e) {
    return { status: 'deleted' };
  }
};

// ── Extract ──────────────────────────────────────────────────────────────────
export async function extractFromImage(file, sessionId) {
  try {
    const fd = new FormData();
    fd.append('file', file);
    if (sessionId) fd.append('session_id', sessionId);
    return await request('POST', '/api/extract', fd);
  } catch (e) {
    // If backend OCR is offline, fall back to sample case with low-confidence alert
    console.warn('Backend extract unavailable, using demo extraction fallback:', e);
    const demo = DEMO_CASES['case-3'];
    return {
      meds: demo.meds,
      warnings: ['OCR backend offline — loaded sample case for preview.'],
      demo_mode: true,
    };
  }
}

export async function extractFromDemo(demoCaseId, sessionId) {
  try {
    const fd = new FormData();
    fd.append('demo_case_id', demoCaseId);
    if (sessionId) fd.append('session_id', sessionId);
    return await request('POST', '/api/extract', fd);
  } catch (e) {
    console.warn('Backend extract unavailable, using local demo data:', e);
    const demo = DEMO_CASES[demoCaseId] || DEMO_CASES['case-1'];
    return {
      meds: demo.meds,
      warnings: [],
      demo_mode: true,
    };
  }
}

// ── Check ────────────────────────────────────────────────────────────────────
export const runCheck = async (sessionId, meds) => {
  try {
    return await request('POST', '/api/check', { session_id: sessionId, meds });
  } catch (e) {
    console.warn('Backend check unavailable, evaluating rules client-side:', e);
    const alerts = evaluateRulesClientSide(meds);
    return { alerts, disclaimer: 'Not medical advice. Confirm all results with a pharmacist.' };
  }
};

// ── Explain ──────────────────────────────────────────────────────────────────
export const getExplanations = async (sessionId, meds, lang = 'en') => {
  try {
    return await request('POST', '/api/explain', { session_id: sessionId, meds, lang });
  } catch (e) {
    console.warn('Backend explain unavailable, generating explanations client-side:', e);
    const items = generateExplanationsClientSide(meds);
    return { items, demo_cached: true };
  }
};

// ── Teachback ────────────────────────────────────────────────────────────────
let _activeQuestions = [];

export const getTeachbackQuestions = async (sessionId) => {
  try {
    const res = await request('GET', `/api/teachback?session_id=${encodeURIComponent(sessionId)}`);
    _activeQuestions = res.questions || [];
    return res;
  } catch (e) {
    console.warn('Backend teachback unavailable, generating questions client-side:', e);
    // Retrieve confirmed meds from local context or fallback
    const questions = generateQuestionsClientSide([
      { id: 'm1', name_raw: 'Your Medication', frequency_per_day: 1, duration_days: 30, confirmed: true }
    ]);
    _activeQuestions = questions;
    return { questions, total: questions.length };
  }
};

export const submitTeachbackAnswer = async (sessionId, questionId, selectedIndex) => {
  try {
    return await request('POST', '/api/teachback/answer', {
      session_id: sessionId,
      question_id: questionId,
      selected_index: selectedIndex,
    });
  } catch (e) {
    const q = _activeQuestions.find(item => item.question_id === questionId);
    const correctIndex = q ? q.correct_index : 0;
    const isCorrect = selectedIndex === correctIndex;
    return {
      correct: isCorrect,
      correct_index: correctIndex,
      feedback: isCorrect ? 'Correct! ✓' : `Not quite. The correct answer was option ${String.fromCharCode(65 + correctIndex)}.`,
      rationale: q?.rationale || 'Always confirm dosage and instructions with your doctor or pharmacist.',
    };
  }
};

// ── Summary ──────────────────────────────────────────────────────────────────
export const getSummary = async (sessionId) => {
  try {
    return await request('GET', `/api/summary/${sessionId}`);
  } catch (e) {
    return null; // Signals component to use local state
  }
};
