export type QueryInputType = 'text' | 'voice' | 'image'

export interface FarmContext {
  crop: string | null
  location: string | null
  month: string | null
  irrigation: string | null
  land_size_acres: number
  market_dependency: boolean
}

export const REQUIRED_CONTEXT_FIELDS = ['crop', 'location', 'month', 'irrigation'] as const

export type RequiredContextField = (typeof REQUIRED_CONTEXT_FIELDS)[number]

export function createDefaultContext(
  overrides: Partial<FarmContext> = {}
): FarmContext {
  return {
    crop: null,
    location: null,
    month: null,
    irrigation: null,
    land_size_acres: 2,
    market_dependency: true,
    ...overrides,
  }
}

export function filterRequiredMissingFields(fields: string[]) {
  return fields.filter((field): field is RequiredContextField =>
    REQUIRED_CONTEXT_FIELDS.includes(field as RequiredContextField)
  )
}
