import { NextRequest } from 'next/server'

import { proxyJsonRequest } from '@/lib/backend-proxy'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  return proxyJsonRequest('/api/v1/weather', {
    searchParams,
  })
}
