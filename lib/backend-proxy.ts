import { NextResponse } from 'next/server'

const NGROK_HEADERS = {
  'ngrok-skip-browser-warning': 'true',
}

function getBackendBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL

  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured')
  }

  return baseUrl
}

export async function proxyJsonRequest<TBody>(
  path: string,
  options: {
    method?: 'GET' | 'POST'
    body?: TBody
    searchParams?: URLSearchParams
  } = {}
) {
  try {
    const url = new URL(`${getBackendBaseUrl()}${path}`)
    if (options.searchParams) {
      url.search = options.searchParams.toString()
    }

    const response = await fetch(url.toString(), {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...NGROK_HEADERS,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json(
      {
        code: 'PROXY_ERROR',
        message: 'Backend unavailable',
        retryable: true,
      },
      { status: 503 }
    )
  }
}

export async function proxyFormDataRequest(path: string, formData: FormData) {
  try {
    const response = await fetch(`${getBackendBaseUrl()}${path}`, {
      method: 'POST',
      headers: NGROK_HEADERS,
      body: formData,
      cache: 'no-store',
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json(
      {
        code: 'PROXY_ERROR',
        message: 'Backend unavailable',
        retryable: true,
      },
      { status: 503 }
    )
  }
}
