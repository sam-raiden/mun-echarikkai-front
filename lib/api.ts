export type AppLanguage = 'EN' | 'TA'

export interface AppApiError {
  message: string
  retryable?: boolean
}

const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.'

export async function apiRequest<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init)
  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await response.json() : null

  if (!response.ok) {
    const errorPayload = payload as
      | { message?: string; retryable?: boolean }
      | null
      | undefined

    throw {
      message: errorPayload?.message ?? DEFAULT_ERROR_MESSAGE,
      retryable: errorPayload?.retryable ?? response.status >= 500,
    } satisfies AppApiError
  }

  return payload as T
}

export function getStoredLanguage(): AppLanguage {
  if (typeof window === 'undefined') {
    return 'EN'
  }

  const stored = window.localStorage.getItem('appLang')
  return stored === 'TA' ? 'TA' : 'EN'
}

export function persistLanguage(language: AppLanguage) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('appLang', language)
  }
}

export function getFriendlyError(error: unknown, fallback: string): AppApiError {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message =
      typeof error.message === 'string' && error.message.trim()
        ? error.message
        : fallback

    return {
      message,
      retryable:
        'retryable' in error && typeof error.retryable === 'boolean'
          ? error.retryable
          : true,
    }
  }

  return {
    message: fallback,
    retryable: true,
  }
}
