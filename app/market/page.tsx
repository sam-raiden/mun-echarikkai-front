'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BottomNavigation } from '@/components/BottomNavigation';
import { TrendingUp, TrendingDown, Droplets } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

const uiText = {
  EN: {
    title: 'Market Insights',
    subtitle: 'Top crop prices and alerts',
    topPrices: 'Top Crop Prices',
    dayChange: '24h change',
    irrigationTitle: 'Irrigation Alert',
    irrigationMsg:
      'Do not irrigate Monday. High rainfall expected in your location.',
  },
  TA: {
    title: 'சந்தை நிலவரம்',
    subtitle: 'முன்னணி பயிர் விலைகள் மற்றும் அறிவிப்புகள்',
    topPrices: 'முக்கிய பயிர் விலைகள்',
    dayChange: '24மணி மாற்றம்',
    irrigationTitle: 'நீர்ப்பாசன எச்சரிக்கை',
    irrigationMsg:
      'திங்கட்கிழமை நீர்ப்பாசனம் செய்ய வேண்டாம். உங்கள் பகுதியில் அதிக மழை எதிர்பார்க்கப்படுகிறது.',
  },
} as const;

const topCrops = [
  { name: 'Rice', price: 45.5, unit: '/kg', trend: 'up', change: 2.3 },
  { name: 'Wheat', price: 38.2, unit: '/kg', trend: 'down', change: -1.5 },
  { name: 'Cotton', price: 62.8, unit: '/kg', trend: 'up', change: 0.2 },
  { name: 'Sugarcane', price: 52.1, unit: '/kg', trend: 'up', change: 3.1 },
  { name: 'Maize', price: 29.4, unit: '/kg', trend: 'down', change: -0.6 },
] as const;

export default function MarketPage() {
  const searchParams = useSearchParams();
  const [language, setLanguage] = useState<'EN' | 'TA'>('EN');
  const t = uiText[language];

  useEffect(() => {
    const urlLang = searchParams.get('lang');
    const storedLang =
      typeof window !== 'undefined' ? localStorage.getItem('appLang') : null;
    const nextLang =
      urlLang === 'TA' || urlLang === 'EN'
        ? urlLang
        : storedLang === 'TA' || storedLang === 'EN'
          ? storedLang
          : 'EN';
    setLanguage(nextLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('appLang', nextLang);
    }
  }, [searchParams]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-gradient-to-b from-background via-accent/5 to-background overflow-x-hidden"
    >
      <motion.div
        variants={itemVariants}
        className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-5 py-4 max-w-md mx-auto"
      >
        <h1 className="text-2xl font-bold text-foreground">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </motion.div>

      <div className="px-5 pb-24 pt-6 max-w-md mx-auto space-y-6">
        <motion.div variants={itemVariants} className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">{t.topPrices}</h2>
          {topCrops.map((crop, index) => (
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
                  {'\u20B9'}{crop.price} {crop.unit}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 mb-1">
                  {crop.trend === 'up' ? (
                    <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                  )}
                  <p
                    className={`font-bold text-sm ${
                      crop.trend === 'up'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
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
        </motion.div>

        <motion.div variants={itemVariants}>
          <div className="rounded-2xl p-4 border-2 bg-primary/10 border-primary/30">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-background/80 flex items-center justify-center shrink-0">
                <Droplets className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-primary">{t.irrigationTitle}</h3>
                <p className="text-sm mt-1 text-muted-foreground">
                  {t.irrigationMsg}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <BottomNavigation />
    </motion.div>
  );
}
