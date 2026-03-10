'use client'

import { Suspense, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Droplets, TrendingDown, TrendingUp } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

import { BottomNavigation } from '@/components/BottomNavigation'
import { Spinner } from '@/components/ui/spinner'
import {
  apiRequest,
  getFriendlyError,
  getStoredLanguage,
  persistLanguage,
  type AppApiError,
  type AppLanguage,
} from '@/lib/api'

interface MarketPrice {
  name: string
  currentPrice: number
  unit: string
  change: number
  trend: string
  demand: string
}

interface MarketResponse {
  prices: MarketPrice[]
  updatedAt: string
}

interface IrrigationAdvisory {
  advisory: string
  reason: string
  priority: 'low' | 'medium' | 'high'
  validUntil: string
}

const uiText = {
  EN: {
    title: 'Market Insights',
    subtitle: 'Live crop prices and irrigation guidance',
    topPrices: 'Crop prices',
    dayChange: '24h change',
    updatedAt: 'Updated',
    irrigationTitle: 'Irrigation advisory',
    retry: 'Retry',
    error: 'We could not load market data right now. Please try again.',
    loading: 'Loading today’s market and irrigation updates...',
    demand: 'Demand',
    validUntil: 'Valid until',
  },
  TA: {
    title: 'சந்தை நிலவரம்',
    subtitle: 'நேரடி பயிர் விலைகள் மற்றும் நீர்ப்பாசன ஆலோசனை',
    topPrices: 'பயிர் விலைகள்',
    dayChange: '24மணி மாற்றம்',
    updatedAt: 'புதுப்பிப்பு நேரம்',
    irrigationTitle: 'நீர்ப்பாசன ஆலோசனை',
    retry: 'மீண்டும் முயற்சி',
    error: 'இப்போது சந்தை தரவை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
    loading: 'இன்றைய சந்தை மற்றும் நீர்ப்பாசன புதுப்பிப்புகளை ஏற்றுகிறோம்...',
    demand: 'தேவை',
    validUntil: 'செல்லுபடியாகும் வரை',
  },
} as const

const crops = 'rice,onion,tomato,cotton,groundnut,sugarcane,banana,chilli'

function MarketPageContent() {
  const searchParams = useSearchParams()
  const [language, setLanguage] = useState<AppLanguage>('EN')
  const [marketData, setMarketData] = useState<MarketResponse | null>(null)
  const [advisory, setAdvisory] = useState<IrrigationAdvisory | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<AppApiError | null>(null)

  useEffect(() => {
    const urlLang = searchParams.get('lang')
    const nextLanguage = urlLang === 'TA' || urlLang === 'EN' ? urlLang : getStoredLanguage()
    setLanguage(nextLanguage)
    persistLanguage(nextLanguage)
  }, [searchParams])

  const t = uiText[language]

  async function loadData() {
    setError(null)
    setIsLoading(true)

    try {
      const [marketResponse, irrigationResponse] = await Promise.all([
        apiRequest<MarketResponse>(`/api/market?region=tamil_nadu&crops=${crops}`),
        apiRequest<IrrigationAdvisory>(
          '/api/irrigation-advisory?lat=13.0827&lon=80.2707'
        ),
      ])

      setMarketData(marketResponse)
      setAdvisory(irrigationResponse)
    } catch (error) {
      setError(getFriendlyError(error, t.error))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const priorityTone = advisory
    ? advisory.priority === 'high'
      ? 'border-red-300 bg-red-50 text-red-700'
      : advisory.priority === 'medium'
        ? 'border-amber-300 bg-amber-50 text-amber-700'
        : 'border-green-300 bg-green-50 text-green-700'
    : 'border-border bg-background text-foreground'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-b from-background via-accent/5 to-background overflow-x-hidden"
    >
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-5 py-4 max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-foreground">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <div className="px-5 pb-24 pt-6 max-w-md mx-auto space-y-6">
        {isLoading && (
          <div className="rounded-3xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <Spinner className="size-5 text-primary" />
              <p className="text-sm font-medium text-foreground">{t.loading}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-red-700">
            <p className="text-sm">{error.message}</p>
            {error.retryable && (
              <button
                onClick={() => void loadData()}
                className="mt-3 inline-flex rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                {t.retry}
              </button>
            )}
          </div>
        )}

        {marketData && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{t.topPrices}</h2>
              <p className="text-xs text-muted-foreground">
                {t.updatedAt}: {new Date(marketData.updatedAt).toLocaleString()}
              </p>
            </div>

            {marketData.prices.map((crop, index) => (
              <motion.div
                key={crop.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-4 border border-primary/20 flex items-center justify-between"
              >
                <div className="flex-1">
                  <p className="font-bold text-foreground">{crop.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    ₹{crop.currentPrice} {crop.unit}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t.demand}: {crop.demand}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 mb-1 justify-end">
                    {crop.change >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                    <p
                      className={`font-bold text-sm ${
                        crop.change >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {crop.change > 0 ? '+' : ''}
                      {crop.change}%
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.dayChange}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {advisory && (
          <div className={`rounded-2xl p-4 border-2 ${priorityTone}`}>
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-background/80 flex items-center justify-center shrink-0">
                <Droplets className="w-5 h-5 text-current" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold">{t.irrigationTitle}</h3>
                <p className="text-sm mt-1">{advisory.advisory}</p>
                <p className="text-xs mt-2 opacity-80">{advisory.reason}</p>
                <p className="text-xs mt-2 font-medium">
                  {t.validUntil}: {new Date(advisory.validUntil).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomNavigation />
    </motion.div>
  )
}

export default function MarketPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <MarketPageContent />
    </Suspense>
  )
}
