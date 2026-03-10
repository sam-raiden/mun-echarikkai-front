'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [showScreen, setShowScreen] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowScreen(false);
      onComplete();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!showScreen) return null;

  const containerVariants = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.5 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.6 },
    },
  };

  const textVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed inset-0 bg-gradient-to-b from-primary/20 via-background to-primary/10 flex flex-col items-center justify-center z-50 max-w-md mx-auto"
    >
      {/* Logo/Icon */}
      <motion.div variants={itemVariants} className="mb-8">
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' as const }}
          className="text-7xl"
        >
          🌾
        </motion.div>
      </motion.div>

      {/* Text Content */}
      <motion.h1
        variants={textVariants}
        className="text-3xl font-bold text-foreground mb-3 text-center text-balance"
      >
        AgriAI
      </motion.h1>

      <motion.p
        variants={textVariants}
        className="text-muted-foreground text-center mb-8 text-balance"
      >
        Your Smart Farm Assistant
      </motion.p>

      {/* Loading Animation */}
      <motion.div
        variants={itemVariants}
        className="flex items-center justify-center gap-2 mt-8"
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-primary"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </motion.div>

      {/* Tagline */}
      <motion.p
        variants={textVariants}
        className="absolute bottom-8 text-xs text-muted-foreground text-center px-4"
      >
        AI-powered insights for healthier crops and better harvests
      </motion.p>
    </motion.div>
  );
}
