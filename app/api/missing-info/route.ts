import { NextRequest } from 'next/server'

import { proxyJsonRequest } from '@/lib/backend-proxy'

export async function POST(request: NextRequest) {
  const body = await request.json()
  return proxyJsonRequest('/api/v1/missing-info', {
    method: 'POST',
    body,
  })
}
