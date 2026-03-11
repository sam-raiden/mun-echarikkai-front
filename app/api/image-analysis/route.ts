import { NextRequest, NextResponse } from 'next/server'

const backendUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://chaster-delores-glaucous.ngrok-free.dev'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const response = await fetch(`${backendUrl}/api/v1/image-analysis`, {
      method: 'POST',
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
      body: formData,
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
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
