'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ImagePlus, Mic, SendHorizontal } from 'lucide-react'

import { ChatMessage as MessageBubble } from '@/app/components/ChatMessage'
import {
  apiRequest,
  getStoredLanguage,
  persistLanguage,
  type AppLanguage,
} from '@/lib/api'
import {
  createDefaultContext,
  filterRequiredMissingFields,
  type FarmContext,
  type QueryInputType,
  type RequiredContextField,
} from '@/lib/farm'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  result?: {
    summary: string
    insights: Array<{ type: string; title: string; description: string }>
    language: string
    audio_url: string | null
  }
  isLoading?: boolean
}

type PendingFormState = {
  messageId: string
  originalQuery: string
  fields: RequiredContextField[]
  questions: Record<RequiredContextField, string>
}

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
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

interface QueryResponse {
  status: 'complete' | 'questions_needed'
  questions: string[]
  missing_fields: string[]
  result: {
    summary: string
    insights: Array<{ type: string; title: string; description: string }>
    language: string
    audio_url: string | null
  } | null
}

interface TranslateResponse {
  translations: string[]
}

interface TtsResponse {
  audioUrl: string
}

interface ImageAnalysisResponse {
  recommendedQuery?: string
  findings?: Array<{ label: string; confidence: number }>
}

const uiText = {
  EN: {
    title: '🌾 Assistant',
    placeholder: 'Type or speak...',
    emptyTitle: '🌾',
    emptyText: 'Ask me anything about your farm',
    emptySubtext: 'Type, speak, or upload a crop photo',
    retry: 'Retry',
    listenTamil: 'Listen in Tamil',
    listening: 'Listening...',
    formIntro: 'I need a few more details to give you accurate advice:',
    analyze: 'Analyze →',
    answerPlaceholder: 'Type your answer...',
    friendlyError: 'Sorry, could not connect to server. Please try again.',
    unsupportedVoice: 'Voice not supported in this browser. Please use Chrome.',
    labels: {
      crop: 'Which crop are you planning to grow?',
      location: 'Which location or district is this for?',
      month: 'Which month are you planning for?',
      irrigation: 'What irrigation source do you have?',
    },
    cards: {
      diagnosis: 'Diagnosis',
      weather: 'Weather',
      treatment: 'Treatment',
      market: 'Market',
    },
  },
  TA: {
    title: '🌾 Assistant',
    placeholder: 'Type or speak...',
    emptyTitle: '🌾',
    emptyText: 'உங்கள் பண்ணை பற்றி எதையும் கேளுங்கள்',
    emptySubtext: 'Type, speak, or upload a crop photo',
    retry: 'மீண்டும் முயற்சி',
    listenTamil: 'Listen in Tamil',
    listening: 'Listening...',
    formIntro: 'சரியான ஆலோசனைக்கு இன்னும் சில விவரங்கள் வேண்டும்:',
    analyze: 'Analyze →',
    answerPlaceholder: 'Type your answer...',
    friendlyError: 'Sorry, could not connect to server. Please try again.',
    unsupportedVoice: 'Voice not supported in this browser. Please use Chrome.',
    labels: {
      crop: 'Which crop are you planning to grow?',
      location: 'Which location or district is this for?',
      month: 'Which month are you planning for?',
      irrigation: 'What irrigation source do you have?',
    },
    cards: {
      diagnosis: 'Diagnosis',
      weather: 'Weather',
      treatment: 'Treatment',
      market: 'Market',
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

function inferContextFromQuery(query: string, base: FarmContext) {
  const next = createDefaultContext(base)
  const lower = query.toLowerCase()
  const cropMatch = lower.match(/plant\s+([a-z]+)/i) || lower.match(/grow\s+([a-z]+)/i)
  const monthMatch = lower.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i)
  const locationMatch = lower.match(/\bin\s+([a-z\s]+?)\s+in\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i)

  if (cropMatch && !next.crop) next.crop = cropMatch[1]
  if (monthMatch && !next.month) next.month = monthMatch[1]
  if (locationMatch && !next.location) next.location = locationMatch[1].trim()
  return next
}

function createImageContext(base: FarmContext, query: string) {
  const next = inferContextFromQuery(query, base)
  if (!next.crop) next.crop = query
  if (!next.location) next.location = 'Farmer field'
  if (!next.month) next.month = new Date().toLocaleString('en-US', { month: 'long' })
  if (!next.irrigation) next.irrigation = 'borewell'
  return next
}

function AssistantClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bottomRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const initializedRef = useRef(false)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [context, setContext] = useState<FarmContext>(createDefaultContext())
  const [input, setInput] = useState('')
  const [language, setLanguage] = useState<AppLanguage>('EN')
  const [activeForm, setActiveForm] = useState<PendingFormState | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [voiceField, setVoiceField] = useState<RequiredContextField | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [imageTarget, setImageTarget] = useState<'follow-up' | RequiredContextField | null>(null)
  const [lastRequest, setLastRequest] = useState<{ text: string; inputType: QueryInputType; context: FarmContext } | null>(null)

  const t = uiText[language]

  useEffect(() => {
    const urlLang = searchParams.get('lang')
    const nextLanguage = urlLang === 'TA' || urlLang === 'EN' ? urlLang : getStoredLanguage()
    setLanguage(nextLanguage)
    persistLanguage(nextLanguage)
  }, [searchParams])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (initializedRef.current) {
      return
    }

    const q = searchParams.get('q')?.trim()
    const initialType =
      searchParams.get('inputType') === 'image' || searchParams.get('inputType') === 'voice'
        ? (searchParams.get('inputType') as QueryInputType)
        : 'text'

    initializedRef.current = true
    if (q) {
      void sendMessage(q, initialType)
    }
  }, [searchParams])

  async function fetchTamilAudio(summary: string, existingUrl: string | null) {
    if (language !== 'TA') {
      return null
    }

    if (existingUrl) {
      return existingUrl
    }

    const translation = await apiRequest<TranslateResponse>('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        textBlocks: [summary],
        targetLanguage: 'TA',
      }),
    })

    const tts = await apiRequest<TtsResponse>('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: translation.translations[0] ?? summary,
        language: 'TA',
      }),
    })

    return tts.audioUrl
  }

  async function sendMessage(
    text: string,
    inputType: QueryInputType = 'text',
    contextOverride?: FarmContext,
    replaceLoadingId?: string
  ) {
    const trimmed = text.trim()
    if (!trimmed) {
      return
    }

    const mergedContext =
      inputType === 'image'
        ? createImageContext(contextOverride ?? context, trimmed)
        : inferContextFromQuery(trimmed, contextOverride ?? context)

    const loadingId = replaceLoadingId ?? `${Date.now()}-loading`
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: trimmed,
    }

    setLastRequest({ text: trimmed, inputType, context: mergedContext })
    setInput('')

    setMessages((prev) => {
      const next: ChatMessage[] = replaceLoadingId
        ? prev
        : [
            ...prev,
            userMessage,
            {
              id: loadingId,
              role: 'assistant',
              isLoading: true,
              text: '',
            },
          ]

      if (replaceLoadingId) {
        return prev.map((message) =>
          message.id === replaceLoadingId
            ? { ...message, isLoading: true, text: '' }
            : message
        )
      }

      return next
    })

    setActiveForm(null)

    try {
      const response = await apiRequest<QueryResponse>('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: trimmed,
          inputType,
          language,
          context: mergedContext,
        }),
      })

      if (response.status === 'questions_needed') {
        const requiredFields = filterRequiredMissingFields(response.missing_fields)

        if (requiredFields.length === 1 && requiredFields[0] === 'irrigation') {
          const fallbackContext = createDefaultContext(mergedContext)
          fallbackContext.irrigation = 'borewell'
          await sendMessage(trimmed, inputType, fallbackContext, loadingId)
          return
        }

        if (inputType === 'image') {
          const fallbackContext = createImageContext(mergedContext, trimmed)
          await sendMessage(trimmed, 'text', fallbackContext, loadingId)
          return
        }

        const nextQuestions = {
          crop: '',
          location: '',
          month: '',
          irrigation: '',
        }

        requiredFields.forEach((field) => {
          const index = response.missing_fields.findIndex((item) => item === field)
          nextQuestions[field] = index >= 0 ? response.questions[index] : t.labels[field]
        })

        setFormValues((current) => {
          const next = { ...current }
          requiredFields.forEach((field) => {
            if (!next[field] && mergedContext[field]) {
              next[field] = String(mergedContext[field])
            }
          })
          return next
        })

        setActiveForm({
          messageId: loadingId,
          originalQuery: trimmed,
          fields: requiredFields,
          questions: nextQuestions,
        })

        setMessages((prev) =>
          prev.map((message) =>
            message.id === loadingId
              ? {
                  ...message,
                  isLoading: false,
                  text: t.formIntro,
                }
              : message
          )
        )
        return
      }

      if (!response.result) {
        throw new Error('no-result')
      }

      const nextContext = createDefaultContext(mergedContext)
      const audioUrl = await fetchTamilAudio(response.result.summary, response.result.audio_url)

      setContext(nextContext)
      setMessages((prev) =>
        prev.map((message) =>
          message.id === loadingId
            ? {
                ...message,
                isLoading: false,
                text: response.result?.summary ?? '',
                result: {
                  ...response.result!,
                  audio_url: audioUrl,
                },
              }
            : message
        )
      )
    } catch {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === loadingId
            ? {
                ...message,
                isLoading: false,
                text: t.friendlyError,
              }
            : message
        )
      )
    }
  }

  const startVoice = (target: 'follow-up' | RequiredContextField) => {
    const recognition = getRecognition(language)
    if (!recognition) {
      window.alert(t.unsupportedVoice)
      return
    }

    let silenceTimer: ReturnType<typeof setTimeout> | null = null

    recognition.onstart = () => {
      setIsListening(target === 'follow-up')
      if (target !== 'follow-up') {
        setVoiceField(target)
      }
      silenceTimer = setTimeout(() => recognition.stop(), 5000)
    }
    recognition.onend = () => {
      setIsListening(false)
      setVoiceField(null)
      if (silenceTimer) {
        clearTimeout(silenceTimer)
      }
    }
    recognition.onerror = () => {
      setIsListening(false)
      setVoiceField(null)
    }
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      if (target === 'follow-up') {
        setInput(transcript)
        void sendMessage(transcript, 'text')
      } else {
        setFormValues((prev) => ({
          ...prev,
          [target]: transcript,
        }))
      }
    }

    recognition.start()
  }

  const openImagePicker = (target: 'follow-up' | RequiredContextField) => {
    setImageTarget(target)
    imageInputRef.current?.click()
  }

  const submitMissingInfo = async () => {
    if (!activeForm) {
      return
    }

    const nextContext = createDefaultContext(context)
    activeForm.fields.forEach((field) => {
      nextContext[field] = formValues[field]?.trim() || nextContext[field]
    })

    await sendMessage(activeForm.originalQuery, 'text', nextContext, activeForm.messageId)
  }

  return (
    <div className="min-h-screen bg-[#F8F8F8]">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file || !imageTarget) {
            return
          }

          const formData = new FormData()
          formData.append('image', file)
          formData.append('crop', context.crop || 'unknown')

          void apiRequest<ImageAnalysisResponse>('/api/image-analysis', {
            method: 'POST',
            body: formData,
          })
            .then((data) => {
              const value =
                data.recommendedQuery?.trim() ||
                data.findings?.[0]?.label?.trim() ||
                ''

              if (imageTarget === 'follow-up') {
                setInput(value)
                return sendMessage(value, 'image')
              }

              setFormValues((prev) => ({
                ...prev,
                [imageTarget]: value,
              }))
            })
            .catch(() => {
              setMessages((prev) => [
                ...prev,
                {
                  id: `${Date.now()}-error`,
                  role: 'assistant',
                  text: t.friendlyError,
                },
              ])
            })
            .finally(() => setImageTarget(null))
        }}
      />

      <header className="fixed inset-x-0 top-0 z-20 h-[52px] border-b border-[#E5E5E5] bg-white">
        <div className="mx-auto flex h-full max-w-[420px] items-center justify-between px-4">
          <button
            onClick={() => router.push(`/?lang=${language}`)}
            className="flex items-center gap-2 text-sm text-[#333]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t.title}</span>
          </button>
          <button
            onClick={() => {
              const nextLanguage: AppLanguage = language === 'EN' ? 'TA' : 'EN'
              setLanguage(nextLanguage)
              persistLanguage(nextLanguage)
            }}
            className="text-sm text-[#333]"
          >
            {language}
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-[420px] flex-col px-0 pt-[52px]">
        <div className="h-[calc(100vh-52px-76px)] overflow-y-auto pb-5">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-[#666]">
              <div className="text-4xl">{t.emptyTitle}</div>
              <p className="mt-3 text-sm">{t.emptyText}</p>
              <p className="mt-1 text-xs">{t.emptySubtext}</p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                role={message.role}
                text={message.text}
                isLoading={message.isLoading}
                result={message.result}
                audioUrl={message.result?.audio_url ?? null}
                titles={t.cards}
                tamilAudioLabel={t.listenTamil}
                formProps={
                  activeForm?.messageId === message.id
                    ? {
                        title: t.formIntro,
                        listeningText: t.listening,
                        continueLabel: t.analyze,
                        placeholder: t.answerPlaceholder,
                        fields: activeForm.fields,
                        labels: t.labels,
                        questions: activeForm.questions,
                        values: formValues,
                        activeVoiceField: voiceField,
                        onChange: (field, value) =>
                          setFormValues((prev) => ({
                            ...prev,
                            [field]: value,
                          })),
                        onMic: (field) => startVoice(field),
                        onImage: (field) => openImagePicker(field),
                        onSubmit: () => void submitMissingInfo(),
                      }
                    : undefined
                }
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E5E5E5] bg-white">
        <div className="mx-auto flex max-w-[420px] items-center gap-2 px-4 py-3">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && input.trim()) {
                void sendMessage(input, 'text')
              }
            }}
            placeholder={t.placeholder}
            className="flex-1 rounded-[20px] bg-[#F5F5F5] px-4 py-2.5 text-sm text-[#333] outline-none"
          />
          <button
            onClick={() => openImagePicker('follow-up')}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#F5F5F5]"
          >
            <ImagePlus className="h-4 w-4 text-[#555]" />
          </button>
          <button
            onClick={() => startVoice('follow-up')}
            className={`relative flex h-[38px] w-[38px] items-center justify-center rounded-full ${
              isListening ? 'bg-[#FFEBEE]' : 'bg-[#F5F5F5]'
            }`}
          >
            <Mic className={`h-4 w-4 ${isListening ? 'text-red-500' : 'text-[#555]'}`} />
            {isListening ? (
              <span className="absolute inset-0 rounded-full border border-red-300 animate-pulse" />
            ) : null}
          </button>
          <button
            onClick={() => void sendMessage(input, 'text')}
            disabled={!input.trim()}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#2ECC71] disabled:opacity-50"
          >
            <SendHorizontal className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AssistantPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8F8F8]" />}>
      <AssistantClient />
    </Suspense>
  )
}
