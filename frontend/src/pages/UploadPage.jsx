/**
 * UploadPage — image upload / camera capture
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context';
import { t } from '../i18n';
import { extractFromImage } from '../api';
import { StepIndicator, Disclaimer, Loader, ErrorBanner } from '../components/Shared';

export default function UploadPage() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const lang = state.lang;
  const fileRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  async function handleFile(file) {
    if (!file) return;

    // Validate type
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setError('Unsupported file type. Please upload JPEG, PNG, or PDF.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10 MB.');
      return;
    }

    // Show preview for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    }

    setError(null);
    setLoading(true);

    try {
      const result = await extractFromImage(file, state.sessionId);
      dispatch({ type: 'SET_EXTRACTION', payload: result });

      if (result.quality_fail) {
        setError(result.reason || 'Image quality too low.');
        setLoading(false);
        setPreview(null);
        return;
      }

      navigate('/confirm');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  }

  if (loading) {
    return (
      <div className="page-container">
        <StepIndicator current={1} />
        {preview && (
          <div className="text-center mb-6 animate-scale-in">
            <img
              src={preview}
              alt="Upload preview"
              style={{
                maxWidth: '300px',
                maxHeight: '200px',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                margin: '0 auto',
              }}
            />
          </div>
        )}
        <Loader text={t(lang, 'capture.processing')} />
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <StepIndicator current={1} />

      <h2 className="mb-2">{t(lang, 'capture.title')}</h2>
      <p className="text-muted mb-6">
        Take a clear photo of your discharge summary. We'll read the medicines automatically.
      </p>

      {error && <ErrorBanner message={error} onRetry={() => { setError(null); setPreview(null); }} />}

      {/* Upload zone */}
      <div
        className={`upload-zone ${dragActive ? 'upload-zone--active' : ''}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        id="upload-zone"
      >
        <div className="upload-zone__icon">📄</div>
        <div className="upload-zone__text">{t(lang, 'capture.upload_btn')}</div>
        <div className="upload-zone__hint">
          Drag & drop or click to browse • JPEG, PNG, PDF • Max 10 MB
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files?.[0])}
        id="file-input"
      />

      {/* Camera button (mobile) */}
      <div className="mt-4 text-center">
        <button
          className="btn btn--secondary btn--lg"
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.capture = 'environment';
            input.onchange = e => handleFile(e.target.files?.[0]);
            input.click();
          }}
          id="camera-btn"
        >
          📷 {t(lang, 'capture.camera_btn')}
        </button>
      </div>

      <Disclaimer />
    </div>
  );
}
