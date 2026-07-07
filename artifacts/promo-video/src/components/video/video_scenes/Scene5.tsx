import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="w-full h-full flex flex-col items-center justify-center text-center"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <motion.div
        className="w-[8vw] h-[8vw] bg-primary rounded-2xl rotate-45 mb-[4vw] flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.5)]"
        initial={{ scale: 0, rotate: 0 }}
        animate={phase >= 1 ? { scale: 1, rotate: 45 } : { scale: 0, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >
        <div className="w-[4vw] h-[4vw] bg-bg-dark rounded-xl -rotate-45" />
      </motion.div>

      <motion.h1 
        className="text-[6vw] font-black tracking-tight mb-[1vw]"
        initial={{ y: 20, opacity: 0 }}
        animate={phase >= 2 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
      >
        VacancyMatch AI
      </motion.h1>

      <motion.div
        className="flex gap-[2vw] mt-[3vw] text-[1.8vw] text-white/60 font-mono"
        initial={{ opacity: 0 }}
        animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
      >
        <span>Solo £79</span>
        <span>•</span>
        <span>Team £149</span>
        <span>•</span>
        <span>Pro Agency £229</span>
      </motion.div>

      <motion.div 
        className="mt-[4vw] px-[3vw] py-[1.5vw] bg-primary text-bg-dark font-bold text-[2vw] rounded-full"
        initial={{ scale: 0 }}
        animate={phase >= 3 ? { scale: 1 } : { scale: 0 }}
        transition={{ type: 'spring', delay: 0.2 }}
      >
        Start 7-Day Free Trial
      </motion.div>
    </motion.div>
  );
}
