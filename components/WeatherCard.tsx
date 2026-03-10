'use client';

import { Cloud, CloudRain, Droplets, Wind } from 'lucide-react';
import { motion } from 'framer-motion';

interface WeatherCardProps {
  location: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  uvIndex: number;
}

export function WeatherCard({
  location,
  temperature,
  condition,
  humidity,
  windSpeed,
  uvIndex,
}: WeatherCardProps) {
  const containerVariants = {
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
      className="bg-gradient-to-br from-accent/20 to-accent/10 rounded-3xl p-6 border border-accent/30 shadow-md"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {location}
          </p>
          <h3 className="text-3xl font-bold text-foreground">{temperature}°C</h3>
          <p className="text-sm text-muted-foreground mt-1">{condition}</p>
        </div>
        <div className="text-5xl">
          {condition === 'Rainy' ? '🌧️' : condition === 'Cloudy' ? '☁️' : '⛅'}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-accent/20">
        <div className="flex flex-col items-center">
          <Droplets className="w-5 h-5 text-accent mb-2" />
          <p className="text-xs text-muted-foreground">Humidity</p>
          <p className="text-sm font-semibold text-foreground">{humidity}%</p>
        </div>
        <div className="flex flex-col items-center">
          <Wind className="w-5 h-5 text-accent mb-2" />
          <p className="text-xs text-muted-foreground">Wind</p>
          <p className="text-sm font-semibold text-foreground">{windSpeed} m/s</p>
        </div>
        <div className="flex flex-col items-center">
          <Cloud className="w-5 h-5 text-accent mb-2" />
          <p className="text-xs text-muted-foreground">UV Index</p>
          <p className="text-sm font-semibold text-foreground">{uvIndex}</p>
        </div>
      </div>
    </motion.div>
  );
}
