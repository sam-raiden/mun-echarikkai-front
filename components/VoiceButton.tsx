'use client'

import { Mic } from 'lucide-react'
import { motion } from 'framer-motion'

interface VoiceButtonProps {
  onPress?: () => void
  isListening?: boolean
  isProcessing?: boolean
}

export function VoiceButton({
  onPress,
  isListening = false,
  isProcessing = false,
}: VoiceButtonProps) {
  const waveVariants = {
    initial: { scale: 1, opacity: 0.5 },
    animate: {
      scale: [1, 1.2, 1.4, 1.6],
      opacity: [0.8, 0.6, 0.4, 0],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeOut' as const,
      },
    },
  }

  const isActive = isListening || isProcessing

  return (
    <div className="relative flex items-center justify-center">
      {isActive && (
        <>
          <motion.div
            variants={waveVariants}
            initial="initial"
            animate="animate"
            className="absolute w-32 h-32 rounded-full border-2 border-primary/50"
          />
          <motion.div
            variants={waveVariants}
            initial="initial"
            animate="animate"
            transition={{ delay: 0.3, duration: 1.5, repeat: Infinity }}
            className="absolute w-32 h-32 rounded-full border-2 border-primary/30"
          />
        </>
      )}

      <motion.button
        type="button"
        onClick={onPress}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        disabled={isProcessing}
        className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center font-semibold text-lg transition-all shadow-lg disabled:cursor-not-allowed ${
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'bg-gradient-to-br from-primary/80 to-primary/60 text-primary-foreground hover:from-primary hover:to-primary/70'
        } ${isProcessing ? 'opacity-75' : ''}`}
      >
        <motion.div
          animate={isActive ? { rotate: [0, 360] } : {}}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear' as const,
          }}
        >
          <Mic className="w-10 h-10" />
        </motion.div>
      </motion.button>
    </div>
  )
}
