import { useNavigate } from 'react-router-dom';
import { useApp } from '../context';
import { t } from '../i18n';

export function Header() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const lang = state.lang;

  return (
    <header className="app-header" id="app-header">
      <a href="#/" className="app-header__logo" onClick={e => { e.preventDefault(); dispatch({ type: 'RESET' }); navigate('/'); }}>
        <div className="app-header__icon">💊</div>
        <span className="app-header__title">{t(lang, 'app_name')}</span>
      </a>

      <div className="app-header__controls">
        {state.demoMode && (
          <span className="badge badge--demo">{t(lang, 'demo_badge')}</span>
        )}
        <div className="lang-toggle">
          <button
            className={`lang-toggle__btn ${lang === 'en' ? 'lang-toggle__btn--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_LANG', payload: 'en' })}
            id="lang-en-btn"
          >
            EN
          </button>
          <button
            className={`lang-toggle__btn ${lang === 'ta' ? 'lang-toggle__btn--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_LANG', payload: 'ta' })}
            id="lang-ta-btn"
          >
            தமிழ்
          </button>
        </div>
      </div>
    </header>
  );
}

export function StepIndicator({ current }) {
  const steps = [
    { num: 1, label: 'Upload' },
    { num: 2, label: 'Confirm' },
    { num: 3, label: 'Safety' },
    { num: 4, label: 'Medicines' },
    { num: 5, label: 'Quiz' },
    { num: 6, label: 'Summary' },
  ];

  return (
    <nav className="steps" aria-label="Progress steps">
      {steps.map((step, i) => {
        const isDone = step.num < current;
        const isActive = step.num === current;
        return (
          <div key={step.num} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && <div className="step__connector" />}
            <div className={`step ${isActive ? 'step--active' : ''} ${isDone ? 'step--done' : ''}`}>
              <div className="step__number">
                {isDone ? '✓' : step.num}
              </div>
              <span>{step.label}</span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function Disclaimer() {
  const { state } = useApp();
  return (
    <div className="disclaimer" id="disclaimer-footer">
      {t(state.lang, 'disclaimer')}
    </div>
  );
}

export function Loader({ text = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center" style={{ padding: '4rem 2rem' }}>
      <div className="loading-spinner loading-spinner--lg" />
      <p className="text-muted mt-4" style={{ fontSize: 'var(--font-size-lg)' }}>{text}</p>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  return (
    <div className="card card--danger animate-slide-up" style={{ marginBottom: 'var(--space-4)' }}>
      <div className="flex items-center gap-2">
        <span style={{ fontSize: '1.25rem' }}>⚠️</span>
        <span className="font-semibold">{message}</span>
      </div>
      {onRetry && (
        <button className="btn btn--secondary btn--sm mt-4" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function SeverityBadge({ severity }) {
  const map = { major: 'badge--major', moderate: 'badge--moderate', info: 'badge--info' };
  const labels = { major: '⚠ Major', moderate: '⚡ Moderate', info: 'ℹ Info' };
  return (
    <span className={`badge ${map[severity] || 'badge--info'}`}>
      {labels[severity] || severity}
    </span>
  );
}

export function ActionBadge({ action }) {
  const map = {
    'Ask your pharmacist': 'alert-card__action--pharmacist',
    'Contact your doctor': 'alert-card__action--doctor',
    'Seek urgent care': 'alert-card__action--urgent',
  };
  return (
    <span className={`alert-card__action ${map[action] || ''}`}>
      📋 {action}
    </span>
  );
}
