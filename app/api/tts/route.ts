import { NextRequest, NextResponse } from 'next/server'

const BACKEND = 'https://chaster-delores-glaucous.ngrok-free.dev'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const response = await fetch(`${BACKEND}/api/v1/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ text: body.text, language: body.language || 'TA' })
    })
    const data = await response.json()
    if (data.audioUrl) {
      data.audioUrl = `${BACKEND}${data.audioUrl}`
    }
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'TTS unavailable' }, { status: 503 })
  }
}
