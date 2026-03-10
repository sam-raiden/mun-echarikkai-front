'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ImagePlus, Mic, SendHorizontal, TrendingUp } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Spinner } from '@/components/ui/spinner'
import {
  apiRequest,
  getFriendlyError,
  getStoredLanguage,
  persistLanguage,
  type AppApiError,
  type AppLanguage,
} from '@/lib/api'
import { type QueryInputType } from '@/lib/farm'

interface VoiceToTextResponse {
  transcript: string
}

interface ImageAnalysisResponse {
  findings?: Array<{
    label: string
    confidence: number
  }>
  recommendedQuery?: string
}

type WebkitWindow = Window & {
  webkitSpeechRecognition?: new () => SpeechRecognitionLike
  SpeechRecognition?: new () => SpeechRecognitionLike
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

const uiText = {
  EN: {
    placeholder: 'Ask about your crop problem...',
    helper: 'Tip: add a crop photo for better advice',
    imageSelected: 'Image selected:',
    uploadAria: 'Upload crop image',
    voiceAria: 'Speak your question',
    sendAria: 'Send question',
    marketAria: 'Open market page',
    recording: 'Recording...',
    recognizing: 'Listening...',
    analyzingImage: 'Analyzing image...',
    voiceError: 'We could not understand your voice. Please try again.',
    imageError: 'We could not analyze that image. Please try another one.',
    unsupportedVoice: 'Voice input is not available right now.',
    retry: 'Retry',
    languageLabel: 'Language',
  },
  TA: {
    placeholder: 'உங்கள் பயிர் பிரச்சினையை கேளுங்கள்...',
    helper: 'சிறந்த ஆலோசனைக்கு பயிர் புகைப்படத்தை சேர்க்கவும்',
    imageSelected: 'தேர்ந்தெடுத்த படம்:',
    uploadAria: 'பயிர் படத்தை பதிவேற்று',
    voiceAria: 'கேள்வியை பேசுங்கள்',
    sendAria: 'கேள்வியை அனுப்பு',
    marketAria: 'சந்தை பக்கத்தை திற',
    recording: 'பதிவு செய்கிறோம்...',
    recognizing: 'கேட்டு கொண்டிருக்கிறோம்...',
    analyzingImage: 'படத்தை ஆய்வு செய்கிறோம்...',
    voiceError: 'உங்கள் குரலைப் புரிந்துகொள்ள முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
    imageError: 'இந்த படத்தை ஆய்வு செய்ய முடியவில்லை. வேறு படத்தை முயற்சிக்கவும்.',
    unsupportedVoice: 'குரல் உள்ளீடு இப்போது கிடைக்கவில்லை.',
    retry: 'மீண்டும் முயற்சி',
    languageLabel: 'மொழி',
  },
} as const

type RetryAction = 'voice' | 'image' | null

function HomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  const [question, setQuestion] = useState('')
  const [selectedImageName, setSelectedImageName] = useState('')
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [language, setLanguage] = useState<AppLanguage>('EN')
  const [pendingInputType, setPendingInputType] = useState<QueryInputType>('text')
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [isRecordingFallback, setIsRecordingFallback] = useState(false)
  const [isVoiceLoading, setIsVoiceLoading] = useState(false)
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [error, setError] = useState<AppApiError | null>(null)
  const [retryAction, setRetryAction] = useState<RetryAction>(null)
  const [lastImageFile, setLastImageFile] = useState<File | null>(null)

  useEffect(() => {
    const urlLang = searchParams.get('lang')
    const nextLanguage = urlLang === 'TA' || urlLang === 'EN' ? urlLang : getStoredLanguage()
    setLanguage(nextLanguage)
    persistLanguage(nextLanguage)
  }, [searchParams])

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop())
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  const t = uiText[language]

  const openAssistant = (value: string, inputType: QueryInputType) => {
    const trimmed = value.trim()
    if (!trimmed) {
      return
    }

    const params = new URLSearchParams()
    params.set('lang', language)
    params.set('q', trimmed)
    params.set('inputType', inputType)
    router.push(`/assistant?${params.toString()}`)
  }

  const getRecognition = () => {
    const speechWindow = window as WebkitWindow
    const Ctor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!Ctor) {
      return null
    }

    return new Ctor()
  }

  const fallbackRecordVoice = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof window === 'undefined' || !window.MediaRecorder) {
      setError({ message: t.unsupportedVoice, retryable: false })
      return
    }

    if (isRecordingFallback) {
      mediaRecorderRef.current?.stop()
      return
    }

    try {
      setError(null)
      setRetryAction('voice')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []
      mediaRecorderRef.current = mediaRecorder
      setIsRecordingFallback(true)

      mediaRecorder.ondataavailable = (event) => chunks.push(event.data)
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        setIsRecordingFallback(false)
        setIsVoiceLoading(true)

        try {
          const blob = new Blob(chunks, { type: 'audio/wav' })
          const formData = new FormData()
          formData.append('audio', blob, 'recording.wav')
          const data = await apiRequest<VoiceToTextResponse>('/api/voice', {
            method: 'POST',
            body: formData,
          })
          setQuestion(data.transcript)
          setPendingInputType('voice')
          openAssistant(data.transcript, 'voice')
        } catch (error) {
          setError(getFriendlyError(error, t.voiceError))
        } finally {
          setIsVoiceLoading(false)
        }
      }

      mediaRecorder.start()
    } catch {
      setError({ message: t.voiceError, retryable: true })
      setIsRecordingFallback(false)
    }
  }

  const handleVoice = async () => {
    if (isVoiceLoading || isImageLoading) {
      return
    }

    const recognition = typeof window !== 'undefined' ? getRecognition() : null
    if (!recognition) {
      await fallbackRecordVoice()
      return
    }

    setError(null)
    setRetryAction('voice')
    setPendingInputType('voice')
    recognition.lang = language === 'TA' ? 'ta-IN' : 'en-IN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setQuestion(transcript)
      setIsRecognizing(false)
      openAssistant(transcript, 'voice')
    }
    recognition.onerror = () => {
      setIsRecognizing(false)
      void fallbackRecordVoice()
    }
    recognition.onend = () => {
      setIsRecognizing(false)
    }

    setIsRecognizing(true)
    recognition.start()
  }

  const analyzeImage = async (file: File) => {
    setError(null)
    setRetryAction('image')
    setIsImageLoading(true)

    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('crop', question.trim() || 'unknown')
      const data = await apiRequest<ImageAnalysisResponse>('/api/image-analysis', {
        method: 'POST',
        body: formData,
      })
      const recommendedQuery =
        data.recommendedQuery?.trim() ||
        data.findings?.[0]?.label?.trim() ||
        ''

      setQuestion(recommendedQuery)
      setPendingInputType('image')
      openAssistant(recommendedQuery, 'image')
    } catch (error) {
      setError(getFriendlyError(error, t.imageError))
    } finally {
      setIsImageLoading(false)
    }
  }

  const handleImagePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }

    const previewUrl = URL.createObjectURL(file)
    previewUrlRef.current = previewUrl
    setImagePreviewUrl(previewUrl)
    setSelectedImageName(file.name)
    setLastImageFile(file)
    await analyzeImage(file)
  }

  const handleRetry = async () => {
    if (retryAction === 'voice') {
      await handleVoice()
      return
    }

    if (retryAction === 'image' && lastImageFile) {
      await analyzeImage(lastImageFile)
    }
  }

  const helperText = isRecordingFallback
    ? t.recording
    : isRecognizing
      ? t.recognizing
      : isVoiceLoading
        ? t.recording
        : isImageLoading
          ? t.analyzingImage
          : selectedImageName
            ? `${t.imageSelected} ${selectedImageName}`
            : t.helper

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
        <div className="bg-white/95 text-black rounded-[28px] shadow-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value)
                setPendingInputType('text')
              }}
              placeholder={t.placeholder}
              className="flex-1 bg-transparent outline-none text-black placeholder:text-gray-500"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-lime-600 disabled:opacity-50"
              aria-label={t.uploadAria}
              disabled={isImageLoading || isVoiceLoading}
            >
              {isImageLoading ? <Spinner className="size-4" /> : <ImagePlus className="w-4 h-4" />}
            </button>
            <button
              onClick={() => void handleVoice()}
              className={`w-10 h-10 rounded-full border flex items-center justify-center disabled:opacity-50 ${
                isRecognizing || isRecordingFallback
                  ? 'border-red-300 bg-red-50 text-red-500'
                  : 'border-gray-200 text-lime-600'
              }`}
              aria-label={t.voiceAria}
              disabled={isImageLoading || isVoiceLoading}
            >
              {isVoiceLoading ? <Spinner className="size-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              onClick={() => openAssistant(question, pendingInputType)}
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-lime-600 disabled:opacity-50"
              aria-label={t.sendAria}
              disabled={!question.trim() || isImageLoading || isVoiceLoading}
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

          <div className="flex items-center gap-3 px-2 text-[11px] text-gray-500 min-h-10">
            {imagePreviewUrl && (
              <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-gray-200 shrink-0">
                <Image
                  src={imagePreviewUrl}
                  alt="Selected crop preview"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              {(isRecognizing || isRecordingFallback) && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
              <span>{helperText}</span>
            </div>
          </div>

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
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <HomePage />
    </Suspense>
  )
}
