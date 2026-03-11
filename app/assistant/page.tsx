'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Cloud, Leaf, Pill, Send, TrendingUp } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

import { BottomNavigation } from '@/components/BottomNavigation'
import { Spinner } from '@/components/ui/spinner'
import {
  apiRequest,
  getFriendlyError,
  getStoredLanguage,
  persistLanguage,
  type AppApiError,
  type AppLanguage,
} from '@/lib/api'

type RequiredField = 'crop' | 'location' | 'month' | 'irrigation'

interface FarmContext {
  crop: string | null
  location: string | null
  month: string | null
  irrigation: string | null
  land_size_acres: number
  market_dependency: boolean
}

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

interface TtsResponse {
  audioUrl: string
}

const DEFAULT_CONTEXT: FarmContext = {
  crop: null,
  location: null,
  month: null,
  irrigation: null,
  land_size_acres: 2,
  market_dependency: true,
}

const REQUIRED_FIELDS: RequiredField[] = ['crop', 'location', 'month', 'irrigation']

const insightDesign = [
  { type: 'diagnosis', icon: Leaf, color: '#E8F5E9' },
  { type: 'weather', icon: Cloud, color: '#E3F2FD' },
  { type: 'treatment', icon: Pill, color: '#FFF3E0' },
  { type: 'market', icon: TrendingUp, color: '#F3E5F5' },
] as const

const uiText = {
  EN: {
    title: 'Farm Assistant',
    subtitle: 'Your AI farming guide',
    inputPlaceholder: 'Ask a follow-up question...',
    loading: 'Analyzing...',
    followUpError: 'Sorry, could not connect to server. Please try again.',
    questionsTitle: 'A few details will improve the advice',
    submitAnswers: 'Continue analysis',
    retry: 'Retry',
    noQuery: 'Start from the home page or ask a question below.',
    audio: 'Tamil audio',
    crop: 'Crop',
    location: 'Location',
    month: 'Month',
    irrigation: 'Irrigation',
    textPlaceholder: 'Type your answer',
  },
  TA: {
    title: 'பண்ணை உதவியாளர்',
    subtitle: 'உங்கள் AI விவசாய வழிகாட்டி',
    inputPlaceholder: 'அடுத்த கேள்வியை கேளுங்கள்...',
    loading: 'ஆய்வு செய்கிறோம்...',
    followUpError: 'மன்னிக்கவும். சர்வருடன் இணைக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
    questionsTitle: 'சில விவரங்கள் ஆலோசனையை மேம்படுத்தும்',
    submitAnswers: 'ஆய்வை தொடர்க',
    retry: 'மீண்டும் முயற்சி',
    noQuery: 'முகப்பு பக்கத்தில் இருந்து தொடங்குங்கள் அல்லது கீழே கேள்வி கேளுங்கள்.',
    audio: 'தமிழ் ஒலி',
    crop: 'பயிர்',
    location: 'இடம்',
    month: 'மாதம்',
    irrigation: 'நீர்ப்பாசனம்',
    textPlaceholder: 'உங்கள் பதிலை உள்ளிடுங்கள்',
  },
} as const

function getRequiredFields(fields: string[]) {
  return fields.filter((field): field is RequiredField =>
    REQUIRED_FIELDS.includes(field as RequiredField)
  )
}

function AssistantPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [language, setLanguage] = useState<AppLanguage>('EN')
  const [inputValue, setInputValue] = useState('')
  const [queryText, setQueryText] = useState('')
  const [context, setContext] = useState<FarmContext>(DEFAULT_CONTEXT)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<AppApiError | null>(null)
  const [missingFields, setMissingFields] = useState<RequiredField[]>([])
  const [questions, setQuestions] = useState<Record<RequiredField, string>>({
    crop: '',
    location: '',
    month: '',
    irrigation: '',
  })
  const [answers, setAnswers] = useState<Record<RequiredField, string>>({
    crop: '',
    location: '',
    month: '',
    irrigation: '',
  })

  const t = uiText[language]

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
    const q = searchParams.get('q')?.trim() ?? ''
    if (!q) {
      return
    }

    setQueryText(q)
    void submitQuery(q, DEFAULT_CONTEXT, requestedLanguage)
  }, [requestedLanguage, searchParams])

  const cards = useMemo(
    () =>
      insightDesign.map((card) => ({
        ...card,
        insight: result?.insights.find((item) => item.type === card.type),
      })),
    [result]
  )

  const submitQuery = async (
    nextQuery: string,
    nextContext: FarmContext,
    requestLanguage: AppLanguage = language
  ) => {
    if (!nextQuery.trim()) {
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      const data = await apiRequest<QueryResponse>('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: nextQuery.trim(),
          language: requestLanguage,
          context: nextContext,
        }),
      })

      if (data.status === 'questions_needed') {
        const requiredFields = getRequiredFields(data.missing_fields)
        const nextQuestions = {
          crop: '',
          location: '',
          month: '',
          irrigation: '',
        }

        requiredFields.forEach((field) => {
          const index = data.missing_fields.findIndex((item) => item === field)
          nextQuestions[field] = index >= 0 ? data.questions[index] : ''
        })

        setMissingFields(requiredFields)
        setQuestions(nextQuestions)
        setResult(null)
        setAudioUrl(null)
        return
      }

      if (!data.result) {
        throw { message: t.followUpError, retryable: true } satisfies AppApiError
      }

      let nextAudioUrl = data.result.audio_url
      if (requestLanguage === 'TA' && !nextAudioUrl) {
        const ttsData = await apiRequest<TtsResponse>('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: data.result.summary,
            language: requestLanguage,
          }),
        })

        nextAudioUrl = ttsData.audioUrl
      }

      setContext(nextContext)
      setResult(data.result)
      setAudioUrl(nextAudioUrl)
      setMissingFields([])
    } catch (caughtError) {
      setError(getFriendlyError(caughtError, t.followUpError))
    } finally {
      setIsLoading(false)
    }
  }

  const handleFollowUp = async () => {
    if (!inputValue.trim() || isLoading) {
      return
    }

    const nextQuery = inputValue.trim()
    setInputValue('')
    setQueryText(nextQuery)
    await submitQuery(nextQuery, context)
  }

  const handleMissingSubmit = async () => {
    const nextContext: FarmContext = {
      ...context,
      land_size_acres: 2,
      market_dependency: true,
    }

    missingFields.forEach((field) => {
      nextContext[field] = answers[field].trim() || nextContext[field]
    })

    await submitQuery(queryText, nextContext)
  }

  try {
    const diagnosisDescription = result?.insights?.[0]?.description ?? ''
    const weatherDescription = result?.insights?.[1]?.description ?? ''
    const treatmentDescription = result?.insights?.[2]?.description ?? ''
    const marketDescription = result?.insights?.[3]?.description ?? ''
    void diagnosisDescription
    void weatherDescription
    void treatmentDescription
    void marketDescription

    if (!result && isLoading) return <div>Loading...</div>
    if (result && !result.insights) return <div>Loading...</div>

    return (
      <div className="h-screen flex flex-col bg-gradient-to-b from-background via-primary/5 to-background relative">
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
                <h1 className="text-lg font-bold text-foreground">{t?.title ?? 'Assistant'}</h1>
                <p className="text-xs text-muted-foreground">{t?.subtitle ?? ''}</p>
              </div>
            </div>
            <button
              onClick={() => {
                const nextLanguage: AppLanguage = language === 'EN' ? 'TA' : 'EN'
                setLanguage(nextLanguage)
                persistLanguage(nextLanguage)
              }}
              className="rounded-full border border-border px-3 py-1 text-xs text-foreground"
            >
              {language}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-40">
          <div className="max-w-md mx-auto px-4 py-5 space-y-4">
            {!queryText && !result && !isLoading && (
              <div className="rounded-3xl border border-border bg-card p-5 text-sm text-muted-foreground">
                {t?.noQuery ?? 'Loading...'}
              </div>
            )}

            {isLoading && (
              <div className="rounded-3xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-3">
                  <Spinner className="size-5 text-primary" />
                  <p className="font-semibold text-foreground">{t?.loading ?? 'Loading...'}</p>
                </div>
              </div>
            )}

            {result ? (
              <div className="rounded-3xl border border-border bg-card p-4 shadow-sm space-y-4">
                <p className="text-sm leading-6 text-foreground">{result?.summary ?? ''}</p>

                <div className="grid grid-cols-2 gap-3">
                  {cards?.map((card) => (
                    <div
                      key={card?.type}
                      className="rounded-2xl p-3 min-h-32 shadow-sm"
                      style={{ backgroundColor: card?.color }}
                    >
                      <div className="flex items-center gap-2">
                        {card?.icon ? <card.icon className="w-4 h-4 text-foreground" /> : null}
                        <p className="text-sm font-semibold text-foreground">
                          {card?.insight?.title ?? card?.type ?? ''}
                        </p>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">
                        {card?.insight?.description ?? ''}
                      </p>
                    </div>
                  ))}
                </div>

                {language === 'TA' && audioUrl ? (
                  <div className="rounded-2xl border border-border bg-background/80 p-3">
                    <p className="mb-2 text-xs font-semibold text-foreground">{t?.audio ?? ''}</p>
                    <audio controls autoPlay src={audioUrl ?? undefined} className="w-full" />
                  </div>
                ) : null}
              </div>
            ) : null}

            {missingFields?.length > 0 && (
              <div className="rounded-3xl border border-border bg-card p-4 space-y-4">
                <h2 className="text-base font-semibold text-foreground">
                  {t?.questionsTitle ?? 'Loading...'}
                </h2>
                {missingFields?.map((field) => (
                  <div key={field} className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{t?.[field] ?? field}</label>
                    <p className="text-xs text-muted-foreground">{questions?.[field] ?? ''}</p>
                    <input
                      type="text"
                      value={answers?.[field] ?? ''}
                      onChange={(event) =>
                        setAnswers((current) => ({
                          ...current,
                          [field]: event.target.value,
                        }))
                      }
                      placeholder={t?.textPlaceholder ?? ''}
                      className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                    />
                  </div>
                ))}

                <button
                  onClick={() => void handleMissingSubmit()}
                  disabled={isLoading}
                  className="w-full rounded-2xl bg-primary text-primary-foreground px-4 py-3 font-semibold disabled:opacity-60"
                >
                  {t?.submitAnswers ?? 'Continue'}
                </button>
              </div>
            )}

            {error ? (
              <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-red-700">
                <p className="text-sm">{error?.message ?? 'Loading...'}</p>
                {error?.retryable ? (
                  <button
                    onClick={() => void submitQuery(queryText, context)}
                    className="mt-3 inline-flex rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {t?.retry ?? 'Retry'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="fixed bottom-20 left-0 right-0 border-t border-border bg-background/80 backdrop-blur-md">
          <div className="max-w-md mx-auto px-4 py-3">
            <div className="flex items-center gap-2 rounded-full bg-card/90 border border-border shadow-sm p-1">
              <input
                type="text"
                placeholder={t?.inputPlaceholder ?? 'Loading...'}
                value={inputValue ?? ''}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleFollowUp()
                  }
                }}
                className="flex-1 bg-transparent rounded-full p-3 focus:outline-none text-foreground placeholder:text-muted-foreground"
                disabled={isLoading}
              />
              <button
                onClick={() => void handleFollowUp()}
                disabled={!inputValue?.trim() || isLoading}
                className="bg-primary text-primary-foreground w-11 h-11 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center"
              >
                {isLoading ? <Spinner className="size-5" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        <BottomNavigation />
      </div>
    )
  } catch {
    return <div>Loading...</div>
  }
}

export default function AssistantPageWrapper() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            fontSize: '18px',
          }}
        >
          🌾 Loading...
        </div>
      }
    >
      <AssistantPage />
    </Suspense>
  )
}
