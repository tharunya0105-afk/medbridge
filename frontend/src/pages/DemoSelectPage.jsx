/**
 * DemoSelectPage — choose one of the 6 pre-baked demo cases
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context';
import { t } from '../i18n';
import { extractFromDemo } from '../api';
import { StepIndicator, Disclaimer, Loader } from '../components/Shared';

const CASES = ['case-1', 'case-2', 'case-3', 'case-4', 'case-5', 'case-6'];

export default function DemoSelectPage() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const lang = state.lang;
  const [loading, setLoading] = useState(false);

  async function selectCase(caseId) {
    setLoading(true);
    dispatch({ type: 'SET_DEMO_MODE', payload: caseId });
    try {
      const result = await extractFromDemo(caseId, state.sessionId);
      dispatch({ type: 'SET_EXTRACTION', payload: result });
      navigate('/confirm');
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message });
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <StepIndicator current={1} />
        <Loader text={t(lang, 'capture.processing')} />
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <StepIndicator current={1} />

      <h2 className="mb-2">{t(lang, 'welcome.start_demo')}</h2>
      <p className="text-muted mb-6">
        Choose a sample discharge case to explore MedBridge's safety features.
      </p>

      <div className="demo-cases">
        {CASES.map(caseId => {
          const info = t(lang, `demo_cases.${caseId}`);
          return (
            <button
              key={caseId}
              className="demo-case-btn"
              onClick={() => selectCase(caseId)}
              id={`demo-${caseId}-btn`}
            >
              <span className="demo-case-btn__title">{info?.title || caseId}</span>
              <span className="demo-case-btn__desc">{info?.desc || ''}</span>
            </button>
          );
        })}
      </div>

      <Disclaimer />
    </div>
  );
}
