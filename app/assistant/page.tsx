'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

interface Insight {
  type: string
  title: string
  description: string
}

interface QueryResult {
  summary: string
  insights: Insight[]
  risk_score: number
  final_score: number
  confidence_level: string
  language: string
  audio_url: string | null
}

interface Question {
  field: string
  question: string
  question_ta: string
}

const CARD_COLORS: Record<string, string> = {
  diagnosis: '#E8F5E9',
  weather: '#E3F2FD',
  treatment: '#FFF3E0',
  market: '#F3E5F5',
}

const CARD_BORDERS: Record<string, string> = {
  diagnosis: '#2ECC71',
  weather: '#3498DB',
  treatment: '#F39C12',
  market: '#9B59B6',
}

const CARD_ICONS: Record<string, string> = {
  diagnosis: '\u{1F331}',
  weather: '\u{1F326}\uFE0F',
  treatment: '\u{1F48A}',
  market: '\u{1F4C8}',
}

function AssistantContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const query = searchParams.get('q') || ''
  const lang = searchParams.get('lang') || 'EN'
  const cropParam = searchParams.get('crop') || ''
  const locationParam = searchParams.get('location') || ''
  const monthParam = searchParams.get('month') || ''
  const irrigationParam = searchParams.get('irrigation') || ''
  const [language, setLanguage] = useState(lang)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [context, setContext] = useState({
    crop: cropParam,
    location: locationParam,
    month: monthParam,
    irrigation: irrigationParam,
    land_size_acres: 2,
    market_dependency: true,
  })

  useEffect(() => {
    if (query) {
      void runQuery(query, {
        crop: cropParam,
        location: locationParam,
        month: monthParam,
        irrigation: irrigationParam,
        land_size_acres: 2,
        market_dependency: true,
      })
    }
  }, [])

  const fetchAudio = async (text: string) => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: 'TA' }),
      })
      const data = await response.json()
      if (data.audioUrl) {
        setAudioUrl(data.audioUrl)
        setTimeout(() => {
          if (audioRef.current) {
            void audioRef.current.play()
            setPlaying(true)
          }
        }, 500)
      }
    } catch (caughtError) {
      console.log('TTS error:', caughtError)
    }
  }

  const runQuery = async (q: string, ctx: Record<string, any>) => {
    setLoading(true)
    setError('')
    setResult(null)
    setQuestions([])
    setAudioUrl(null)
    setPlaying(false)
    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          language: language,
          context: {
            crop: ctx.crop || '',
            location: ctx.location || '',
            month: ctx.month || '',
            irrigation: ctx.irrigation || '',
            land_size_acres: ctx.land_size_acres || 2,
            market_dependency: ctx.market_dependency ?? true,
          },
        }),
      })
      const data = await response.json()
      if (data.status === 'complete' && data.result) {
        setResult(data.result)
        setContext((prev) => ({ ...prev, ...ctx }))
        if ((data.result.language === 'TA' || language === 'TA') && data.result.summary) {
          void fetchAudio(data.result.summary)
        }
      } else if (data.status === 'questions_needed') {
        setQuestions(data.questions || [])
      } else {
        setError('Could not get analysis. Please try again.')
      }
    } catch {
      setError('Could not connect to server. Make sure backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleMissingInfoSubmit = () => {
    const ctx: Record<string, string> = {}
    questions.forEach((questionItem) => {
      if (answers[questionItem.field]) {
        ctx[questionItem.field] = answers[questionItem.field]
      }
    })
    void runQuery(query, ctx)
  }

  const handleFollowUp = () => {
    if (!followUp.trim()) return
    void runQuery(followUp, context)
    setFollowUp('')
  }

  const handleVoice = () => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      alert('Use Chrome for voice input')
      return
    }
    const recognition = new SR()
    recognition.lang = language === 'TA' ? 'ta-IN' : 'en-IN'
    recognition.interimResults = false
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setFollowUp(transcript)
    }
    recognition.start()
  }

  const toggleAudio = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      void audioRef.current.play()
      setPlaying(true)
    }
  }

  return (
    <div
      style={{
        maxWidth: '430px',
        margin: '0 auto',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0D1B0F 0%, #1A2F1A 40%, #0D2010 100%)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Noto Sans Tamil', Arial, sans-serif",
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 16px',
          background: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            color: 'white',
            fontSize: '18px',
            cursor: 'pointer',
            marginRight: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {'\u2190'}
        </button>
        <span style={{ fontWeight: 700, fontSize: '16px', flex: 1, color: 'white' }}>
          {'\u{1F33E}'} Farm Analysis
        </span>
        <button
          onClick={() => setLanguage((current) => (current === 'EN' ? 'TA' : 'EN'))}
          style={{
            background: 'rgba(46,204,113,0.2)',
            border: '1px solid rgba(46,204,113,0.5)',
            borderRadius: '20px',
            padding: '5px 12px',
            fontSize: '13px',
            cursor: 'pointer',
            fontWeight: 700,
            color: '#2ECC71',
          }}
        >
          {language}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: '100px' }}>
        {query && (
          <div
            style={{
              background: 'linear-gradient(135deg, #2ECC71, #27AE60)',
              color: 'white',
              borderRadius: '18px 18px 4px 18px',
              padding: '12px 16px',
              marginBottom: '16px',
              marginLeft: 'auto',
              maxWidth: '80%',
              fontSize: '14px',
              fontWeight: 500,
              boxShadow: '0 4px 12px rgba(46,204,113,0.3)',
              wordBreak: 'break-word',
            }}
          >
            {query}
          </div>
        )}

        {loading && (
          <div
            style={{
              background: 'rgba(255,255,255,0.97)',
              borderRadius: '4px 18px 18px 18px',
              padding: '20px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <span style={{ fontSize: '24px' }}>{'\u{1F33E}'}</span>
            <span style={{ color: '#555', fontSize: '14px' }}>
              Analyzing your farm... (takes ~30 seconds)
            </span>
          </div>
        )}

        {error && (
          <div
            style={{
              background: 'rgba(254,226,226,0.95)',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '16px',
              color: '#DC2626',
              fontSize: '14px',
              boxShadow: '0 4px 12px rgba(220,38,38,0.1)',
            }}
          >
            {error}
            <button
              onClick={() => void runQuery(query, context)}
              style={{
                display: 'block',
                marginTop: '8px',
                background: '#DC2626',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 14px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {questions.length > 0 && !loading && (
          <div
            style={{
              background: 'rgba(255,255,255,0.97)',
              borderRadius: '4px 18px 18px 18px',
              padding: '18px',
              marginBottom: '16px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <p
              style={{
                fontWeight: 700,
                marginBottom: '14px',
                fontSize: '15px',
                color: '#1a1a1a',
              }}
            >
              I need a few more details:
            </p>
            {questions.map((questionItem) => (
              <div key={questionItem.field} style={{ marginBottom: '12px' }}>
                <label
                  style={{
                    fontSize: '13px',
                    color: '#666',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  {language === 'TA'
                    ? questionItem.question_ta
                    : questionItem.question}
                </label>
                <input
                  value={answers[questionItem.field] || ''}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [questionItem.field]: e.target.value,
                    }))
                  }
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1.5px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    marginTop: '4px',
                  }}
                  placeholder="Type your answer..."
                />
              </div>
            ))}
            <button
              onClick={handleMissingInfoSubmit}
              style={{
                background: 'linear-gradient(135deg, #2ECC71, #27AE60)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 20px',
                fontSize: '15px',
                cursor: 'pointer',
                fontWeight: 700,
                width: '100%',
                marginTop: '8px',
                boxShadow: '0 4px 12px rgba(46,204,113,0.3)',
              }}
            >
              Analyze {'\u2192'}
            </button>
          </div>
        )}

        {result && !loading && (
          <div
            style={{
              background: 'rgba(255,255,255,0.97)',
              borderRadius: '4px 18px 18px 18px',
              padding: '16px',
              marginBottom: '16px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <div style={{ marginBottom: '10px' }}>
              <span
                style={{
                  background:
                    result.confidence_level === 'high'
                      ? '#DCFCE7'
                      : result.confidence_level === 'medium'
                        ? '#FEF9C3'
                        : '#FEE2E2',
                  color:
                    result.confidence_level === 'high'
                      ? '#16A34A'
                      : result.confidence_level === 'medium'
                        ? '#CA8A04'
                        : '#DC2626',
                  borderRadius: '20px',
                  padding: '4px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                {result.confidence_level === 'high'
                  ? '\u{1F7E2} High Confidence'
                  : result.confidence_level === 'medium'
                    ? '\u{1F7E1} Medium Confidence'
                    : '\u{1F534} Low Confidence'}
              </span>
            </div>

            <p
              style={{
                fontSize: '14px',
                color: '#1a1a1a',
                lineHeight: 1.7,
                marginBottom: '14px',
                marginTop: '10px',
              }}
            >
              {result.summary}
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                marginBottom: '14px',
              }}
            >
              {(result.insights || []).map((insight, index) => (
                <div
                  key={index}
                  style={{
                    background: CARD_COLORS[insight.type] || '#F5F5F5',
                    borderRadius: '12px',
                    padding: '10px',
                    borderLeft: `3px solid ${CARD_BORDERS[insight.type] || '#999'}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}
                >
                  <div style={{ fontSize: '20px', marginBottom: '6px' }}>
                    {CARD_ICONS[insight.type] || '\u{1F4CB}'}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#222',
                      marginBottom: '4px',
                    }}
                  >
                    {insight.title}
                  </div>
                  <div style={{ fontSize: '11px', color: '#555', lineHeight: 1.4 }}>
                    {insight.description}
                  </div>
                </div>
              ))}
            </div>

            {result && (result.language === 'TA' || language === 'TA') && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #E8F5E9, #C8E6C9)',
                  borderRadius: '14px',
                  padding: '12px 16px',
                  marginTop: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  border: '2px solid #2ECC71',
                  boxShadow: '0 2px 8px rgba(46,204,113,0.2)',
                }}
              >
                <span style={{ fontSize: '24px' }}>{'\u{1F50A}'}</span>
                <span
                  style={{
                    flex: 1,
                    fontSize: '13px',
                    color: '#16A34A',
                    fontWeight: 700,
                  }}
                >
                  {audioUrl
                    ? playing
                      ? '\u25B6 Playing Tamil audio...'
                      : '\u{1F50A} Listen in Tamil'
                    : '\u23F3 Generating Tamil audio...'}
                </span>
                {audioUrl && (
                  <button
                    onClick={toggleAudio}
                    style={{
                      background: '#2ECC71',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(46,204,113,0.4)',
                    }}
                  >
                    {playing ? '\u23F8' : '\u25B6'}
                  </button>
                )}
                <audio
                  ref={audioRef}
                  src={audioUrl || ''}
                  onEnded={() => setPlaying(false)}
                />
              </div>
            )}

            <div
              style={{ marginTop: '14px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}
            >
              {['What are the risks?', 'Best time to sell?', 'Alternative crops?'].map(
                (quickQuestion) => (
                  <button
                    key={quickQuestion}
                    onClick={() => void runQuery(quickQuestion, context)}
                    style={{
                      background: 'rgba(46,204,113,0.1)',
                      border: '1px solid rgba(46,204,113,0.4)',
                      borderRadius: '20px',
                      padding: '6px 12px',
                      fontSize: '11px',
                      color: '#16A34A',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {quickQuestion}
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          background: 'rgba(13,27,15,0.95)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          padding: '12px 16px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          position: 'sticky',
          bottom: 0,
        }}
      >
        <input
          value={followUp}
          onChange={(e) => setFollowUp(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleFollowUp()}
          placeholder="Ask a follow-up question..."
          style={{
            flex: 1,
            padding: '11px 16px',
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
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.25)',
            cursor: 'pointer',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {'\u{1F3A4}'}
        </button>
        <button
          onClick={handleFollowUp}
          disabled={!followUp.trim()}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: followUp.trim() ? '#2ECC71' : 'rgba(255,255,255,0.2)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: followUp.trim() ? '0 4px 12px rgba(46,204,113,0.4)' : 'none',
          }}
        >
          {'\u27A4'}
        </button>
      </div>
    </div>
  )
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
            background: 'linear-gradient(180deg, #0D1B0F 0%, #1A2F1A 40%, #0D2010 100%)',
          }}
        >
          <div style={{ fontSize: '48px' }}>{'\u{1F33E}'}</div>
          <div style={{ marginTop: '16px', fontSize: '16px', color: 'white' }}>
            Loading...
          </div>
        </div>
      }
    >
      <AssistantContent />
    </Suspense>
  )
}
