'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ImagePlus, Mic, SendHorizontal, TrendingUp } from 'lucide-react';

const uiText = {
  EN: {
    placeholder: 'Ask about your crop problem...',
    tip: 'Tip: add crop photo for better advice',
    imageSelected: 'Image selected:',
    uploadAria: 'Upload crop image',
    voiceAria: 'Speak your question',
    sendAria: 'Send question',
    marketAria: 'Open market page',
  },
  TA: {
    placeholder: 'உங்கள் பயிர் பிரச்சினையை கேளுங்கள்...',
    tip: 'சிறந்த ஆலோசனைக்காக பயிர் புகைப்படம் சேர்க்கவும்',
    imageSelected: 'தேர்ந்தெடுத்த படம்:',
    uploadAria: 'பயிர் படத்தை பதிவேற்று',
    voiceAria: 'உங்கள் கேள்வியை பேசுங்கள்',
    sendAria: 'கேள்வியை அனுப்பு',
    marketAria: 'சந்தை பக்கத்தை திற',
  },
} as const;

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState('');
  const [selectedImageName, setSelectedImageName] = useState('');
  const [language, setLanguage] = useState<'EN' | 'TA'>('EN');

  useEffect(() => {
    const urlLang = searchParams.get('lang');
    if (urlLang === 'TA' || urlLang === 'EN') {
      setLanguage(urlLang as 'EN' | 'TA');
      if (typeof window !== 'undefined') {
        localStorage.setItem('appLang', urlLang);
      }
      return;
    }

    setLanguage('EN');
    if (typeof window !== 'undefined') {
      localStorage.setItem('appLang', 'EN');
    }
  }, [searchParams]);

  const handleAsk = () => {
    const params = new URLSearchParams();
    params.set('lang', language);
    if (question.trim()) {
      params.set('q', question.trim());
    }
    router.push(`/assistant?${params.toString()}`);
  };

  const handleImagePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedImageName(file ? file.name : '');
  };

  const handleLanguageToggle = () => {
    const next = language === 'EN' ? 'TA' : 'EN';
    setLanguage(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('appLang', next);
    }
  };

  const t = uiText[language];

  return (
    <div className="max-w-[420px] mx-auto min-h-screen relative overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/images/home-hero.png"
          alt="Farm home hero"
          fill
          className="w-full h-full object-cover"
          priority
        />
      </div>

      <div className="absolute top-6 right-4 flex items-center gap-2">
        <button
          onClick={handleLanguageToggle}
          className="bg-black/45 text-white text-xs rounded-full px-3 py-1.5"
        >
          TA | EN
        </button>
        <button
          onClick={() => router.push(`/market?lang=${language}`)}
          className="w-9 h-9 rounded-full bg-black/45 flex items-center justify-center"
          aria-label={t.marketAria}
        >
          <TrendingUp className="w-4 h-4 text-white" />
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[90%]"
      >
        <div className="bg-white text-black rounded-2xl shadow-xl p-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t.placeholder}
              className="flex-1 bg-transparent outline-none text-black placeholder:text-gray-500"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-lime-600"
              aria-label={t.uploadAria}
            >
              <ImagePlus className="w-4 h-4" />
            </button>
            <button
              onClick={handleAsk}
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-lime-600"
              aria-label={t.voiceAria}
            >
              <Mic className="w-4 h-4" />
            </button>
            <button
              onClick={handleAsk}
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-lime-600"
              aria-label={t.sendAria}
            >
              <SendHorizontal className="w-4 h-4" />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImagePick}
            className="hidden"
          />

          <div className="mt-2 flex items-center justify-between px-2">
            <p className="text-[11px] text-gray-500">
              {selectedImageName
                ? `${t.imageSelected} ${selectedImageName}`
                : t.tip}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
