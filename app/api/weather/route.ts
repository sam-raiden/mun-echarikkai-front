import { NextRequest, NextResponse } from 'next/server'
const BACKEND =
  process.env.NEXT_PUBLIC_API_URL || 'https://chaster-delores-glaucous.ngrok-free.dev'
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = searchParams.get('lat') || '9.9252'
    const lon = searchParams.get('lon') || '78.1198'
    const days = searchParams.get('days') || '14'
    const response = await fetch(
      `${BACKEND}/api/v1/weather?lat=${lat}&lon=${lon}&days=${days}`,
      { headers: { 'ngrok-skip-browser-warning': 'true' } }
    )
    const data = await response.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Weather unavailable' }, { status: 503 })
  }
}
