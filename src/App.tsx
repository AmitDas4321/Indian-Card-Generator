import React, { useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { CardForm } from './components/CardForm';
import { CardPreview } from './components/CardPreview';
import { DownloadButton } from './components/DownloadButton';
import { SocialPromo } from './components/SocialPromo';
import { Footer } from './components/Footer';
import { VerificationPage } from './components/VerificationPage';
import { CardData, FormErrors } from './types';
import { validateCardData } from './utils/validation';
import { getNextSequencePreview } from './services/firebaseCertificate';
import { getLocallySavedCard, isCardLocallyLocked } from './services/localCardStorage';

const INITIAL_DATA: CardData = {
  photoUrl: null,
  name: '',
  idNumber: 'IND-2026-7890',
  phoneNumber: '',
  address: '',
};

type RouteState =
  | { view: 'home' }
  | { view: 'verify'; id: string };

function parseCurrentRoute(): RouteState {
  if (typeof window === 'undefined') return { view: 'home' };

  const path = window.location.pathname;
  if (path.startsWith('/verify')) {
    const parts = path.split('/').filter(Boolean);
    // e.g. /verify/IND-2026-7890 -> parts = ['verify', 'IND-2026-7890']
    if (parts.length >= 2) {
      return { view: 'verify', id: parts[1] };
    }
    return { view: 'verify', id: '' };
  }
  return { view: 'home' };
}

export default function App() {
  const [route, setRoute] = useState<RouteState>(parseCurrentRoute);

  // Initialize from local database / localStorage if card was already generated
  const [cardData, setCardData] = useState<CardData>(() => {
    const saved = getLocallySavedCard();
    if (saved && saved.idNumber && saved.name) {
      return {
        photoUrl: saved.photoUrl || null,
        name: saved.name || '',
        idNumber: saved.idNumber,
        phoneNumber: saved.phoneNumber || '',
        address: saved.address || '',
      };
    }
    return INITIAL_DATA;
  });

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    return isCardLocallyLocked() || Boolean(getLocallySavedCard());
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Listen for browser navigation (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseCurrentRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch initial next sequence preview from Firebase only if not already locked with saved card
  useEffect(() => {
    if (isLocked) return;

    const saved = getLocallySavedCard();
    if (saved && saved.idNumber) return;

    getNextSequencePreview()
      .then((nextId) => {
        setCardData((prev) => ({ ...prev, idNumber: nextId }));
      })
      .catch((err) => {
        console.warn('Could not fetch next sequence ID preview:', err);
      });
  }, [isLocked]);

  const navigateToVerify = (id: string) => {
    const cleanId = id.trim();
    const targetUrl = cleanId ? `/verify/${cleanId}` : '/verify';
    window.history.pushState({}, '', targetUrl);
    setRoute({ view: 'verify', id: cleanId });
  };

  const navigateToHome = () => {
    window.history.pushState({}, '', '/');
    setRoute({ view: 'home' });
  };

  const handleCardDataChange = (newData: CardData) => {
    if (isLocked) return; // Block changes when locked

    setCardData(newData);
    // Clear errors when fields are edited
    if (Object.keys(errors).length > 0) {
      const { errors: newErrors } = validateCardData(newData);
      setErrors(newErrors);
    }
  };

  const handleClear = () => {
    if (isLocked) return; // Block clearing when locked

    setCardData((prev) => ({
      photoUrl: null,
      name: '',
      idNumber: prev.idNumber || 'IND-2026-7890',
      phoneNumber: '',
      address: '',
    }));
    setErrors({});
  };

  const handleCertificateGenerated = (assignedId: string) => {
    // Keep the assigned ID fixed, lock the form and state
    setCardData((prev) => ({
      ...prev,
      idNumber: assignedId,
    }));
    setIsLocked(true);
    setErrors({});
  };

  // Render Verification View
  if (route.view === 'verify') {
    return (
      <VerificationPage
        initialId={route.id}
        onNavigateHome={navigateToHome}
        onNavigateVerify={navigateToVerify}
      />
    );
  }

  // Render Generator View
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020817] text-slate-800 dark:text-[#dfe2e8] flex flex-col font-sans selection:bg-[#ff9800] selection:text-black transition-colors duration-200">
      {/* Top Sticky Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1080px] mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Two-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
          {/* Left Column: Form Panel */}
          <div className="w-full">
            <CardForm
              data={cardData}
              onChange={handleCardDataChange}
              onClear={handleClear}
              errors={errors}
              isLocked={isLocked}
            />
          </div>

          {/* Right Column: Live Preview & Action Buttons */}
          <div className="w-full space-y-5">
            <CardPreview data={cardData} canvasRef={canvasRef} />

            <DownloadButton
              data={cardData}
              canvasRef={canvasRef}
              onValidationError={(errs) => setErrors(errs)}
              onCertificateGenerated={handleCertificateGenerated}
              isLocked={isLocked}
            />

            <SocialPromo />
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

