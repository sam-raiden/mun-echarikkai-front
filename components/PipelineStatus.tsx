'use client';

import { motion } from 'framer-motion';

interface PipelineStep {
  step: string;
  icon: string;
  status: 'complete' | 'in-progress' | 'pending';
}

interface PipelineStatusProps {
  steps: PipelineStep[];
}

export function PipelineStatus({ steps }: PipelineStatusProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const stepVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 },
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-green-500/20 border-green-500/50 text-green-600';
      case 'in-progress':
        return 'bg-primary/20 border-primary/50 text-primary';
      case 'pending':
        return 'bg-gray-200/20 border-gray-300/50 text-gray-500';
      default:
        return '';
    }
  };

  const getStatusAnimation = (status: string) => {
    if (status === 'in-progress') {
      return {
        scale: [1, 1.05, 1],
        transition: { duration: 1, repeat: Infinity },
      };
    }
    return {};
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="bg-gradient-to-r from-background to-muted/20 rounded-2xl p-6 border border-border"
    >
      <p className="text-sm font-semibold text-muted-foreground mb-4">
        Processing Pipeline
      </p>
      <div className="flex items-center justify-between gap-2">
        {steps.map((step, index) => (
          <motion.div key={index} variants={stepVariants} className="flex-1">
            <motion.div
              animate={getStatusAnimation(step.status)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${getStatusColor(
                step.status
              )}`}
            >
              <span className="text-2xl">{step.icon}</span>
              <span className="text-xs font-medium text-center leading-tight">
                {step.step}
              </span>

              {/* Status indicator */}
              {step.status === 'complete' && (
                <div className="w-2 h-2 bg-green-500 rounded-full mt-1" />
              )}
              {step.status === 'in-progress' && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' as const }}
                  className="w-2 h-2 border-2 border-primary border-t-transparent rounded-full mt-1"
                />
              )}
            </motion.div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={`h-1 mt-2 rounded-full ${
                  steps[index].status === 'complete'
                    ? 'bg-lime-600'
                    : 'bg-gray-300'
                }`}
              />
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
