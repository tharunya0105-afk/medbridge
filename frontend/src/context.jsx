/**
 * MedBridge global state — React Context + useReducer
 */
import { createContext, useContext, useReducer } from 'react';

const AppContext = createContext(null);

const initialState = {
  lang: 'en',
  sessionId: null,
  demoMode: false,
  demoCaseId: null,

  // Extraction
  meds: [],
  extractionWarnings: [],

  // Confirmation
  confirmedMeds: [],

  // Safety
  alerts: [],

  // Explanations
  explanations: [],

  // Teachback
  teachbackQuestions: [],
  teachbackAnswers: {},   // { questionId: { selected_index, correct, feedback } }
  quizScore: null,

  // UI state
  loading: false,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LANG':
      return { ...state, lang: action.payload };

    case 'SET_SESSION':
      return { ...state, sessionId: action.payload };

    case 'SET_DEMO_MODE':
      return { ...state, demoMode: true, demoCaseId: action.payload };

    case 'SET_EXTRACTION':
      return {
        ...state,
        meds: action.payload.meds,
        extractionWarnings: action.payload.warnings || [],
        demoMode: action.payload.demo_mode || state.demoMode,
        loading: false,
      };

    case 'UPDATE_MED': {
      const meds = state.meds.map(m =>
        m.id === action.payload.id ? { ...m, ...action.payload.changes } : m
      );
      return { ...state, meds };
    }

    case 'CONFIRM_MED': {
      const meds = state.meds.map(m =>
        m.id === action.payload ? { ...m, confirmed: true } : m
      );
      return { ...state, meds };
    }

    case 'UNSURE_MED': {
      const meds = state.meds.map(m =>
        m.id === action.payload ? { ...m, confirmed: false } : m
      );
      return { ...state, meds };
    }

    case 'CONFIRM_ALL': {
      const meds = state.meds.map(m =>
        m.flagged_low_confidence ? m : { ...m, confirmed: true }
      );
      return { ...state, meds };
    }

    case 'SET_ALERTS':
      return { ...state, alerts: action.payload, loading: false };

    case 'SET_EXPLANATIONS':
      return { ...state, explanations: action.payload, loading: false };

    case 'SET_TEACHBACK':
      return { ...state, teachbackQuestions: action.payload, loading: false };

    case 'ANSWER_QUESTION':
      return {
        ...state,
        teachbackAnswers: {
          ...state.teachbackAnswers,
          [action.payload.questionId]: action.payload.result,
        },
      };

    case 'SET_QUIZ_SCORE':
      return { ...state, quizScore: action.payload };

    case 'SET_LOADING':
      return { ...state, loading: action.payload, error: null };

    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };

    case 'RESET':
      return { ...initialState, lang: state.lang };

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
