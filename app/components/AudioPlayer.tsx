'use client'

import { useEffect, useRef, useState } from 'react'

interface AudioPlayerProps {
  audioUrl: string | null
  label: string
  autoPlay?: boolean
}

export function AudioPlayer({ audioUrl, label, autoPlay = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!audioUrl || !autoPlay || !audioRef.current) {
      return
    }

    void audioRef.current.play().then(() => setPlaying(true)).catch(() => undefined)
  }, [audioUrl, autoPlay])

  const togglePlay = async () => {
    if (!audioRef.current || !audioUrl) {
      return
    }

    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
      return
    }

    await audioRef.current.play().catch(() => undefined)
    setPlaying(true)
  }

  if (!audioUrl) {
    return null
  }

  return (
    <button
      type="button"
      onClick={() => void togglePlay()}
      className="mt-2 flex w-fit items-center gap-2 rounded-full bg-[#E8F5E9] px-3.5 py-2 text-[13px] text-[#2ECC71]"
    >
      <span>🔊</span>
      <span>{playing ? '⏸ Pause' : `▶ ${label}`}</span>
      <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} />
    </button>
  )
}
