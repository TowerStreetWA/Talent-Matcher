import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 600),
      setTimeout(() => setPhase(3), 1500),
      setTimeout(() => setPhase(4), 3200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="w-full h-full flex flex-col justify-center px-[10vw]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 0.6 }}
    >
      <div className="relative">
        <motion.div
          className="absolute -left-[4vw] top-[1vw] w-[2vw] h-[2vw] bg-primary rounded-sm"
          initial={{ scale: 0, rotate: -45 }}
          animate={phase >= 1 ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -45 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />
        
        <h1 className="text-[6vw] leading-[1.1] font-extrabold tracking-tight">
          <motion.div className="overflow-hidden">
            <motion.div
              initial={{ y: '100%' }}
              animate={phase >= 1 ? { y: 0 } : { y: '100%' }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              Stop parsing
            </motion.div>
          </motion.div>
          <motion.div className="overflow-hidden text-primary">
            <motion.div
              initial={{ y: '100%' }}
              animate={phase >= 2 ? { y: 0 } : { y: '100%' }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              CVs manually.
            </motion.div>
          </motion.div>
        </h1>

        <motion.p 
          className="mt-[4vw] text-[2.5vw] text-white/60 font-medium max-w-[50vw]"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          Upload a candidate. Let AI extract their profile instantly.
        </motion.p>
      </div>

      {/* Floating CV elements */}
      <motion.div 
        className="absolute right-[10vw] top-[20vh] w-[30vw] h-[40vh] bg-bg-light/50 backdrop-blur-xl border border-white/10 rounded-2xl p-[2vw] shadow-2xl"
        initial={{ x: '50vw', rotate: 10, opacity: 0 }}
        animate={phase >= 2 ? { x: 0, rotate: 0, opacity: 1 } : { x: '50vw', rotate: 10, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      >
        <motion.div className="w-[8vw] h-[8vw] rounded-full bg-primary/20 mb-[2vw]" />
        <motion.div className="w-full h-[2vw] bg-white/10 rounded mb-[1vw]" />
        <motion.div className="w-[80%] h-[2vw] bg-white/10 rounded mb-[1vw]" />
        <motion.div className="w-[60%] h-[2vw] bg-white/10 rounded" />
        
        {/* Scanning effect */}
        <motion.div 
          className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/20 to-transparent pointer-events-none"
          initial={{ top: '-100%' }}
          animate={phase >= 3 ? { top: '100%' } : { top: '-100%' }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
      </motion.div>
    </motion.div>
  );
}
