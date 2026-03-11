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

interface VoiceToTextResponse {
  transcript: string
  confidence: number
  language: string
}

interface ImageAnalysisResponse {
  findings: Array<{
    label: string
    confidence: number
  }>
  recommendedQuery: string
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
    transcribing: 'Turning your voice into text...',
    analyzingImage: 'Analyzing your crop image...',
    voiceError: 'We could not process the recording. Please try again.',
    imageError: 'We could not analyze that image. Please try another one.',
    unsupportedVoice: 'Voice recording is not supported in this browser.',
    retry: 'Retry',
    startVoice: 'Tap to record',
    stopVoice: 'Tap again to stop',
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
    transcribing: 'உங்கள் குரலை உரையாக மாற்றுகிறோம்...',
    analyzingImage: 'பயிர் படத்தை ஆய்வு செய்கிறோம்...',
    voiceError: 'பதிவை செயலாக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
    imageError: 'இந்த படத்தை ஆய்வு செய்ய முடியவில்லை. வேறு படத்தை முயற்சிக்கவும்.',
    unsupportedVoice: 'இந்த உலாவியில் குரல் பதிவு ஆதரிக்கப்படவில்லை.',
    retry: 'மீண்டும் முயற்சி',
    startVoice: 'பதிவு தொடங்கு',
    stopVoice: 'நிறுத்த மீண்டும் தட்டவும்',
    ready: 'உங்கள் கேள்வி உதவி பக்கத்தில் திறக்கும்.',
    languageLabel: 'மொழி',
  },
} as const

type RetryAction = 'voice' | 'image' | null

function HomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const [question, setQuestion] = useState('')
  const [selectedImageName, setSelectedImageName] = useState('')
  const [language, setLanguage] = useState<AppLanguage>('EN')
  const [isListening, setIsListening] = useState(false)
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
    }
  }, [])

  const t = uiText[language]

  const goToAssistant = (queryText: string) => {
    const trimmed = queryText.trim()
    if (!trimmed) {
      return
    }

    const params = new URLSearchParams()
    params.set('lang', language)
    params.set('q', trimmed)
    router.push(`/assistant?${params.toString()}`)
  }

  const handleAsk = () => {
    setError(null)
    goToAssistant(question)
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop())
  }

  const transcribeVoice = async (audioBlob: Blob) => {
    setError(null)
    setRetryAction('voice')
    setIsVoiceLoading(true)

    try {
      const formData = new FormData()
      formData.append(
        'file',
        new File([audioBlob], 'question.webm', { type: audioBlob.type || 'audio/webm' })
      )

      const data = await apiRequest<VoiceToTextResponse>('/api/voice', {
        method: 'POST',
        body: formData,
      })

      setQuestion(data.transcript)
      goToAssistant(data.transcript)
    } catch (error) {
      setError(getFriendlyError(error, t.voiceError))
    } finally {
      setIsVoiceLoading(false)
      setIsListening(false)
    }
  }

  const handleVoicePress = async () => {
    if (isVoiceLoading) {
      return
    }

    if (isListening) {
      stopRecording()
      return
    }

    if (
      typeof window === 'undefined' ||
      !window.MediaRecorder ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError({ message: t.unsupportedVoice, retryable: false })
      setRetryAction(null)
      return
    }

    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        await transcribeVoice(audioBlob)
      }

      recorder.start()
      setIsListening(true)
    } catch {
      setError({ message: t.voiceError, retryable: true })
      setRetryAction('voice')
      setIsListening(false)
    }
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

      setQuestion(data.recommendedQuery)
      goToAssistant(data.recommendedQuery)
    } catch (error) {
      setError(getFriendlyError(error, t.imageError))
    } finally {
      setIsImageLoading(false)
    }
  }

  const handleImagePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setSelectedImageName(file ? file.name : '')
    setLastImageFile(file ?? null)

    if (file) {
      await analyzeImage(file)
    }
  }

  const handleRetry = async () => {
    if (retryAction === 'voice') {
      await handleVoicePress()
      return
    }

    if (retryAction === 'image' && lastImageFile) {
      await analyzeImage(lastImageFile)
    }
  }

  const handleLanguageToggle = () => {
    const nextLanguage: AppLanguage = language === 'EN' ? 'TA' : 'EN'
    setLanguage(nextLanguage)
    persistLanguage(nextLanguage)
  }

  const statusMessage = isVoiceLoading
    ? t.transcribing
    : isImageLoading
      ? t.analyzingImage
      : isListening
        ? t.listening
        : t.ready

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
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
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
              onClick={handleAsk}
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

          <div className="rounded-3xl bg-lime-50 border border-lime-100 p-4">
            <div className="flex items-center justify-center">
              <VoiceButton
                onPress={handleVoicePress}
                isListening={isListening}
                isProcessing={isVoiceLoading}
              />
            </div>
            <p className="mt-4 text-center text-sm font-medium text-gray-700">{statusMessage}</p>
            <p className="mt-1 text-center text-xs text-gray-500">
              {isListening ? t.stopVoice : t.startVoice}
            </p>
          </div>

          <div className="px-2 text-[11px] text-gray-500">
            {selectedImageName ? `${t.imageSelected} ${selectedImageName}` : t.tip}
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p>{error.message}</p>
              {error.retryable && retryAction && (
                <button
                  onClick={handleRetry}
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
