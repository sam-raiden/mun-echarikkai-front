'use client'

import { AudioPlayer } from '@/app/components/AudioPlayer'
import { LoadingBubble } from '@/app/components/LoadingBubble'
import { MissingInfoForm } from '@/app/components/MissingInfoForm'
import { ResultCards } from '@/app/components/ResultCards'

type RequiredField = 'crop' | 'location' | 'month' | 'irrigation'

interface Insight {
  type: string
  title: string
  description: string
}

interface ResultData {
  summary: string
  insights: Insight[]
  language: string
  audio_url: string | null
}

interface ChatMessageProps {
  role: 'user' | 'assistant'
  text: string
  isLoading?: boolean
  result?: ResultData
  audioUrl?: string | null
  titles: {
    diagnosis: string
    weather: string
    treatment: string
    market: string
  }
  tamilAudioLabel: string
  formProps?: {
    title: string
    listeningText: string
    continueLabel: string
    placeholder: string
    fields: RequiredField[]
    labels: Record<RequiredField, string>
    questions: Record<RequiredField, string>
    values: Record<string, string>
    activeVoiceField: RequiredField | null
    onChange: (field: RequiredField, value: string) => void
    onMic: (field: RequiredField) => void
    onImage: (field: RequiredField) => void
    onSubmit: () => void
  }
}

function trimSummary(summary: string) {
  return summary.length > 180 ? `${summary.slice(0, 177)}...` : summary
}

export function ChatMessage({
  role,
  text,
  isLoading,
  result,
  audioUrl,
  titles,
  tamilAudioLabel,
  formProps,
}: ChatMessageProps) {
  if (role === 'user') {
    return (
      <div className="my-2 ml-auto mr-4 max-w-[80%] rounded-[18px_18px_4px_18px] bg-[#2ECC71] px-4 py-3 text-sm text-white">
        {text}
      </div>
    )
  }

  return (
    <div className="my-2 ml-4 mr-auto max-w-[92%] rounded-[4px_18px_18px_18px] bg-white px-3.5 py-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
      {isLoading ? <LoadingBubble /> : null}

      {!isLoading && formProps ? <MissingInfoForm {...formProps} /> : null}

      {!isLoading && !formProps && result ? (
        <>
          <p className="mb-3 text-sm leading-6 text-[#333]">{trimSummary(result.summary)}</p>
          <ResultCards insights={result.insights} titles={titles} />
          {result.language === 'TA' ? (
            <AudioPlayer audioUrl={audioUrl ?? result.audio_url} label={tamilAudioLabel} autoPlay />
          ) : null}
        </>
      ) : null}

      {!isLoading && !formProps && !result ? (
        <p className="text-sm leading-6 text-[#333]">{text}</p>
      ) : null}
    </div>
  )
}
