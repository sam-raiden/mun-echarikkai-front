'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';

interface Insight {
  type: string;
  title: string;
  description: string;
}

interface QueryResult {
  summary: string;
  insights: Insight[];
  risk_score: number;
  final_score: number;
  confidence_level: string;
  language: string;
  audio_url: string | null;
}

interface Question {
  field: string;
  question: string;
  question_ta: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  result?: QueryResult;
  questions?: Question[];
  isLoading?: boolean;
  isForm?: boolean;
  isError?: boolean;
}

const uiText = {
  EN: {
    title: 'Farm Assistant',
    subtitle: 'Your AI farming guide',
    inputPlaceholder: 'Ask a follow-up question...',
    analyzing: 'Analyzing your farm...',
    analyzingSubtext: 'This takes about 30 seconds',
    play: 'Play voice',
    playing: 'Playing...',
    listenTamil: 'Listen in Tamil',
    generatingAudio: 'Generating Tamil audio...',
    moreDetails: 'I need a few more details:',
    analyze: 'Analyze →',
    retry: 'Retry',
    errorMsg: 'Could not connect to server. Make sure backend is running.',
    viewRec: 'View recommendation',
  },
  TA: {
    title: 'பண்ணை உதவியாளர்',
    subtitle: 'உங்கள் AI வழிகாட்டி',
    inputPlaceholder: 'அடுத்த கேள்வியை கேளுங்கள்...',
    analyzing: 'பகுப்பாய்வு செய்கிறோம்...',
    analyzingSubtext: 'சுமார் 30 விநாடிகள் ஆகும்',
    play: 'குரல் இயக்கு',
    playing: '▶ இயங்குகிறது...',
    listenTamil: '🔊 தமிழில் கேளுங்கள்',
    generatingAudio: '⏳ ஆடியோ தயாராகிறது...',
    moreDetails: 'சில விவரங்கள் தேவை:',
    analyze: 'பகுப்பாய்வு →',
    retry: 'மீண்டும் முயற்சி',
    errorMsg: 'இணைக்க முடியவில்லை. Backend இயங்குகிறதா என சரிபார்க்கவும்.',
    viewRec: 'பரிந்துரை காண்க',
  },
} as const;

const CARD_STYLES = [
  { bg: '#F0FDF4', border: '#2ECC71', icon: '🌱' },
  { bg: '#EFF6FF', border: '#3498DB', icon: '🌦️' },
  { bg: '#FFFBEB', border: '#F39C12', icon: '💊' },
  { bg: '#FAF5FF', border: '#9B59B6', icon: '📈' },
];

function AssistantPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialLang = (searchParams.get('lang') as 'EN' | 'TA') || 'EN';
  const cropParam = searchParams.get('crop') || '';
  const locationParam = searchParams.get('location') || '';
  const monthParam = searchParams.get('month') || '';
  const irrigationParam = searchParams.get('irrigation') || '';

  const [language, setLanguage] = useState<'EN' | 'TA'>(initialLang);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [formAnswers, setFormAnswers] = useState<Record<string, string>>({});
  const [context, setContext] = useState({
    crop: cropParam,
    location: locationParam,
    month: monthParam,
    irrigation: irrigationParam,
    land_size_acres: 2,
    market_dependency: true,
  });

  const audioRef = useRef<HTMLAudioElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const t = uiText[language];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (initialQuery) {
      runQuery(initialQuery, {
        crop: cropParam,
        location: locationParam,
        month: monthParam,
        irrigation: irrigationParam,
        land_size_acres: 2,
        market_dependency: true,
      });
    }
  }, []);

  const runQuery = async (q: string, ctx: Record<string, any>) => {
    const userMsgId = Date.now().toString();
    const loadingId = userMsgId + '-loading';

    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', text: q },
      { id: loadingId, role: 'assistant', text: '', isLoading: true },
    ]);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          language,
          context: {
            crop: ctx.crop || '',
            location: ctx.location || '',
            month: ctx.month || '',
            irrigation: ctx.irrigation || '',
            land_size_acres: ctx.land_size_acres || 2,
            market_dependency: ctx.market_dependency ?? true,
          },
        }),
      });

      const data = await res.json();

      if (data.status === 'complete' && data.result) {
        setContext(ctx as typeof context);
        setMessages(prev =>
          prev.map(m =>
            m.id === loadingId
              ? { ...m, isLoading: false, result: data.result, text: data.result.summary }
              : m
          )
        );
        if (data.result.language === 'TA' || language === 'TA') {
          fetchAudio(data.result.summary);
        }
      } else if (data.status === 'questions_needed') {
        setMessages(prev =>
          prev.map(m =>
            m.id === loadingId
              ? { ...m, isLoading: false, isForm: true, questions: data.questions, text: '' }
              : m
          )
        );
      } else {
        setMessages(prev =>
          prev.map(m =>
            m.id === loadingId
              ? { ...m, isLoading: false, isError: true, text: t.errorMsg }
              : m
          )
        );
      }
    } catch (e) {
      setMessages(prev =>
        prev.map(m =>
          m.id === loadingId
            ? { ...m, isLoading: false, isError: true, text: t.errorMsg }
            : m
        )
      );
    }
  };

  const fetchAudio = async (text: string) => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: 'TA' })
      });
      const data = await res.json();
      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
        if (audioRef.current) {
          audioRef.current.src = data.audioUrl;
          audioRef.current.load();
        }
      }
    } catch (e) {
      console.log('TTS error:', e);
    }
  };

  const toggleAudio = () => {
    if (!audioUrl) return
    if (!audioRef.current) return
    
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      const audio = audioRef.current
      audio.src = audioUrl
      audio.currentTime = 0
      audio.load()
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise
          .then(() => setPlaying(true))
          .catch(() => setPlaying(false))
      }
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const q = input.trim();
    setInput('');
    runQuery(q, context);
  };

  const handleFormSubmit = (questions: Question[]) => {
    const ctx = { ...context };
    questions.forEach(q => {
      if (formAnswers[q.field]) (ctx as any)[q.field] = formAnswers[q.field];
    });
    setContext(ctx);
    setFormAnswers({});
    runQuery(initialQuery || input, ctx);
  };

  const handleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert('Use Chrome for voice input');
      return;
    }
    const recognition = new SR();
    recognition.lang = language === 'TA' ? 'ta-IN' : 'en-IN';
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (e: any) => {
      setInput(e.results[0][0].transcript);
    };
    recognition.start();
  };

  return (
    <div
      style={{
        maxWidth: '430px',
        margin: '0 auto',
        minHeight: '100vh',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #0a1628 0%, #1a2f1a 50%, #0d2010 100%)',
        fontFamily: "'Noto Sans Tamil', Arial, sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage:
            'radial-gradient(ellipse at 20% 50%, rgba(46,204,113,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(39,174,96,0.06) 0%, transparent 50%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: 'transparent',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: 'white',
        }}
      >
        <button
          onClick={() => router.push(`/?lang=${language}`)}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: 'white',
            fontSize: '18px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ←
        </button>

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: '16px',
              color: 'white',
              letterSpacing: '-0.3px',
            }}
          >
            🌾 {t.title}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '1px' }}>
            {t.subtitle}
          </div>
        </div>

        <button
          onClick={() => setLanguage(l => (l === 'EN' ? 'TA' : 'EN'))}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '20px',
            padding: '5px 14px',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: 700,
            color: 'white',
            letterSpacing: '0.5px',
          }}
        >
          {language === 'EN' ? 'TA' : 'EN'}
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          paddingBottom: '100px',
          zIndex: 1,
          background: 'transparent',
        }}
      >
        {messages.map(msg => {
          if (msg.role === 'user')
            return (
              <div
                key={msg.id}
                style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}
              >
                <div
                  style={{
                    background: '#2ECC71',
                    color: 'white',
                    borderRadius: '18px 18px 4px 18px',
                    padding: '10px 16px',
                    maxWidth: '78%',
                    fontSize: '14px',
                    fontWeight: 500,
                    boxShadow: '0 4px 16px rgba(46,204,113,0.35)',
                    wordBreak: 'break-word',
                    lineHeight: 1.5,
                  }}
                >
                  {msg.text}
                </div>
              </div>
            );

          if (msg.isLoading)
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  marginBottom: '12px',
                }}
              >
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2ECC71, #27AE60)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  🌾
                </div>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.95)',
                    borderRadius: '4px 18px 18px 18px',
                    padding: '16px 20px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1a1a1a',
                      marginBottom: '4px',
                    }}
                  >
                    {t.analyzing}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888' }}>{t.analyzingSubtext}</div>
                  <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#2ECC71',
                          animation: `bounce 0.8s infinite ${i * 0.15}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );

          if (msg.isForm && msg.questions)
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  marginBottom: '12px',
                }}
              >
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2ECC71, #27AE60)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  🌾
                </div>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.95)',
                    borderRadius: '4px 18px 18px 18px',
                    padding: '16px',
                    maxWidth: '85%',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  }}
                >
                  <p
                    style={{
                      fontWeight: 700,
                      marginBottom: '14px',
                      fontSize: '14px',
                      color: '#1a1a1a',
                    }}
                  >
                    {t.moreDetails}
                  </p>
                  {msg.questions.map(q => (
                    <div key={q.field} style={{ marginBottom: '12px' }}>
                      <label
                        style={{
                          fontSize: '12px',
                          color: '#666',
                          display: 'block',
                          marginBottom: '5px',
                        }}
                      >
                        {language === 'TA' ? q.question_ta : q.question}
                      </label>
                      <input
                        value={formAnswers[q.field] || ''}
                        onChange={e =>
                          setFormAnswers(prev => ({ ...prev, [q.field]: e.target.value }))
                        }
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '10px',
                          fontSize: '14px',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                        placeholder="Type your answer..."
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => handleFormSubmit(msg.questions!)}
                    style={{
                      background: '#2ECC71',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '12px',
                      fontSize: '15px',
                      cursor: 'pointer',
                      fontWeight: 700,
                      width: '100%',
                      boxShadow: '0 4px 12px rgba(46,204,113,0.3)',
                    }}
                  >
                    {t.analyze}
                  </button>
                </div>
              </div>
            );

          if (msg.isError)
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  marginBottom: '12px',
                }}
              >
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    flexShrink: 0,
                  }}
                >
                  ⚠️
                </div>
                <div
                  style={{
                    background: 'rgba(254,226,226,0.95)',
                    border: '1px solid rgba(220,38,38,0.2)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    maxWidth: '80%',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                    color: '#DC2626',
                  }}
                >
                  <p style={{ fontSize: '13px', color: '#DC2626', marginBottom: '10px' }}>
                    {msg.text}
                  </p>
                  <button
                    onClick={() => runQuery(initialQuery, context)}
                    style={{
                      background: '#DC2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: '20px',
                      padding: '5px 14px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {t.retry}
                  </button>
                </div>
              </div>
            );

          if (msg.result) {
            const insights = msg.result.insights || [];
            return (
              <div key={msg.id} style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    marginBottom: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #2ECC71, #27AE60)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    🌾
                  </div>
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.95)',
                      borderRadius: '4px 18px 18px 18px',
                      padding: '16px',
                      maxWidth: '82%',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        marginBottom: '8px',
                        background:
                          msg.result.confidence_level === 'high'
                            ? '#DCFCE7'
                            : msg.result.confidence_level === 'medium'
                              ? '#FEF9C3'
                              : '#FEE2E2',
                        color:
                          msg.result.confidence_level === 'high'
                            ? '#16A34A'
                            : msg.result.confidence_level === 'medium'
                              ? '#CA8A04'
                              : '#DC2626',
                        borderRadius: '20px',
                        padding: '4px 12px',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    >
                      {msg.result.confidence_level === 'high'
                        ? '🟢 High'
                        : msg.result.confidence_level === 'medium'
                          ? '🟡 Medium'
                          : '🔴 Low'}{' '}
                      Confidence
                    </span>

                    <p style={{ fontSize: '14px', color: '#1a1a1a', lineHeight: 1.6 }}>
                      {msg.result.summary}
                    </p>

                    {(msg.result.language === 'TA' || language === 'TA') && (
                      <div
                        style={{
                          marginTop: '12px',
                          background: 'linear-gradient(135deg, #E8F5E9, #C8E6C9)',
                          borderRadius: '16px',
                          padding: '12px 16px',
                          border: '2px solid #2ECC71',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <button
                          onClick={toggleAudio}
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: '#e8ebe9',
                            border: 'none',
                            color: 'white',
                            fontSize: '14px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(46,204,113,0.4)',
                            flexShrink: 0,
                          }}
                        >
                          {playing ? '⏸' : '▶'}
                        </button>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#16A34A' }}>
                            {audioUrl ? (playing ? t.playing : t.listenTamil) : t.generatingAudio}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              gap: '2px',
                              marginTop: '4px',
                              alignItems: 'flex-end',
                              height: '16px',
                            }}
                          >
                            {[3, 5, 4, 6, 3, 5, 4, 3, 5, 6, 4, 3].map((h, i) => (
                              <div
                                key={i}
                                style={{
                                  width: '3px',
                                  height: `${h * (playing ? (Math.random() > 0.5 ? 1.4 : 0.8) : 1)}px`,
                                  background: '#2ECC71',
                                  borderRadius: '2px',
                                  opacity: audioUrl ? 1 : 0.4,
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    marginLeft: '44px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                  }}
                >
                  {insights.map((insight, i) => {
                    const style = CARD_STYLES[i] || CARD_STYLES[0];
                    return (
                      <div
                        key={i}
                        style={{
                          background: style.bg,
                          borderRadius: '12px',
                          padding: '12px',
                          borderLeft: `3px solid ${style.border}`,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                          minHeight: '110px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '20px', marginBottom: '6px' }}>{style.icon}</div>
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              color: '#1a1a1a',
                              marginBottom: '5px',
                              lineHeight: 1.3,
                            }}
                          >
                            {insight.title}
                          </div>
                          <div style={{ fontSize: '11px', color: '#444', lineHeight: 1.45 }}>
                            {insight.description}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: '10px',
                            color: style.border,
                            fontWeight: 600,
                            marginTop: '6px',
                          }}
                        >
                          ↗ {t.viewRec}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    marginLeft: '44px',
                    marginTop: '10px',
                    display: 'flex',
                    gap: '6px',
                    flexWrap: 'wrap',
                  }}
                >
                  {['What are the risks?', 'Best time to sell?', 'Alternative crops?'].map(q => (
                    <button
                      key={q}
                      onClick={() => runQuery(q, context)}
                      style={{
                        background: 'rgba(46,204,113,0.15)',
                        border: '1px solid rgba(46,204,113,0.4)',
                        borderRadius: '20px',
                        padding: '5px 11px',
                        fontSize: '11px',
                        color: '#2ECC71',
                        cursor: 'pointer',
                        fontWeight: 600,
                        backdropFilter: 'blur(10px)',
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          return null;
        })}
        <div ref={bottomRef} />
      </div>

      <audio
        ref={audioRef}
        src={audioUrl || ''}
        onEnded={() => { setPlaying(false) }}
        style={{ display: 'none' }}
      />

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 20,
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.15)',
          padding: '12px 16px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          placeholder={t.inputPlaceholder}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          style={{
            flex: 1,
            padding: '12px 16px',
            border: 'none',
            borderRadius: '24px',
            fontSize: '14px',
            outline: 'none',
            background: 'rgba(255,255,255,0.95)',
            fontFamily: "'Noto Sans Tamil', Arial, sans-serif",
            color: '#1a1a1a',
          }}
        />
        <button
          onClick={handleVoice}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: listening ? 'rgba(231,76,60,0.3)' : 'rgba(255,255,255,0.2)',
            border: `1px solid ${listening ? 'rgba(231,76,60,0.6)' : 'rgba(255,255,255,0.3)'}`,
            cursor: 'pointer',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}
        >
          🎤
        </button>
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: input.trim() ? '#2ECC71' : 'rgba(255,255,255,0.15)',
            border: 'none',
            cursor: input.trim() ? 'pointer' : 'default',
            fontSize: '18px',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: input.trim() ? '0 2px 8px rgba(46,204,113,0.4)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          ➤
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(46,204,113,0.3); border-radius: 4px; }
      `}</style>
    </div>
  );
}

export default function AssistantPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: 'linear-gradient(180deg, #0a1628 0%, #1a2f1a 50%, #0d2010 100%)',
          }}
        >
          <div style={{ fontSize: '48px' }}>🌾</div>
          <div
            style={{
              marginTop: '16px',
              fontSize: '16px',
              color: 'rgba(255,255,255,0.7)',
              fontFamily: 'Arial, sans-serif',
            }}
          >
            Analyzing your farm...
          </div>
        </div>
      }
    >
      <AssistantPageContent />
    </Suspense>
  );
}
