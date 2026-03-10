import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/weather?${searchParams.toString()}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        cache: 'no-store',
      }
    )
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json(
      { code: 'PROXY_ERROR', message: 'Backend unavailable', retryable: true },
      { status: 503 }
    )
  }
}
