import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 500),
      setTimeout(() => setPhase(3), 1200),
      setTimeout(() => setPhase(4), 1800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const factors = [
    { label: 'Skills Match', score: 95, color: 'bg-primary' },
    { label: 'Title Alignment', score: 88, color: 'bg-blue-400' },
    { label: 'Industry Fit', score: 92, color: 'bg-purple-400' },
    { label: 'Location', score: 100, color: 'bg-green-400' }
  ];

  return (
    <motion.div 
      className="w-full h-full flex items-center justify-between px-[10vw]"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ x: '-100vw', opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="w-[45vw]">
        <motion.h2 
          className="text-[4.5vw] font-bold leading-[1.1] mb-[2vw]"
          initial={{ opacity: 0, x: -50 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
          transition={{ duration: 0.6 }}
        >
          Match with <br/><span className="text-primary">Explainable AI</span>
        </motion.h2>
        <motion.p
          className="text-[1.8vw] text-white/60 leading-relaxed"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
        >
          Weighted scoring across skills, compensation, and recency. No black boxes.
        </motion.p>
      </div>

      <div className="w-[35vw] flex flex-col gap-[2vw]">
        {factors.map((factor, i) => (
          <motion.div 
            key={i}
            className="bg-bg-light/80 backdrop-blur-md p-[1.5vw] rounded-xl border border-white/5"
            initial={{ opacity: 0, x: 50 }}
            animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
            transition={{ duration: 0.5, delay: phase >= 3 ? i * 0.15 : 0 }}
          >
            <div className="flex justify-between items-end mb-[1vw]">
              <span className="font-mono text-[1.2vw] text-white/80">{factor.label}</span>
              <span className="font-mono text-[1.5vw] font-bold text-white">{factor.score}%</span>
            </div>
            <div className="w-full h-[0.5vw] bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                className={`h-full ${factor.color}`}
                initial={{ width: 0 }}
                animate={phase >= 4 ? { width: `${factor.score}%` } : { width: 0 }}
                transition={{ duration: 1, ease: 'easeOut', delay: i * 0.1 }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
