import { NextRequest, NextResponse } from 'next/server'

const backendUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://chaster-delores-glaucous.ngrok-free.dev'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const response = await fetch(`${backendUrl}/api/v1/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(
      {
        audioUrl: data.audioUrl,
      },
      { status: response.status }
    )
  } catch {
    return NextResponse.json(
      {
        message: 'Sorry, could not connect to server. Please try again.',
        retryable: true,
      },
      { status: 503 }
    )
  }
}
