'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, ImagePlus, Mic, Pause, Play, SendHorizontal } from 'lucide-react'

import { BottomNavigation } from '@/components/BottomNavigation'
import {
  apiRequest,
  getFriendlyError,
  getStoredLanguage,
  persistLanguage,
  type AppApiError,
  type AppLanguage,
} from '@/lib/api'
import {
  createDefaultContext,
  filterRequiredMissingFields,
  type FarmContext,
  type QueryInputType,
  type RequiredContextField,
} from '@/lib/farm'

interface Insight {
  type: 'diagnosis' | 'weather' | 'treatment' | 'market'
  title: string
  description: string
}

interface QueryResult {
  summary: string
  insights: Insight[]
  language: AppLanguage
  audio_url: string | null
}

interface QueryResponse {
  status: 'complete' | 'questions_needed'
  questions: string[]
  missing_fields: string[]
  result: QueryResult | null
}

interface TranslateResponse {
  translations: string[]
  targetLanguage: AppLanguage
}

interface TtsResponse {
  audioUrl: string
}

interface ImageAnalysisResponse {
  findings?: Array<{ label: string; confidence: number }>
  recommendedQuery?: string
}

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike
  webkitSpeechRecognition?: new () => SpeechRecognitionLike
}

type VoiceTarget = 'follow-up' | RequiredContextField | null
type ImageTarget = 'follow-up' | RequiredContextField | null

const CARD_STYLES = [
  { key: 'diagnosis', emoji: '🌱', title: 'Diagnosis', bg: '#e8f5e9' },
  { key: 'weather', emoji: '🌦️', title: 'Weather', bg: '#e3f2fd' },
  { key: 'treatment', emoji: '💊', title: 'Treatment', bg: '#fff3e0' },
  { key: 'market', emoji: '📈', title: 'Market', bg: '#f3e5f5' },
] as const

const uiText = {
  EN: {
    title: 'Farm Assistant',
    summaryFallback: 'Your farm summary will appear here.',
    loadingTitle: 'Analyzing your farm...',
    loadingSub: 'This takes about 30 seconds',
    inputPlaceholder: 'Ask a follow-up question...',
    retry: 'Retry',
    noQuery: 'Start from the home page to ask a question.',
    listenTamil: 'Listen in Tamil',
    questionsTitle: 'Please fill these details',
    continue: 'Continue',
    typeAnswer: 'Type your answer...',
    listening: 'Listening...',
    uploadAria: 'Upload image',
    micAria: 'Speak',
    sendAria: 'Send',
    imageError: 'We could not analyze that image. Please try another one.',
    voiceError: 'We could not understand your voice. Please try again.',
    unsupportedVoice: 'Voice input is not available in this browser.',
    resultError: 'We could not complete the analysis. Please try again.',
    fieldLabels: {
      crop: 'Which crop are you planning to grow?',
      location: 'Which location or district is this for?',
      month: 'Which month are you planning for?',
      irrigation: 'What irrigation source do you have?',
    },
    cardTitles: {
      diagnosis: 'Diagnosis',
      weather: 'Weather',
      treatment: 'Treatment',
      market: 'Market',
    },
  },
  TA: {
    title: 'பண்ணை உதவியாளர்',
    summaryFallback: 'உங்கள் பண்ணை சுருக்கம் இங்கே தோன்றும்.',
    loadingTitle: 'உங்கள் பண்ணையை ஆய்வு செய்கிறோம்...',
    loadingSub: 'இதற்கு சுமார் 30 விநாடிகள் ஆகும்',
    inputPlaceholder: 'அடுத்த கேள்வியை கேளுங்கள்...',
    retry: 'மீண்டும் முயற்சி',
    noQuery: 'முகப்பு பக்கத்தில் இருந்து கேள்வியை தொடங்குங்கள்.',
    listenTamil: 'தமிழில் கேளுங்கள்',
    questionsTitle: 'இந்த விவரங்களை நிரப்பவும்',
    continue: 'தொடரவும்',
    typeAnswer: 'உங்கள் பதிலை உள்ளிடுங்கள்...',
    listening: 'கேட்டு கொண்டிருக்கிறோம்...',
    uploadAria: 'படத்தை பதிவேற்று',
    micAria: 'பேசுங்கள்',
    sendAria: 'அனுப்பு',
    imageError: 'இந்த படத்தை ஆய்வு செய்ய முடியவில்லை. வேறு படத்தை முயற்சிக்கவும்.',
    voiceError: 'உங்கள் குரலைப் புரிந்துகொள்ள முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
    unsupportedVoice: 'இந்த உலாவியில் குரல் உள்ளீடு இல்லை.',
    resultError: 'ஆய்வை முடிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
    fieldLabels: {
      crop: 'நீங்கள் எந்த பயிரை வளர்க்கப் போகிறீர்கள்?',
      location: 'இது எந்த இடம் அல்லது மாவட்டத்திற்காக?',
      month: 'எந்த மாதத்திற்கு திட்டமிடுகிறீர்கள்?',
      irrigation: 'உங்களிடம் என்ன நீர்ப்பாசன வசதி உள்ளது?',
    },
    cardTitles: {
      diagnosis: 'கண்டறிதல்',
      weather: 'வானிலை',
      treatment: 'சிகிச்சை',
      market: 'சந்தை',
    },
  },
} as const

function getRecognition(language: AppLanguage) {
  if (typeof window === 'undefined') {
    return null
  }

  const speechWindow = window as SpeechWindow
  const RecognitionCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
  if (!RecognitionCtor) {
    return null
  }

  const recognition = new RecognitionCtor()
  recognition.lang = language === 'TA' ? 'ta-IN' : 'en-IN'
  recognition.interimResults = false
  recognition.maxAlternatives = 1
  return recognition
}

function trimSummary(summary: string) {
  return summary.length > 180 ? `${summary.slice(0, 177)}...` : summary
}

function shortenDescription(text: string) {
  return text.length > 95 ? `${text.slice(0, 92)}...` : text
}

function createNonTextFallbackContext(context: FarmContext, query: string) {
  const next = createDefaultContext(context)

  if (!next.crop) {
    next.crop = query || 'crop image'
  }
  if (!next.location) {
    next.location = 'Farmer field'
  }
  if (!next.month) {
    next.month = new Date().toLocaleString('en-US', { month: 'long' })
  }
  if (!next.irrigation) {
    next.irrigation = 'borewell'
  }

  return next
}

function AssistantPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const imageInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const initializedRef = useRef<string | null>(null)

  const initialQuery = searchParams.get('q')?.trim() ?? ''
  const initialInputType =
    searchParams.get('inputType') === 'image' || searchParams.get('inputType') === 'voice'
      ? (searchParams.get('inputType') as QueryInputType)
      : 'text'

  const [language, setLanguage] = useState<AppLanguage>('EN')
  const [context, setContext] = useState<FarmContext>(createDefaultContext())
  const [result, setResult] = useState<QueryResult | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<AppApiError | null>(null)
  const [requiredFields, setRequiredFields] = useState<RequiredContextField[]>([])
  const [questions, setQuestions] = useState<Record<RequiredContextField, string>>({
    crop: '',
    location: '',
    month: '',
    irrigation: '',
  })
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [pendingQuery, setPendingQuery] = useState<{ query: string; inputType: QueryInputType } | null>(null)
  const [voiceTarget, setVoiceTarget] = useState<VoiceTarget>(null)
  const [imageTarget, setImageTarget] = useState<ImageTarget>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [lastRequest, setLastRequest] = useState<{ query: string; inputType: QueryInputType; context: FarmContext } | null>(null)

  const t = uiText[language]

  useEffect(() => {
    const urlLang = searchParams.get('lang')
    const nextLanguage = urlLang === 'TA' || urlLang === 'EN' ? urlLang : getStoredLanguage()
    setLanguage(nextLanguage)
    persistLanguage(nextLanguage)
  }, [searchParams])

  useEffect(() => {
    if (!initialQuery || initializedRef.current === initialQuery) {
      return
    }

    initializedRef.current = initialQuery
    void runQuery(initialQuery, initialInputType, createDefaultContext())
  }, [initialInputType, initialQuery])

  useEffect(() => {
    if (!result) {
      setAudioUrl(null)
      return
    }

    if (language !== 'TA') {
      setAudioUrl(null)
      return
    }

    let cancelled = false
    const currentResult = result

    async function loadAudio() {
      try {
        if (currentResult.audio_url) {
          if (!cancelled) {
            setAudioUrl(currentResult.audio_url)
          }
          return
        }

        const translateData = await apiRequest<TranslateResponse>('/api/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            textBlocks: [currentResult.summary],
            targetLanguage: 'TA',
          }),
        })

        const ttsData = await apiRequest<TtsResponse>('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: translateData.translations[0] ?? currentResult.summary,
            language: 'TA',
          }),
        })

        if (!cancelled) {
          setAudioUrl(ttsData.audioUrl)
        }
      } catch {
        if (!cancelled) {
          setAudioUrl(null)
        }
      }
    }

    void loadAudio()
    return () => {
      cancelled = true
    }
  }, [language, result])

  useEffect(() => {
    if (language === 'TA' && audioUrl && audioRef.current) {
      void audioRef.current.play().catch(() => undefined)
      setIsAudioPlaying(true)
    } else {
      setIsAudioPlaying(false)
    }
  }, [audioUrl, language])

  const visibleCards = useMemo(() => {
    return CARD_STYLES.map((card, index) => {
      const insight = result?.insights[index]
      return {
        ...card,
        title: insight?.title || t.cardTitles[card.key],
        description: shortenDescription(insight?.description || ''),
      }
    })
  }, [result, t.cardTitles])

  async function runQuery(
    query: string,
    inputType: QueryInputType,
    nextContext: FarmContext,
    allowAutoFill = true
  ) {
    const trimmed = query.trim()
    if (!trimmed) {
      return
    }

    const fullContext = createDefaultContext(nextContext)
    setError(null)
    setIsLoading(true)
    setLastRequest({ query: trimmed, inputType, context: fullContext })

    try {
      const data = await apiRequest<QueryResponse>('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: trimmed,
          inputType,
          language,
          context: fullContext,
        }),
      })

      if (data.status === 'questions_needed') {
        const filtered = filterRequiredMissingFields(data.missing_fields)

        if (filtered.length === 1 && filtered[0] === 'irrigation' && allowAutoFill) {
          const fallbackContext = createDefaultContext(fullContext)
          fallbackContext.irrigation = fallbackContext.irrigation || 'borewell'
          await runQuery(trimmed, inputType, fallbackContext, false)
          return
        }

        if (inputType !== 'text' && allowAutoFill) {
          await runQuery(trimmed, inputType, createNonTextFallbackContext(fullContext, trimmed), false)
          return
        }

        setPendingQuery({ query: trimmed, inputType })
        setRequiredFields(filtered)

        const nextQuestions = {
          crop: '',
          location: '',
          month: '',
          irrigation: '',
        }

        filtered.forEach((field) => {
          const index = data.missing_fields.findIndex((item) => item === field)
          nextQuestions[field] = index >= 0 ? data.questions[index] : t.fieldLabels[field]
        })

        setQuestions(nextQuestions)
        setAnswers((current) => {
          const next = { ...current }
          filtered.forEach((field) => {
            if (!next[field] && fullContext[field]) {
              next[field] = String(fullContext[field])
            }
          })
          return next
        })
        setResult(null)
        return
      }

      if (!data.result) {
        throw { message: t.resultError, retryable: true } satisfies AppApiError
      }

      setContext(fullContext)
      setResult(data.result)
      setAudioUrl(null)
      setPendingQuery(null)
      setRequiredFields([])
      setAnswers({})
    } catch (error) {
      setError(getFriendlyError(error, t.resultError))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSpeechInput = (target: VoiceTarget) => {
    const recognition = getRecognition(language)
    if (!recognition) {
      setError({ message: t.unsupportedVoice, retryable: false })
      return
    }

    setError(null)
    setVoiceTarget(target)
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      if (target === 'follow-up') {
        setInputValue(transcript)
        void runQuery(transcript, 'voice', context)
      } else if (target) {
        setAnswers((current) => ({
          ...current,
          [target]: transcript,
        }))
      }
    }
    recognition.onerror = () => {
      setVoiceTarget(null)
      setError({ message: t.voiceError, retryable: true })
    }
    recognition.onend = () => {
      setVoiceTarget(null)
    }
    recognition.start()
  }

  const handleImageUpload = async (file: File, target: ImageTarget) => {
    if (!target) {
      return
    }

    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('crop', context.crop ?? 'unknown')

      const data = await apiRequest<ImageAnalysisResponse>('/api/image-analysis', {
        method: 'POST',
        body: formData,
      })

      const value =
        data.recommendedQuery?.trim() ||
        data.findings?.[0]?.label?.trim() ||
        ''

      if (target === 'follow-up') {
        setInputValue(value)
        await runQuery(value, 'image', context)
      } else {
        setAnswers((current) => ({
          ...current,
          [target]: value,
        }))
      }
    } catch (error) {
      setError(getFriendlyError(error, t.imageError))
    } finally {
      setImageTarget(null)
    }
  }

  const toggleAudio = async () => {
    if (!audioRef.current) {
      return
    }

    if (isAudioPlaying) {
      audioRef.current.pause()
      setIsAudioPlaying(false)
      return
    }

    await audioRef.current.play().catch(() => undefined)
    setIsAudioPlaying(true)
  }

  const submitMissingInfo = async () => {
    if (!pendingQuery) {
      return
    }

    const nextContext = createDefaultContext(context)
    requiredFields.forEach((field) => {
      nextContext[field] = answers[field]?.trim() || nextContext[field]
    })

    await runQuery(pendingQuery.query, 'text', nextContext)
  }

  return (
    <div className="min-h-screen bg-[#f7f7f3] pb-28">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file && imageTarget) {
            void handleImageUpload(file, imageTarget)
          }
        }}
      />

      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        onEnded={() => setIsAudioPlaying(false)}
        className="hidden"
      />

      <div className="max-w-[420px] mx-auto min-h-screen px-4 pt-4">
        <button
          onClick={() => router.push(`/?lang=${language}`)}
          className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-[#333]" />
        </button>

        {isLoading ? (
          <div className="min-h-[70vh] flex flex-col items-center justify-center text-center">
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="text-5xl"
            >
              🌾
            </motion.div>
            <p className="mt-4 text-[22px] font-medium text-[#333]">{t.loadingTitle}</p>
            <p className="mt-2 text-sm text-[#666]">{t.loadingSub}</p>
          </div>
        ) : (
          <div className="pt-6 space-y-5 pb-28">
            {requiredFields.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-[#333]">{t.questionsTitle}</h2>
                {requiredFields.map((field) => (
                  <div key={field} className="rounded-3xl bg-white shadow-sm p-4 space-y-3">
                    <p className="text-sm font-medium text-[#333]">
                      {questions[field] || t.fieldLabels[field]}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={answers[field] ?? ''}
                        onChange={(event) =>
                          setAnswers((current) => ({
                            ...current,
                            [field]: event.target.value,
                          }))
                        }
                        placeholder={t.typeAnswer}
                        className="flex-1 rounded-2xl bg-[#f6f7f8] px-4 py-3 text-sm text-[#333] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSpeechInput(field)}
                        className="w-10 h-10 rounded-full bg-[#f6f7f8] flex items-center justify-center"
                        aria-label={t.micAria}
                      >
                        <Mic className="w-4 h-4 text-[#333]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImageTarget(field)
                          imageInputRef.current?.click()
                        }}
                        className="w-10 h-10 rounded-full bg-[#f6f7f8] flex items-center justify-center"
                        aria-label={t.uploadAria}
                      >
                        <ImagePlus className="w-4 h-4 text-[#333]" />
                      </button>
                    </div>
                    {voiceTarget === field && (
                      <div className="flex items-center gap-2 text-xs text-red-500">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span>{t.listening}</span>
                      </div>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => void submitMissingInfo()}
                  className="w-full rounded-2xl bg-[#2f7d32] px-4 py-3 text-white font-medium"
                >
                  {t.continue}
                </button>
              </div>
            )}

            {!requiredFields.length && result && (
              <>
                <div className="rounded-3xl bg-white shadow-sm p-4">
                  <p className="text-[15px] leading-6 text-[#333] line-clamp-3">
                    {trimSummary(result.summary)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {visibleCards.map((card) => (
                    <div
                      key={card.key}
                      className="rounded-3xl shadow-sm p-4 min-h-[120px] flex flex-col justify-between"
                      style={{ backgroundColor: card.bg }}
                    >
                      <div className="text-2xl">{card.emoji}</div>
                      <div>
                        <p className="text-sm font-semibold text-[#222]">{card.title}</p>
                        <p className="mt-2 text-sm leading-5 text-[#555] line-clamp-2">
                          {card.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {language === 'TA' && audioUrl && (
                  <div className="rounded-3xl bg-white shadow-sm px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🔊</span>
                      <span className="text-sm text-[#333]">{t.listenTamil}</span>
                    </div>
                    <button
                      onClick={() => void toggleAudio()}
                      className="w-10 h-10 rounded-full bg-[#f6f7f8] flex items-center justify-center"
                    >
                      {isAudioPlaying ? (
                        <Pause className="w-4 h-4 text-[#333]" />
                      ) : (
                        <Play className="w-4 h-4 text-[#333]" />
                      )}
                    </button>
                  </div>
                )}
              </>
            )}

            {!requiredFields.length && !result && !error && (
              <div className="rounded-3xl bg-white shadow-sm p-4 text-sm text-[#666]">
                {t.noQuery}
              </div>
            )}

            {error && (
              <div className="rounded-3xl bg-[#fff3f1] px-4 py-3 text-sm text-[#b23b2a]">
                <p>{error.message}</p>
                {error.retryable && lastRequest && (
                  <button
                    onClick={() =>
                      void runQuery(lastRequest.query, lastRequest.inputType, lastRequest.context)
                    }
                    className="mt-3 rounded-full bg-[#b23b2a] px-3 py-1 text-white text-xs"
                  >
                    {t.retry}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-20 left-0 right-0">
        <div className="max-w-[420px] mx-auto px-4">
          <div className="rounded-full bg-white shadow-sm px-2 py-1 flex items-center gap-2">
            <input
              type="text"
              placeholder={t.inputPlaceholder}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void runQuery(inputValue, 'text', context)
                }
              }}
              className="flex-1 bg-transparent px-3 py-3 text-sm text-[#333] outline-none"
              disabled={isLoading}
            />
            <button
              onClick={() => {
                setImageTarget('follow-up')
                imageInputRef.current?.click()
              }}
              className="w-10 h-10 rounded-full bg-[#f6f7f8] flex items-center justify-center"
              aria-label={t.uploadAria}
              disabled={isLoading}
            >
              <ImagePlus className="w-4 h-4 text-[#333]" />
            </button>
            <button
              onClick={() => handleSpeechInput('follow-up')}
              className="w-10 h-10 rounded-full bg-[#f6f7f8] flex items-center justify-center relative"
              aria-label={t.micAria}
              disabled={isLoading}
            >
              <Mic className="w-4 h-4 text-[#333]" />
              {voiceTarget === 'follow-up' && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </button>
            <button
              onClick={() => void runQuery(inputValue, 'text', context)}
              className="w-10 h-10 rounded-full bg-[#2f7d32] flex items-center justify-center"
              aria-label={t.sendAria}
              disabled={isLoading || !inputValue.trim()}
            >
              <SendHorizontal className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>

      <BottomNavigation />
    </div>
  )
}

export default function AssistantPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f7f3]" />}>
      <AssistantPageContent />
    </Suspense>
  )
}
