'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  CircleUserRound,
  Cloud,
  Leaf,
  Pill,
  Send,
  TrendingUp,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

import { BottomNavigation } from '@/components/BottomNavigation'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  apiRequest,
  getFriendlyError,
  getStoredLanguage,
  persistLanguage,
  type AppApiError,
  type AppLanguage,
} from '@/lib/api'

type FieldName =
  | 'crop'
  | 'location'
  | 'month'
  | 'irrigation'
  | 'land_size_acres'
  | 'market_dependency'

interface FarmContext {
  crop: string | null
  location: string | null
  month: string | null
  irrigation: string | null
  land_size_acres: number | null
  market_dependency: boolean | null
}

interface Insight {
  type: 'diagnosis' | 'weather' | 'treatment' | 'market'
  title: string
  description: string
}

interface QueryResult {
  summary: string
  insights: Insight[]
  high_risks: string[]
  medium_risks: string[]
  assumptions: string[]
  mitigation: string[]
  actions: string[]
  risk_score: number
  final_score: number
  confidence_level: string
  language: AppLanguage
  audio_url: string | null
}

interface QueryResponse {
  status: 'complete' | 'questions_needed'
  questions: string[]
  missing_fields: string[]
  result: QueryResult | null
}

interface TtsResponse {
  audioUrl: string
  durationSeconds: number
  language: AppLanguage
}

interface ChatEntry {
  id: string
  type: 'user' | 'assistant'
  message: string
  result?: QueryResult
  audioUrl?: string | null
}

const EMPTY_CONTEXT: FarmContext = {
  crop: null,
  location: null,
  month: null,
  irrigation: null,
  land_size_acres: null,
  market_dependency: null,
}

const insightDesign = [
  { type: 'diagnosis', icon: Leaf, tone: 'from-primary/20 to-primary/5' },
  { type: 'weather', icon: Cloud, tone: 'from-secondary/20 to-secondary/5' },
  { type: 'treatment', icon: Pill, tone: 'from-accent/20 to-accent/5' },
  { type: 'market', icon: TrendingUp, tone: 'from-primary/15 to-accent/10' },
] as const

const uiText = {
  EN: {
    title: 'Farm Assistant',
    subtitle: 'Your AI farming guide',
    inputPlaceholder: 'Ask a follow-up question...',
    loading: 'Analyzing your farm risk...',
    loadingSubtext: 'This can take up to 40 seconds while the model reasons.',
    followUpError: 'We could not fetch a response right now. Please try again.',
    questionsTitle: 'A few details will improve the advice',
    questionsHint: 'Please answer the missing details below before we continue.',
    submitAnswers: 'Continue analysis',
    retry: 'Retry',
    highRisk: 'High risk',
    mediumRisk: 'Medium risk',
    mitigation: 'Mitigation',
    actions: 'Recommended actions',
    assumptions: 'Assumptions',
    finalScore: 'Farm risk score',
    confidence: 'Confidence',
    noQuery: 'Start from the home page or ask a question below.',
    audio: 'Tamil audio',
    profile: 'User profile',
    crop: 'Crop',
    location: 'Location',
    month: 'Month',
    irrigation: 'Irrigation',
    land_size_acres: 'Land size (acres)',
    market_dependency: 'Depends on market sales?',
    textPlaceholder: 'Type your answer',
    numberPlaceholder: 'Enter a number',
    yes: 'Yes',
    no: 'No',
  },
  TA: {
    title: 'பண்ணை உதவியாளர்',
    subtitle: 'உங்கள் AI விவசாய வழிகாட்டி',
    inputPlaceholder: 'அடுத்த கேள்வியை கேளுங்கள்...',
    loading: 'உங்கள் பண்ணை ஆபத்தை ஆய்வு செய்கிறோம்...',
    loadingSubtext: 'மாதிரி சிந்திப்பதால் இது 40 விநாடிகள் வரை எடுத்துக்கொள்ளலாம்.',
    followUpError: 'இப்போது பதிலை பெற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
    questionsTitle: 'சில விவரங்கள் ஆலோசனையை மேம்படுத்தும்',
    questionsHint: 'தொடர்வதற்கு முன் கீழே உள்ள தகவல்களை நிரப்பவும்.',
    submitAnswers: 'ஆய்வை தொடர்க',
    retry: 'மீண்டும் முயற்சி',
    highRisk: 'அதிக ஆபத்து',
    mediumRisk: 'மிதமான ஆபத்து',
    mitigation: 'தடுப்பு நடவடிக்கைகள்',
    actions: 'பரிந்துரைக்கப்பட்ட செயல்கள்',
    assumptions: 'கருதப்பட்டவை',
    finalScore: 'பண்ணை ஆபத்து மதிப்பெண்',
    confidence: 'நம்பிக்கை நிலை',
    noQuery: 'முகப்பு பக்கத்தில் இருந்து தொடங்குங்கள் அல்லது கீழே கேள்வி கேளுங்கள்.',
    audio: 'தமிழ் ஒலி',
    profile: 'பயனர் சுயவிவரம்',
    crop: 'பயிர்',
    location: 'இடம்',
    month: 'மாதம்',
    irrigation: 'நீர்ப்பாசனம்',
    land_size_acres: 'நில அளவு (ஏக்கர்)',
    market_dependency: 'சந்தை விற்பனை மீது சார்ந்திருக்கிறீர்களா?',
    textPlaceholder: 'உங்கள் பதிலை உள்ளிடுங்கள்',
    numberPlaceholder: 'எண்ணை உள்ளிடுங்கள்',
    yes: 'ஆம்',
    no: 'இல்லை',
  },
} as const

function toFieldName(field: string): FieldName | null {
  switch (field) {
    case 'crop':
    case 'location':
    case 'month':
    case 'irrigation':
    case 'land_size_acres':
    case 'market_dependency':
      return field
    default:
      return null
  }
}

function buildContext(
  baseContext: FarmContext,
  answers: Record<string, string>,
  missingFields: string[]
): FarmContext {
  const nextContext = { ...baseContext }

  for (const rawField of missingFields) {
    const field = toFieldName(rawField)
    if (!field) {
      continue
    }

    const answer = answers[field]?.trim()
    if (!answer) {
      continue
    }

    if (field === 'land_size_acres') {
      const parsed = Number(answer)
      nextContext[field] = Number.isFinite(parsed) ? parsed : null
      continue
    }

    if (field === 'market_dependency') {
      const lowered = answer.toLowerCase()
      nextContext[field] = lowered === 'yes' || lowered === 'true' || lowered === 'ஆம்'
      continue
    }

    nextContext[field] = answer
  }

  return nextContext
}

function AssistantPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const initialQueryHandledRef = useRef<string | null>(null)

  const queryFromUrl = searchParams.get('q')?.trim() ?? ''
  const [language, setLanguage] = useState<AppLanguage>('EN')
  const [messages, setMessages] = useState<ChatEntry[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<AppApiError | null>(null)
  const [lastQuery, setLastQuery] = useState<string | null>(null)
  const [lastContext, setLastContext] = useState<FarmContext>(EMPTY_CONTEXT)
  const [context, setContext] = useState<FarmContext>(EMPTY_CONTEXT)
  const [pendingQuery, setPendingQuery] = useState<string | null>(null)
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [questions, setQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const requestedLanguage =
    searchParams.get('lang') === 'TA' || searchParams.get('lang') === 'EN'
      ? (searchParams.get('lang') as AppLanguage)
      : language

  useEffect(() => {
    const urlLang = searchParams.get('lang')
    const nextLanguage = urlLang === 'TA' || urlLang === 'EN' ? urlLang : getStoredLanguage()
    setLanguage(nextLanguage)
    persistLanguage(nextLanguage)
  }, [searchParams])

  useEffect(() => {
    if (!queryFromUrl || initialQueryHandledRef.current === queryFromUrl) {
      return
    }

    initialQueryHandledRef.current = queryFromUrl
    void submitQuery(queryFromUrl, EMPTY_CONTEXT, true, requestedLanguage)
  }, [queryFromUrl, requestedLanguage])

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [messages, questions, isLoading, error])

  const t = uiText[language]

  const submitQuery = async (
    queryText: string,
    contextToSend: FarmContext,
    appendUserMessage: boolean,
    requestLanguage: AppLanguage = language
  ) => {
    const trimmed = queryText.trim()
    if (!trimmed) {
      return
    }

    setError(null)
    setLastQuery(trimmed)
    setLastContext(contextToSend)
    setIsLoading(true)

    if (appendUserMessage) {
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-user`,
          type: 'user',
          message: trimmed,
        },
      ])
    }

    try {
      const data = await apiRequest<QueryResponse>('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: trimmed,
          inputType: 'text',
          language: requestLanguage,
          context: contextToSend,
        }),
      })

      if (data.status === 'questions_needed') {
        setPendingQuery(trimmed)
        setMissingFields(data.missing_fields)
        setQuestions(data.questions)
        setAnswers((current) => {
          const nextAnswers = { ...current }
          for (const field of data.missing_fields) {
            const typedField = toFieldName(field)
            if (!typedField) {
              continue
            }

            const existingValue = contextToSend[typedField]
            if (existingValue !== null && existingValue !== undefined) {
              nextAnswers[typedField] = String(existingValue)
            }
          }
          return nextAnswers
        })
        return
      }

      if (!data.result) {
        throw { message: t.followUpError, retryable: true } satisfies AppApiError
      }

      const result = data.result
      let audioUrl = result.audio_url
      if (requestLanguage === 'TA' && !audioUrl) {
        const ttsData = await apiRequest<TtsResponse>('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: result.summary,
            language: requestLanguage,
          }),
        })
        audioUrl = ttsData.audioUrl
      }

      setPendingQuery(null)
      setMissingFields([])
      setQuestions([])
      setAnswers({})
      setContext(contextToSend)
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          type: 'assistant',
          message: result.summary,
          result,
          audioUrl,
        },
      ])
    } catch (error) {
      setError(getFriendlyError(error, t.followUpError))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async () => {
    const trimmed = inputValue.trim()
    if (!trimmed || isLoading) {
      return
    }

    setInputValue('')
    await submitQuery(trimmed, context, true)
  }

  const handleRetry = async () => {
    if (!lastQuery) {
      return
    }

    await submitQuery(lastQuery, lastContext, false)
  }

  const handleAnswerChange = (field: string, value: string) => {
    setAnswers((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleQuestionsSubmit = async () => {
    if (!pendingQuery) {
      return
    }

    const nextContext = buildContext(context, answers, missingFields)
    await submitQuery(pendingQuery, nextContext, false)
  }

  const insightCards = useMemo(() => {
    return insightDesign.map((design) => ({
      ...design,
      key: design.type,
    }))
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-screen flex flex-col bg-gradient-to-b from-background via-primary/5 to-background relative"
    >
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
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
            aria-label={t.profile}
          >
            <CircleUserRound className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>

      <div ref={scrollContainerRef} className="h-[75vh] overflow-y-auto">
        <div className="max-w-md mx-auto px-4 py-4 pb-44 space-y-4">
          {messages.length === 0 && !queryFromUrl && (
            <div className="flex items-center gap-3">
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
                {t.noQuery}
              </div>
            </div>
          )}

          {messages.map((message) => {
            if (message.type === 'user') {
              return (
                <div key={message.id} className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-4 py-3 max-w-[80%] shadow-sm">
                    {message.message}
                  </div>
                </div>
              )
            }

            const result = message.result
            if (!result) {
              return null
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
                  <div className="bg-muted text-foreground rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%] shadow-sm space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm leading-6">{result.summary}</p>
                      <Badge variant="secondary" className="shrink-0">
                        {t.confidence}: {result.confidence_level}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {insightCards.map((card, index) => {
                        const insight = result.insights[index]

                        return (
                          <div
                            key={`${message.id}-${card.key}`}
                            className={`rounded-2xl shadow-sm p-3 min-h-32 bg-gradient-to-br ${card.tone} border border-border flex flex-col justify-between`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-background/80 flex items-center justify-center shrink-0">
                                <card.icon className="w-4 h-4 text-foreground" />
                              </div>
                              <p className="font-semibold text-sm text-foreground leading-tight">
                                {insight?.title ?? card.type}
                              </p>
                            </div>
                            <p className="text-sm text-muted-foreground leading-tight">
                              {insight?.description}
                            </p>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <ArrowUpRight className="w-3 h-3" />
                              <span>{insight?.type ?? card.type}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
                        <p className="text-xs text-muted-foreground">{t.finalScore}</p>
                        <p className="mt-1 text-2xl font-bold text-foreground">
                          {result.final_score}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border bg-background/60 p-3">
                        <p className="text-xs text-muted-foreground">{t.confidence}</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {result.confidence_level}
                        </p>
                      </div>
                    </div>

                    {result.high_risks.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                          {t.highRisk}
                        </p>
                        {result.high_risks.map((risk) => (
                          <div
                            key={`${message.id}-${risk}`}
                            className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                          >
                            {risk}
                          </div>
                        ))}
                      </div>
                    )}

                    {result.medium_risks.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                          {t.mediumRisk}
                        </p>
                        {result.medium_risks.map((risk) => (
                          <div
                            key={`${message.id}-${risk}`}
                            className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700"
                          >
                            {risk}
                          </div>
                        ))}
                      </div>
                    )}

                    {result.mitigation.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                          {t.mitigation}
                        </p>
                        {result.mitigation.map((item) => (
                          <div
                            key={`${message.id}-${item}`}
                            className="rounded-2xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    )}

                    {result.actions.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          {t.actions}
                        </p>
                        {result.actions.map((action) => (
                          <div
                            key={`${message.id}-${action}`}
                            className="rounded-2xl border border-border bg-background/70 px-3 py-2 text-sm text-foreground"
                          >
                            {action}
                          </div>
                        ))}
                      </div>
                    )}

                    {result.assumptions.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          {t.assumptions}
                        </p>
                        {result.assumptions.map((assumption) => (
                          <div
                            key={`${message.id}-${assumption}`}
                            className="rounded-2xl border border-border bg-background/70 px-3 py-2 text-sm text-muted-foreground"
                          >
                            {assumption}
                          </div>
                        ))}
                      </div>
                    )}

                    {message.audioUrl && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          {t.audio}
                        </p>
                        <audio
                          controls
                          autoPlay={language === 'TA'}
                          src={message.audioUrl}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {isLoading && (
            <div className="rounded-3xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-3">
                <Spinner className="size-5 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">{t.loading}</p>
                  <p className="text-sm text-muted-foreground">{t.loadingSubtext}</p>
                </div>
              </div>
            </div>
          )}

          {questions.length > 0 && pendingQuery && (
            <div className="rounded-3xl border border-border bg-card p-4 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">{t.questionsTitle}</h2>
                <p className="text-sm text-muted-foreground">{t.questionsHint}</p>
              </div>

              {questions.map((question, index) => {
                const field = toFieldName(missingFields[index]) ?? missingFields[index]
                const isBoolean = field === 'market_dependency'
                const isNumber = field === 'land_size_acres'
                const label =
                  typeof field === 'string' && field in t
                    ? t[field as keyof typeof t]
                    : missingFields[index]

                return (
                  <div key={`${field}-${index}`} className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{label}</label>
                    <p className="text-xs text-muted-foreground">{question}</p>
                    {isBoolean ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleAnswerChange(String(field), 'yes')}
                          className={`rounded-2xl border px-3 py-2 text-sm ${
                            answers[String(field)] === 'yes'
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-foreground'
                          }`}
                        >
                          {t.yes}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAnswerChange(String(field), 'no')}
                          className={`rounded-2xl border px-3 py-2 text-sm ${
                            answers[String(field)] === 'no'
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-foreground'
                          }`}
                        >
                          {t.no}
                        </button>
                      </div>
                    ) : (
                      <input
                        type={isNumber ? 'number' : 'text'}
                        value={answers[String(field)] ?? ''}
                        onChange={(event) => handleAnswerChange(String(field), event.target.value)}
                        placeholder={isNumber ? t.numberPlaceholder : t.textPlaceholder}
                        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                      />
                    )}
                  </div>
                )
              })}

              <button
                onClick={() => void handleQuestionsSubmit()}
                disabled={isLoading}
                className="w-full rounded-2xl bg-primary text-primary-foreground px-4 py-3 font-semibold disabled:opacity-60"
              >
                {t.submitAnswers}
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="text-sm">{error.message}</p>
              {error.retryable && (
                <button
                  onClick={() => void handleRetry()}
                  className="mt-3 inline-flex rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {t.retry}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-20 left-0 right-0 border-t border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center gap-2 rounded-full bg-card/90 border border-border shadow-sm p-1">
            <input
              type="text"
              placeholder={t.inputPlaceholder}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleSendMessage()
                }
              }}
              className="flex-1 bg-transparent rounded-full p-3 focus:outline-none text-foreground placeholder:text-muted-foreground"
              disabled={isLoading}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => void handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              className="bg-primary text-primary-foreground w-11 h-11 rounded-full font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center"
            >
              {isLoading ? <Spinner className="size-5" /> : <Send className="w-5 h-5" />}
            </motion.button>
          </div>
        </div>
      </div>

      <BottomNavigation />
    </motion.div>
  )
}

export default function AssistantPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AssistantPageContent />
    </Suspense>
  )
}
