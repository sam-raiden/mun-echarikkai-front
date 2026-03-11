import { NextRequest } from 'next/server'

import { proxyJsonRequest } from '@/lib/backend-proxy'

export async function POST(request: NextRequest) {
  const body = await request.json()
  return proxyJsonRequest('/api/v1/tts', {
    method: 'POST',
    body,
  })
}
