'use client'

import { motion } from 'framer-motion'

interface FarmerMascotProps {
  state?: 'idle' | 'listening' | 'thinking' | 'speaking'
  size?: 'small' | 'large'
}

export function FarmerMascot({ state = 'idle', size = 'large' }: FarmerMascotProps) {
  const sizeClasses = size === 'large' ? 'w-28 h-28' : 'w-20 h-20'

  const bodyAnimation = {
    idle: { y: [0, -4, 0] },
    listening: { y: [-3, 3, -3] },
    thinking: { rotate: [-2, 2, -2] },
    speaking: { y: [-4, 4, -4] },
  }

  return (
    <motion.div
      className={`${sizeClasses} relative flex items-center justify-center bg-transparent`}
      animate={state}
      variants={bodyAnimation}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' as const }}
    >
      {/* Head */}
      <div className="relative w-20 h-20 rounded-full bg-muted flex items-center justify-center border border-border">

        {/* Eyes */}
        <div className="absolute flex gap-4" style={{ top: '32%' }}>
          <div className="w-3 h-3 bg-foreground rounded-full" />
          <div className="w-3 h-3 bg-foreground rounded-full" />
        </div>

        {/* Mouth */}
        <motion.div
          className="absolute w-6 h-1.5 bg-foreground rounded-full"
          style={{ bottom: '28%' }}
          animate={{
            scaleX: state === 'speaking' ? [1, 1.3, 1] : 1,
          }}
          transition={{ duration: 0.4, repeat: Infinity }}
        />

        {/* Mustache */}
        <div
          className="absolute w-8 h-1 bg-foreground rounded-full opacity-70"
          style={{ bottom: '34%' }}
        />
      </div>

      {/* Shirt / shoulders */}
      <div className="absolute top-[70%] w-16 h-8 bg-primary rounded-t-xl border border-border" />

      {/* Thinking indicator */}
      {state === 'thinking' && (
        <motion.div
          className="absolute -top-4 right-0 flex gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="w-2 h-2 bg-foreground rounded-full"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
          <motion.div
            className="w-2 h-2 bg-foreground rounded-full"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.8, delay: 0.2, repeat: Infinity }}
          />
        </motion.div>
      )}
    </motion.div>
  )
}
