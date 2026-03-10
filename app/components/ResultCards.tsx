'use client'

interface Insight {
  type: string
  title: string
  description: string
}

interface ResultCardsProps {
  insights: Insight[]
  titles: {
    diagnosis: string
    weather: string
    treatment: string
    market: string
  }
}

const cardMeta = [
  { key: 'diagnosis', emoji: '🌱', bg: '#E8F5E9', border: '#2ECC71' },
  { key: 'weather', emoji: '🌦️', bg: '#E3F2FD', border: '#3498DB' },
  { key: 'treatment', emoji: '💊', bg: '#FFF3E0', border: '#F39C12' },
  { key: 'market', emoji: '📈', bg: '#F3E5F5', border: '#9B59B6' },
] as const

function clampText(text: string, max = 110) {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

export function ResultCards({ insights, titles }: ResultCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {cardMeta.map((card, index) => {
        const insight = insights[index]
        const title = insight?.title || titles[card.key]
        const description = clampText(insight?.description || '')

        return (
          <div
            key={card.key}
            className="min-h-[120px] rounded-[10px] px-3 py-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
            style={{
              backgroundColor: card.bg,
              borderLeft: `3px solid ${card.border}`,
            }}
          >
            <p className="text-xs font-semibold text-[#222]">
              {card.emoji} {title}
            </p>
            <p className="mt-2 text-xs leading-5 text-[#555] line-clamp-3">
              {description}
            </p>
          </div>
        )
      })}
    </div>
  )
}
