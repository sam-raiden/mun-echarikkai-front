'use client';

import { motion } from 'framer-motion';
import { Volume2 } from 'lucide-react';

interface ChatBubbleProps {
  type: 'user' | 'ai';
  message: string;
  weatherInsight?: string;
  marketInsight?: string;
  audioUrl?: string;
  timestamp?: Date;
}

export function ChatBubble({
  type,
  message,
  weatherInsight,
  marketInsight,
  audioUrl,
  timestamp,
}: ChatBubbleProps) {
  const isUser = type === 'user';

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 },
    },
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div className={`max-w-xs ${isUser ? 'lg:max-w-md' : 'lg:max-w-2xl'}`}>
        {/* Message bubble */}
        <div
          className={`rounded-3xl px-5 py-3 ${
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-none'
              : 'bg-muted text-foreground rounded-bl-none border border-border'
          }`}
        >
          <p className="text-sm leading-relaxed">{message}</p>
          {timestamp && (
            <p className="text-xs mt-2 opacity-70">{formatTime(timestamp)}</p>
          )}
        </div>

        {/* AI Response Card - Structured Sections */}
        {!isUser && (weatherInsight || marketInsight || audioUrl) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-3 bg-gradient-to-br from-green-50 to-green-50/50 dark:from-green-950/30 dark:to-green-950/10 border border-green-200 dark:border-green-900/50 rounded-2xl p-4 space-y-3"
          >
            {/* Section 1: Advice */}
            <div>
              <p className="text-xs font-bold text-green-700 dark:text-green-300 mb-2 flex items-center gap-2">
                <span>🌾</span>Advice
              </p>
              <p className="text-sm text-foreground/90 leading-relaxed">{message}</p>
            </div>

            {/* Section 2: Weather Insight */}
            {weatherInsight && (
              <div className="bg-white/50 dark:bg-white/5 rounded-xl p-3">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-300 mb-2 flex items-center gap-1">
                  <span>☁️</span>Weather Insight
                </p>
                <p className="text-sm text-foreground/90">{weatherInsight}</p>
              </div>
            )}

            {/* Section 3: Market Insight */}
            {marketInsight && (
              <div className="bg-white/50 dark:bg-white/5 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-300 mb-2 flex items-center gap-1">
                  <span>📈</span>Market Insight
                </p>
                <p className="text-sm text-foreground/90">{marketInsight}</p>
              </div>
            )}

            {/* Section 4: Audio Response */}
            {audioUrl && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-3 rounded-xl transition-colors"
              >
                <Volume2 className="w-4 h-4" />
                <span className="text-sm">Listen in Tamil</span>
              </motion.button>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
