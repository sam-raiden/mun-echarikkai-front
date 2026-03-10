import { NextRequest } from 'next/server'

import { proxyFormDataRequest } from '@/lib/backend-proxy'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  return proxyFormDataRequest('/api/v1/image-analysis', formData)
}
