'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { motion } from 'framer-motion';
import { mockChatHistory, mockAIResponses } from '@/data/mockData';
import Image from 'next/image';
import {
  Send,
  ArrowLeft,
  Leaf,
  Cloud,
  Pill,
  TrendingUp,
  ArrowUpRight,
  Play,
  Pause,
  CircleUserRound,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

interface ChatMessage {
  id: number;
  type: 'user' | 'ai';
  message: string;
  weatherInsight?: string;
  marketInsight?: string;
  timestamp: Date;
}

const uiText = {
  EN: {
    title: 'Farm Assistant',
    subtitle: 'Your AI farming guide',
    intro: 'Ask anything about your crop, weather, or market decisions.',
    play: 'Play voice',
    playing: 'Playing',
    inputPlaceholder: 'Ask a follow-up question...',
    diagnosis: 'Diagnosis',
    weather: 'Weather Impact',
    treatment: 'Treatment',
    market: 'Market Insight',
    diagnosisDesc: 'Possible nutrient deficiency detected in leaves.',
    treatmentDesc: 'Apply neem spray weekly for safer control.',
    weatherDesc: 'Monsoon rains expected in 5-7 days.',
    marketDesc: 'Local demand is rising in your area.',
  },
  TA: {
    title: 'பண்ணை உதவியாளர்',
    subtitle: 'உங்கள் AI வேளாண் வழிகாட்டி',
    intro: 'பயிர், வானிலை, சந்தை முடிவுகள் பற்றி எதையும் கேளுங்கள்.',
    play: 'குரல் இயக்கு',
    playing: 'இயங்குகிறது',
    inputPlaceholder: 'அடுத்து கேள்வியை கேளுங்கள்...',
    diagnosis: 'நோய் கண்டறிதல்',
    weather: 'வானிலை பாதிப்பு',
    treatment: 'சிகிச்சை',
    market: 'சந்தை பார்வை',
    diagnosisDesc: 'இலைகளில் சத்துக்குறைபாடு இருக்கலாம்.',
    treatmentDesc: 'பாதுகாப்பான கட்டுப்பாட்டுக்கு வாரம் ஒருமுறை வேப்பச் சாறு தெளிக்கவும்.',
    weatherDesc: '5-7 நாட்களில் மழை வாய்ப்பு உள்ளது.',
    marketDesc: 'உங்கள் பகுதியில் உள்ளூர் தேவை அதிகரித்து வருகிறது.',
  },
} as const;

const cardDesign = [
  { icon: Leaf, tone: 'from-primary/20 to-primary/5' },
  { icon: Cloud, tone: 'from-secondary/20 to-secondary/5' },
  { icon: Pill, tone: 'from-accent/20 to-accent/5' },
  { icon: TrendingUp, tone: 'from-primary/15 to-accent/10' },
];

export default function AssistantPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userQuery = searchParams.get('q')?.trim() ?? '';
  const [language, setLanguage] = useState<'EN' | 'TA'>('EN');
  const t = uiText[language];

  const initialMessages = useMemo<ChatMessage[]>(() => {
    if (userQuery) {
      return [
        {
          id: Date.now(),
          type: 'user',
          message: userQuery,
          timestamp: new Date(),
        },
        {
          id: Date.now() + 1,
          type: 'ai',
          message: mockAIResponses.textResponse,
          weatherInsight: mockAIResponses.weatherInsight,
          marketInsight: mockAIResponses.marketInsight,
          timestamp: new Date(),
        },
      ];
    }
    return mockChatHistory as ChatMessage[];
  }, [userQuery]);

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<number | null>(null);

  useEffect(() => {
    const urlLang = searchParams.get('lang');
    const storedLang =
      typeof window !== 'undefined' ? localStorage.getItem('appLang') : null;
    const nextLang =
      urlLang === 'TA' || urlLang === 'EN'
        ? urlLang
        : storedLang === 'TA' || storedLang === 'EN'
          ? storedLang
          : 'EN';
    setLanguage(nextLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('appLang', nextLang);
    }
  }, [searchParams]);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const stopSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setSpeakingMessageId(null);
    utteranceRef.current = null;
  };

  const playSpeech = (messageId: number, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = () => {
      setSpeakingMessageId((current) => (current === messageId ? null : current));
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setSpeakingMessageId((current) => (current === messageId ? null : current));
      utteranceRef.current = null;
    };
    utteranceRef.current = utterance;
    setSpeakingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userText = inputValue.trim();
    const userMessage = {
      id: Date.now(),
      type: 'user' as const,
      message: userText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');

    await new Promise((resolve) => setTimeout(resolve, 1000));
    const aiMessage = {
      id: Date.now() + 1,
      type: 'ai' as const,
      message: mockAIResponses.textResponse,
      weatherInsight: mockAIResponses.weatherInsight,
      marketInsight: mockAIResponses.marketInsight,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, aiMessage]);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="h-screen flex flex-col bg-gradient-to-b from-background via-primary/5 to-background relative"
    >
      <motion.div
        variants={itemVariants}
        className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border"
      >
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/?lang=${language}`)}
              className="p-2 hover:bg-muted rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-foreground">{t.title}</h1>
              <p className="text-xs text-muted-foreground">{t.subtitle}</p>
            </div>
          </div>
          <button
            className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center"
            aria-label="User profile"
          >
            <CircleUserRound className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </motion.div>

      <motion.div
        ref={scrollContainerRef}
        variants={itemVariants}
        className="h-[75vh] overflow-y-auto"
      >
        <div className="max-w-md mx-auto px-4 py-4 pb-44 space-y-4">
          {messages.length === 0 && !userQuery && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-accent p-[2px] shadow-sm">
                <div className="relative w-full h-full rounded-full overflow-hidden bg-background">
                  <Image
                    src="/images/farmer-mascot.png"
                    alt="Mascot"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
              <div className="bg-muted text-foreground rounded-2xl rounded-tl-md px-4 py-3 max-w-[80%] shadow-sm">
                {t.intro}
              </div>
            </motion.div>
          )}

          {messages.map((message) => {
            const insightCards = [
              {
                ...cardDesign[0],
                title: t.diagnosis,
                description: t.diagnosisDesc,
              },
              {
                ...cardDesign[1],
                title: t.weather,
                description: message.weatherInsight ?? t.weatherDesc,
              },
              {
                ...cardDesign[2],
                title: t.treatment,
                description: t.treatmentDesc,
              },
              {
                ...cardDesign[3],
                title: t.market,
                description: message.marketInsight ?? t.marketDesc,
              },
            ];

            if (message.type === 'user') {
              return (
                <div key={message.id} className="flex justify-end">
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-4 py-3 max-w-[80%] shadow-sm"
                  >
                    {message.message}
                  </motion.div>
                </div>
              );
            }

            return (
              <div key={message.id} className="space-y-3">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 p-[1px] mt-1">
                    <div className="relative w-full h-full rounded-full overflow-hidden bg-background">
                      <Image
                        src="/images/farmer-mascot.png"
                        alt="Mascot"
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-muted text-foreground rounded-2xl rounded-tl-md px-4 py-3 max-w-[80%] shadow-sm"
                  >
                    {message.message}
                    <div className="mt-3">
                      <button
                        onClick={() =>
                          speakingMessageId === message.id
                            ? stopSpeech()
                            : playSpeech(message.id, message.message)
                        }
                        className="w-full rounded-2xl bg-background/80 border border-border px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                            {speakingMessageId === message.id ? (
                              <Pause className="w-3 h-3" />
                            ) : (
                              <Play className="w-3 h-3 ml-[1px]" />
                            )}
                          </div>
                          <div className="flex-1 flex items-end gap-1 h-5">
                            <span className="w-1 rounded-full bg-primary/70 h-2" />
                            <span className="w-1 rounded-full bg-primary/70 h-4" />
                            <span className="w-1 rounded-full bg-primary/70 h-3" />
                            <span className="w-1 rounded-full bg-primary/70 h-5" />
                            <span className="w-1 rounded-full bg-primary/70 h-3" />
                            <span className="w-1 rounded-full bg-primary/70 h-4" />
                            <span className="w-1 rounded-full bg-primary/70 h-2" />
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {speakingMessageId === message.id ? t.playing : t.play}
                          </span>
                        </div>
                      </button>
                    </div>
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0, x: 32 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="ml-10 grid grid-cols-2 gap-3 pb-2"
                >
                  {insightCards.map((card) => (
                    <div
                      key={`${message.id}-${card.title}`}
                      className={`rounded-2xl shadow-sm p-3 h-28 bg-gradient-to-br ${card.tone} border border-border flex flex-col justify-between`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-background/80 flex items-center justify-center shrink-0">
                          <card.icon className="w-4 h-4 text-foreground" />
                        </div>
                        <p className="font-semibold text-sm text-foreground leading-tight">
                          {card.title}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground leading-tight line-clamp-2">
                        {card.description}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <ArrowUpRight className="w-3 h-3" />
                        <span>View recommendation</span>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </div>
            );
          })}
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="fixed bottom-20 left-0 right-0 border-t border-border bg-background/80 backdrop-blur-md"
      >
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center gap-2 rounded-full bg-card/90 border border-border shadow-sm p-1">
            <input
              type="text"
              placeholder={t.inputPlaceholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage();
                }
              }}
              className="flex-1 bg-transparent rounded-full p-3 focus:outline-none text-foreground placeholder:text-muted-foreground"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSendMessage}
              disabled={!inputValue.trim()}
              className="bg-primary text-primary-foreground w-11 h-11 rounded-full font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center"
            >
              <Send className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </motion.div>

      <BottomNavigation />
    </motion.div>
  );
}
