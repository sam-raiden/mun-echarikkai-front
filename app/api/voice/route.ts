import { NextRequest, NextResponse } from 'next/server'
const BACKEND =
  process.env.NEXT_PUBLIC_API_URL || 'https://chaster-delores-glaucous.ngrok-free.dev'
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const response = await fetch(`${BACKEND}/api/v1/voice-to-text`, {
      method: 'POST',
      headers: { 'ngrok-skip-browser-warning': 'true' },
      body: formData,
    })
    const data = await response.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Voice unavailable' }, { status: 503 })
  }
}
