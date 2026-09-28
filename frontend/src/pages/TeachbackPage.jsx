/**
 * TeachbackPage — Step 5: Comprehension Quiz
 * Evaluates patient retention & understanding of dose, frequency, and critical warnings.
 * Provides immediate feedback with rationales, score calculation, and caregiver alert trigger (<60%).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context';
import { t } from '../i18n';
import { submitTeachbackAnswer } from '../api';
import { StepIndicator, Disclaimer, Loader, ErrorBanner } from '../components/Shared';

export default function TeachbackPage() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const lang = state.lang;

  const questions = state.teachbackQuestions || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [answeredState, setAnsweredState] = useState({}); // { [qId]: { selected, correct, correctIndex, feedback, rationale } }
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const currentQ = questions[currentIndex];
  const isAnswered = currentQ && !!answeredState[currentQ.question_id];
  const answerResult = currentQ ? answeredState[currentQ.question_id] : null;

  async function handleSelectOption(index) {
    if (isAnswered || submitting) return;

    setSelectedOption(index);
    setSubmitting(true);
    setError(null);

    try {
      const res = await submitTeachbackAnswer(state.sessionId, currentQ.question_id, index);
      const resultObj = {
        selected: index,
        correct: res.correct,
        correctIndex: res.correct_index,
        feedback: res.feedback,
        rationale: res.rationale,
      };

      setAnsweredState(prev => ({
        ...prev,
        [currentQ.question_id]: resultObj,
      }));

      dispatch({
        type: 'ANSWER_QUESTION',
        payload: { questionId: currentQ.question_id, result: resultObj },
      });
    } catch (err) {
      console.error('Failed to submit answer:', err);
      setError(err.message || 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
    } else {
      // Completed all questions! Compute final score
      finishQuiz();
    }
  }

  function finishQuiz() {
    const total = questions.length;
    if (total === 0) {
      navigate('/summary');
      return;
    }

    let correctCount = 0;
    questions.forEach(q => {
      const ans = answeredState[q.question_id];
      if (ans && ans.correct) {
        correctCount += 1;
      }
    });

    const finalScore = Math.round((correctCount / total) * 100);
    dispatch({ type: 'SET_QUIZ_SCORE', payload: finalScore });
    navigate('/summary');
  }

  if (questions.length === 0) {
    return (
      <div className="page-container animate-fade-in">
        <StepIndicator current={5} />
        <div className="card text-center" style={{ padding: 'var(--space-8)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>📝</div>
          <h3>No Questions Available</h3>
          <p className="text-muted">
            Safety and medication steps complete! You can view your summary now.
          </p>
          <button className="btn btn--primary mt-4" onClick={() => navigate('/summary')}>
            {t(lang, 'teachback.finish_btn')} →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <StepIndicator current={5} />

      <div className="flex justify-between items-center mb-2">
        <h2>{t(lang, 'teachback.title')}</h2>
        <span className="badge badge--info text-xs">
          {t(lang, 'teachback.question_of', {
            current: currentIndex + 1,
            total: questions.length,
          })}
        </span>
      </div>
      <p className="text-muted mb-4">{t(lang, 'teachback.subtitle')}</p>

      {/* Progress Bar */}
      <div className="progress-bar mb-6">
        <div
          className="progress-bar__fill"
          style={{ width: `${((currentIndex + (isAnswered ? 1 : 0)) / questions.length) * 100}%` }}
        />
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Current Question Card */}
      <div className="card mb-6 animate-slide-up" key={currentQ.question_id}>
        <h3 className="mb-4" style={{ fontSize: '1.25rem' }}>
          {currentQ.question_text || currentQ.text}
        </h3>

        {/* Options */}
        <div className="quiz-options">
          {currentQ.options.map((optText, optIdx) => {
            let optClass = 'quiz-option';
            if (isAnswered) {
              if (optIdx === answerResult.correctIndex) {
                optClass += ' quiz-option--correct';
              } else if (optIdx === answerResult.selected) {
                optClass += ' quiz-option--wrong';
              }
            } else if (selectedOption === optIdx) {
              optClass += ' quiz-option--selected';
            }

            return (
              <button
                key={optIdx}
                type="button"
                className={optClass}
                disabled={isAnswered || submitting}
                onClick={() => handleSelectOption(optIdx)}
              >
                <div className="flex items-center gap-3">
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'var(--color-gray-100)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      color: 'var(--color-gray-700)',
                    }}
                  >
                    {String.fromCharCode(65 + optIdx)}
                  </span>
                  <span>{optText}</span>
                  {isAnswered && optIdx === answerResult.correctIndex && (
                    <span className="ml-auto text-success font-bold">✓</span>
                  )}
                  {isAnswered && optIdx === answerResult.selected && !answerResult.correct && (
                    <span className="ml-auto text-danger font-bold">✗</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {submitting && (
          <div className="text-center py-2 text-sm text-muted">
            <span className="loading-spinner" style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            Checking answer...
          </div>
        )}

        {/* Feedback Section after answering */}
        {isAnswered && (
          <div
            className={`p-4 mt-4 animate-scale-in card ${
              answerResult.correct ? 'card--success' : 'card--warning'
            }`}
          >
            <div className="flex items-center gap-2 mb-2 font-bold">
              <span>{answerResult.correct ? '🎉' : '💡'}</span>
              <span>
                {answerResult.correct
                  ? t(lang, 'teachback.correct_feedback')
                  : t(lang, 'teachback.wrong_feedback')}
              </span>
            </div>

            {answerResult.rationale && (
              <p className="text-sm mb-0 text-gray-700">
                {answerResult.rationale}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Next / Finish Button */}
      {isAnswered && (
        <button
          type="button"
          className="btn btn--primary btn--lg btn--full animate-fade-in"
          onClick={handleNext}
          id="quiz-next-btn"
        >
          {currentIndex < questions.length - 1
            ? `${t(lang, 'teachback.next_btn')} →`
            : `${t(lang, 'teachback.finish_btn')} →`}
        </button>
      )}

      <Disclaimer />
    </div>
  );
}
