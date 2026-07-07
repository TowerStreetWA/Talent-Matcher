import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1200),
      setTimeout(() => setPhase(4), 1600),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="w-full h-full flex flex-col justify-center px-[10vw]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ y: '-50vh', opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <motion.h2 
        className="text-[4.5vw] font-bold mb-[4vw]"
        initial={{ x: 50, opacity: 0 }}
        animate={phase >= 1 ? { x: 0, opacity: 1 } : { x: 50, opacity: 0 }}
      >
        Built for Teams.
      </motion.h2>

      <div className="flex gap-[3vw]">
        {['Shortlist', 'Push to CRM', 'Alert Rules'].map((action, i) => (
          <motion.div
            key={i}
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-[3vw] relative overflow-hidden"
            initial={{ y: 50, opacity: 0 }}
            animate={phase >= (2 + i) ? { y: 0, opacity: 1 } : { y: 50, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            <div className="w-[3vw] h-[3vw] bg-primary/20 rounded-lg mb-[2vw]" />
            <div className="text-[2vw] font-bold text-white mb-[1vw]">{action}</div>
            <div className="h-[0.5vw] w-1/3 bg-white/20 rounded-full" />
            
            <motion.div 
              className="absolute -right-[10%] -bottom-[10%] w-[10vw] h-[10vw] bg-primary/20 blur-2xl rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
