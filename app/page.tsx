'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ImagePlus, SendHorizontal, TrendingUp } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Spinner } from '@/components/ui/spinner'
import { VoiceButton } from '@/components/VoiceButton'
import {
  apiRequest,
  getFriendlyError,
  getStoredLanguage,
  persistLanguage,
  type AppApiError,
  type AppLanguage,
} from '@/lib/api'

interface QueryResponse {
  status: 'complete' | 'questions_needed'
}

interface ImageAnalysisResponse {
  findings?: Array<{
    label: string
    confidence: number
  }>
  recommendedQuery?: string
}

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  onstart: (() => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  start: () => void
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike
  webkitSpeechRecognition?: new () => SpeechRecognitionLike
}

const DEFAULT_CONTEXT = {
  land_size_acres: 2,
  market_dependency: true,
}

const uiText = {
  EN: {
    placeholder: 'Ask about your crop problem...',
    tip: 'Tip: add a crop photo for better advice',
    imageSelected: 'Image selected:',
    uploadAria: 'Upload crop image',
    sendAria: 'Send question',
    marketAria: 'Open market page',
    listening: 'Listening to your question...',
    analyzingImage: 'Analyzing your crop image...',
    voiceError: 'Sorry, could not connect to server. Please try again.',
    imageError: 'Sorry, could not connect to server. Please try again.',
    unsupportedVoice: 'Voice not supported in this browser. Please use Chrome.',
    retry: 'Retry',
    startVoice: 'Tap to record',
    stopVoice: 'Listening...',
    ready: 'Your question will open in the assistant.',
    languageLabel: 'Language',
  },
  TA: {
    placeholder: 'உங்கள் பயிர் பிரச்சினையை கேளுங்கள்...',
    tip: 'சிறந்த ஆலோசனைக்கு பயிர் புகைப்படத்தை சேர்க்கவும்',
    imageSelected: 'தேர்ந்தெடுத்த படம்:',
    uploadAria: 'பயிர் படத்தை பதிவேற்று',
    sendAria: 'கேள்வியை அனுப்பு',
    marketAria: 'சந்தை பக்கத்தை திற',
    listening: 'உங்கள் கேள்வியை கேட்டு கொண்டிருக்கிறோம்...',
    analyzingImage: 'பயிர் படத்தை ஆய்வு செய்கிறோம்...',
    voiceError: 'மன்னிக்கவும். சர்வருடன் இணைக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
    imageError: 'மன்னிக்கவும். சர்வருடன் இணைக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
    unsupportedVoice: 'இந்த உலாவியில் குரல் வசதி இல்லை. Chrome பயன்படுத்தவும்.',
    retry: 'மீண்டும் முயற்சி',
    startVoice: 'பதிவு தொடங்கு',
    stopVoice: 'கேட்டு கொண்டிருக்கிறது...',
    ready: 'உங்கள் கேள்வி உதவி பக்கத்தில் திறக்கும்.',
    languageLabel: 'மொழி',
  },
} as const

type RetryAction = 'submit' | 'image' | null

function HomePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [selectedImageName, setSelectedImageName] = useState('')
  const [language, setLanguage] = useState<AppLanguage>('EN')
  const [isListening, setIsListening] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [error, setError] = useState<AppApiError | null>(null)
  const [retryAction, setRetryAction] = useState<RetryAction>(null)
  const [lastSubmittedText, setLastSubmittedText] = useState('')
  const [lastImageFile, setLastImageFile] = useState<File | null>(null)

  useEffect(() => {
    const urlLang = searchParams.get('lang')
    const nextLanguage = urlLang === 'TA' || urlLang === 'EN' ? urlLang : getStoredLanguage()
    setLanguage(nextLanguage)
    persistLanguage(nextLanguage)
  }, [searchParams])

  const t = uiText[language]

  const navigateToAssistant = (queryText: string) => {
    const lower = queryText.toLowerCase()
    const crops = ['onion', 'tomato', 'rice', 'banana', 'cotton', 'sugarcane', 'chilli', 'brinjal', 'corn', 'wheat']
    const crop = crops.find((item) => lower.includes(item)) || ''
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
    const month = months.find((item) => lower.includes(item)) || ''
    const irrigations = ['borewell', 'canal', 'rainfed', 'drip', 'sprinkler']
    const irrigation = irrigations.find((item) => lower.includes(item)) || ''
    const locationMatch = queryText.match(/\b(?:in|at)\s+([A-Za-z\s]+?)(?:\s+(?:with|using|during|for)\b|$)/i)
    const location = locationMatch?.[1]?.trim() || ''

    const params = new URLSearchParams({
      q: queryText.trim(),
      lang: language,
      crop,
      location,
      month,
      irrigation,
    })
    router.push(`/assistant?${params.toString()}`)
  }

  const handleSubmit = async (submittedText?: string) => {
    const text = (submittedText ?? query).trim()
    if (!text || isSubmitting || isImageLoading) {
      return
    }

    setError(null)
    setRetryAction('submit')
    setLastSubmittedText(text)
    setIsSubmitting(true)

    try {
      await apiRequest<QueryResponse>('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: text,
          language,
          context: DEFAULT_CONTEXT,
        }),
      })

      navigateToAssistant(text)
    } catch (caughtError) {
      setError(getFriendlyError(caughtError, t.voiceError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVoice = () => {
    if (typeof window === 'undefined') {
      return
    }

    const SR =
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition
    if (!SR) {
      alert('Please use Chrome for voice input')
      return
    }

    const recognition = new SR()
    recognition.lang = language === 'TA' ? 'ta-IN' : 'en-IN'
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setQuery(transcript)
      void handleSubmit(transcript)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)
    recognition.onstart = () => setIsListening(true)
    recognition.start()
  }

  const analyzeImage = async (file: File) => {
    setError(null)
    setRetryAction('image')
    setLastImageFile(file)
    setIsImageLoading(true)

    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('crop', query.trim() || 'unknown')

      const data = await apiRequest<ImageAnalysisResponse>('/api/image-analysis', {
        method: 'POST',
        body: formData,
      })

      const nextQuery =
        data.recommendedQuery?.trim() ||
        data.findings?.[0]?.label?.trim() ||
        ''

      setQuery(nextQuery)
      await handleSubmit(nextQuery)
    } catch (caughtError) {
      setError(getFriendlyError(caughtError, t.imageError))
    } finally {
      setIsImageLoading(false)
    }
  }

  const handleImagePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setSelectedImageName(file ? file.name : '')

    if (file) {
      await analyzeImage(file)
    }
  }

  const handleRetry = async () => {
    if (retryAction === 'submit' && lastSubmittedText) {
      await handleSubmit(lastSubmittedText)
    }

    if (retryAction === 'image' && lastImageFile) {
      await analyzeImage(lastImageFile)
    }
  }

  const helperText = isImageLoading
    ? t.analyzingImage
    : isListening
      ? t.stopVoice
      : selectedImageName
        ? `${t.imageSelected} ${selectedImageName}`
        : t.tip

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
          onClick={() => {
            const nextLanguage: AppLanguage = language === 'EN' ? 'TA' : 'EN'
            setLanguage(nextLanguage)
            persistLanguage(nextLanguage)
          }}
          className="bg-black/45 text-white text-xs rounded-full px-3 py-1.5"
          aria-label={t.languageLabel}
        >
          {language}
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
        className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%]"
      >
        <div className="bg-white/95 text-black rounded-[28px] shadow-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.placeholder}
              className="flex-1 bg-transparent outline-none text-black placeholder:text-gray-500"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-lime-600 disabled:opacity-50"
              aria-label={t.uploadAria}
              disabled={isImageLoading || isSubmitting}
            >
              {isImageLoading ? <Spinner className="size-4" /> : <ImagePlus className="w-4 h-4" />}
            </button>
            <button
              onClick={() => void handleSubmit()}
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-lime-600 disabled:opacity-50"
              aria-label={t.sendAria}
              disabled={!query.trim() || isImageLoading || isSubmitting}
            >
              {isSubmitting ? <Spinner className="size-4" /> : <SendHorizontal className="w-4 h-4" />}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImagePick}
            className="hidden"
          />

          <div className="rounded-3xl bg-lime-50 border border-lime-100 p-4">
            <div className="flex items-center justify-center">
              <VoiceButton
                  onPress={handleVoice}
                isListening={isListening}
                isProcessing={isSubmitting}
              />
            </div>
            <p className="mt-4 text-center text-sm font-medium text-gray-700">
              {isListening ? t.listening : t.ready}
            </p>
            <p className="mt-1 text-center text-xs text-gray-500">
              {isListening ? t.stopVoice : t.startVoice}
            </p>
          </div>

          <div className="px-2 text-[11px] text-gray-500">{helperText}</div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p>{error.message}</p>
              {error.retryable && retryAction && (
                <button
                  onClick={() => void handleRetry()}
                  className="mt-2 inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white"
                >
                  {t.retry}
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default function Home() {
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
            background: '#f9fafb',
          }}
        >
          <div style={{ fontSize: '48px' }}>🌾</div>
          <div style={{ marginTop: '16px', fontSize: '16px', color: '#666' }}>
            Loading...
          </div>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  )
}
