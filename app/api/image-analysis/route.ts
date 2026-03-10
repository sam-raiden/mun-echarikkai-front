import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/image-analysis`, {
      method: 'POST',
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
      body: formData,
      cache: 'no-store',
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json(
      { code: 'PROXY_ERROR', message: 'Backend unavailable', retryable: true },
      { status: 503 }
    )
  }
}
