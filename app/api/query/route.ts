import { NextRequest, NextResponse } from 'next/server'

const BACKEND =
  process.env.NEXT_PUBLIC_API_URL || 'https://chaster-delores-glaucous.ngrok-free.dev'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const response = await fetch(`${BACKEND}/api/v1/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({
        query: body.query || '',
        language: body.language || 'EN',
        context: {
          crop: body.context?.crop || '',
          location: body.context?.location || '',
          month: body.context?.month || '',
          irrigation: body.context?.irrigation || '',
          land_size_acres: body.context?.land_size_acres || 2,
          market_dependency: body.context?.market_dependency ?? true,
        },
      }),
    })
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Query error:', error)
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 })
  }
}
