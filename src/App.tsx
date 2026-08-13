import React, { useRef, useState } from 'react';
import { Header } from './components/Header';
import { CardForm } from './components/CardForm';
import { CardPreview } from './components/CardPreview';
import { DownloadButton } from './components/DownloadButton';
import { SocialPromo } from './components/SocialPromo';
import { Footer } from './components/Footer';
import { CardData, FormErrors } from './types';
import { validateCardData } from './utils/validation';

const INITIAL_DATA: CardData = {
  photoUrl: null,
  name: '',
  idNumber: 'IND-2026-7890',
  phoneNumber: '',
  address: '',
};

export default function App() {
  const [cardData, setCardData] = useState<CardData>(INITIAL_DATA);
  const [errors, setErrors] = useState<FormErrors>({});
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleCardDataChange = (newData: CardData) => {
    setCardData(newData);
    // Clear errors when fields are edited
    if (Object.keys(errors).length > 0) {
      const { errors: newErrors } = validateCardData(newData);
      setErrors(newErrors);
    }
  };

  const handleClear = () => {
    setCardData({
      photoUrl: null,
      name: '',
      idNumber: 'IND-2026-7890',
      phoneNumber: '',
      address: '',
    });
    setErrors({});
  };

  return (
    <div className="min-h-screen bg-[#020817] text-[#dfe2e8] flex flex-col font-sans selection:bg-[#ff9800] selection:text-black">
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
            />
          </div>

          {/* Right Column: Live Preview & Action Buttons */}
          <div className="w-full space-y-5">
            <CardPreview data={cardData} canvasRef={canvasRef} />

            <DownloadButton
              data={cardData}
              canvasRef={canvasRef}
              onValidationError={(errs) => setErrors(errs)}
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
