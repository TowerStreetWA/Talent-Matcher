import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 600),
      setTimeout(() => setPhase(3), 1400),
      setTimeout(() => setPhase(4), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const badges = ['Insurance', 'Banking', 'Pensions', 'Asset Mgmt'];

  return (
    <motion.div 
      className="w-full h-full flex flex-col items-center justify-center text-center relative"
      initial={{ y: '50vh', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ scale: 1.5, opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="text-primary font-mono text-[1.5vw] mb-[2vw] tracking-widest uppercase"
        initial={{ opacity: 0, letterSpacing: '0vw' }}
        animate={phase >= 1 ? { opacity: 1, letterSpacing: '0.2vw' } : { opacity: 0, letterSpacing: '0vw' }}
        transition={{ duration: 1 }}
      >
        Employer-First Discovery
      </motion.div>

      <motion.h2 
        className="text-[5vw] font-bold leading-tight max-w-[70vw]"
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6 }}
      >
        Sourcing directly from company career sites.
      </motion.h2>

      <motion.div 
        className="mt-[4vw] flex gap-[1.5vw] flex-wrap justify-center max-w-[60vw]"
        initial={{ opacity: 0 }}
        animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
      >
        {badges.map((badge, i) => (
          <motion.span 
            key={i}
            className="px-[2vw] py-[1vw] bg-white/5 border border-primary/30 rounded-full text-[1.8vw] font-medium"
            initial={{ scale: 0 }}
            animate={phase >= 3 ? { scale: 1 } : { scale: 0 }}
            transition={{ type: 'spring', delay: phase >= 3 ? i * 0.1 : 0 }}
          >
            {badge}
          </motion.span>
        ))}
      </motion.div>

      {/* Connection Lines Background */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20 z-[-1]">
        {phase >= 4 && (
          <motion.path
            d="M 20vw 80vh Q 40vw 50vh 50vw 50vh T 80vw 20vh"
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
          />
        )}
      </svg>
    </motion.div>
  );
}
