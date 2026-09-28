/**
 * MedBridge Application Router & Shell
 */
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context';
import { Header } from './components/Shared';

// Pages
import WelcomePage from './pages/WelcomePage';
import DemoSelectPage from './pages/DemoSelectPage';
import UploadPage from './pages/UploadPage';
import ConfirmPage from './pages/ConfirmPage';
import SafetyPage from './pages/SafetyPage';
import MedicinesPage from './pages/MedicinesPage';
import TeachbackPage from './pages/TeachbackPage';
import SummaryPage from './pages/SummaryPage';

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <div className="app-layout">
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<WelcomePage />} />
              <Route path="/demo" element={<DemoSelectPage />} />
              <Route path="/demo-select" element={<DemoSelectPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/confirm" element={<ConfirmPage />} />
              <Route path="/safety" element={<SafetyPage />} />
              <Route path="/medicines" element={<MedicinesPage />} />
              <Route path="/teachback" element={<TeachbackPage />} />
              <Route path="/summary" element={<SummaryPage />} />
              {/* Fallback route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </HashRouter>
    </AppProvider>
  );
}
