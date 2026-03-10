'use client'

import { Home, MessageCircle, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { getStoredLanguage } from '@/lib/api'

interface NavItem {
  label: string
  icon: React.ReactNode
  href: string
  id: string
}

const navItems = {
  EN: [
    {
      label: 'Home',
      icon: <Home className="w-6 h-6" />,
      href: '/',
      id: 'home',
    },
    {
      label: 'Assistant',
      icon: <MessageCircle className="w-6 h-6" />,
      href: '/assistant',
      id: 'assistant',
    },
    {
      label: 'Market',
      icon: <TrendingUp className="w-6 h-6" />,
      href: '/market',
      id: 'market',
    },
  ],
  TA: [
    {
      label: 'முகப்பு',
      icon: <Home className="w-6 h-6" />,
      href: '/',
      id: 'home',
    },
    {
      label: 'உதவி',
      icon: <MessageCircle className="w-6 h-6" />,
      href: '/assistant',
      id: 'assistant',
    },
    {
      label: 'சந்தை',
      icon: <TrendingUp className="w-6 h-6" />,
      href: '/market',
      id: 'market',
    },
  ],
} as const

export function BottomNavigation() {
  const router = useRouter()
  const pathname = usePathname()
  const [language, setLanguage] = useState<'EN' | 'TA'>('EN')

  useEffect(() => {
    setLanguage(getStoredLanguage())
  }, [pathname])

  const items = navItems[language]

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    if (href === '/assistant') {
      return pathname === '/assistant' || pathname === '/chat' || pathname === '/missing-info'
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border z-40 max-w-md mx-auto">
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const active = isActive(item.href)
          const target = item.href === '/' ? `/?lang=${language}` : `${item.href}?lang=${language}`

          return (
            <motion.button
              key={item.id}
              onClick={() => router.push(target)}
              whileTap={{ scale: 0.9 }}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-3 px-2 relative"
            >
              <motion.div
                animate={{
                  color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                }}
                className="transition-colors"
              >
                {item.icon}
              </motion.div>
              <span
                className={`text-xs font-medium transition-colors ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {item.label}
              </span>

              {active && (
                <motion.div
                  layoutId="navIndicator"
                  className="absolute bottom-0 w-1 h-1 bg-primary rounded-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                />
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
