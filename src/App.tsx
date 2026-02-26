/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Rocket as RocketIcon, Shield, Target, Trophy, XCircle, RefreshCw, Languages } from 'lucide-react';
import { GameState, Point, Rocket, Missile, Explosion, City, Turret, COLORS } from './types';

const WIN_SCORE = 1000;
const INITIAL_CITIES = 6;
const TURRET_CONFIG = [
  { x: 0.1, missiles: 20 },
  { x: 0.5, missiles: 40 },
  { x: 0.9, missiles: 20 },
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  
  // Game Entities Refs to avoid re-renders
  const rocketsRef = useRef<Rocket[]>([]);
  const missilesRef = useRef<Missile[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const citiesRef = useRef<City[]>([]);
  const turretsRef = useRef<Turret[]>([]);
  const frameRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const shakeRef = useRef(0);

  const t = {
    zh: {
      title: 'Max新星防御',
      start: '开始游戏',
      win: '恭喜！你成功保卫了城市',
      lose: '防线崩溃，城市已被摧毁',
      score: '得分',
      missiles: '拦截弹',
      restart: '再玩一次',
      instructions: '点击屏幕发射拦截导弹，摧毁落下的敌方火箭。',
      target: '目标: 1000 分',
    },
    en: {
      title: 'Max Nova Defense',
      start: 'Start Game',
      win: 'Victory! Cities Protected',
      lose: 'Defenses Breached, Cities Destroyed',
      score: 'Score',
      missiles: 'Missiles',
      restart: 'Play Again',
      instructions: 'Click to fire interceptors and destroy falling rockets.',
      target: 'Target: 1000 Points',
    }
  }[lang];

  const triggerShake = (intensity: number) => {
    shakeRef.current = Math.min(shakeRef.current + intensity, 15);
  };

  const initGame = useCallback(() => {
    const width = canvasRef.current?.width || 800;
    const height = canvasRef.current?.height || 600;

    // Init Cities
    const cities: City[] = [];
    const citySpacing = width / (INITIAL_CITIES + 4);
    for (let i = 0; i < INITIAL_CITIES; i++) {
      const x = (i + 2.5) * citySpacing;
      cities.push({ id: `city-${i}`, x, y: height, active: true });
    }
    citiesRef.current = cities;

    // Init Turrets
    const turrets: Turret[] = TURRET_CONFIG.map((conf, i) => ({
      id: `turret-${i}`,
      x: conf.x * width,
      y: height,
      active: true,
      missiles: conf.missiles,
      maxMissiles: conf.missiles,
    }));
    turretsRef.current = turrets;

    rocketsRef.current = [];
    missilesRef.current = [];
    explosionsRef.current = [];
    shakeRef.current = 0;
    setScore(0);
    setGameState('PLAYING');
  }, []);

  const spawnRocket = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const startX = Math.random() * canvas.width;
    const targetX = Math.random() * canvas.width;
    const targetY = canvas.height;

    rocketsRef.current.push({
      id: Math.random().toString(36),
      x: startX,
      y: 0,
      targetX,
      targetY,
      speed: 0.001 + Math.random() * 0.001 + (score / 50000), // Speed up as score increases
      progress: 0,
    });
  }, [score]);

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Find nearest active turret with missiles
    let bestTurret: Turret | null = null;
    let minDist = Infinity;

    turretsRef.current.forEach(t => {
      if (t.active && t.missiles > 0) {
        const d = Math.abs(t.x - x);
        if (d < minDist) {
          minDist = d;
          bestTurret = t;
        }
      }
    });

    if (bestTurret) {
      (bestTurret as Turret).missiles--;
      missilesRef.current.push({
        id: Math.random().toString(36),
        startX: (bestTurret as Turret).x,
        startY: (bestTurret as Turret).y,
        x: (bestTurret as Turret).x,
        y: (bestTurret as Turret).y,
        targetX: x,
        targetY: y,
        speed: 0.02,
        progress: 0,
      });
    }
  };

  const update = useCallback(() => {
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Handle Screen Shake
    if (shakeRef.current > 0) {
      const sx = (Math.random() - 0.5) * shakeRef.current * 2;
      const sy = (Math.random() - 0.5) * shakeRef.current * 2;
      canvas.style.transform = `translate(${sx}px, ${sy}px)`;
      shakeRef.current *= 0.9; // Decay
      if (shakeRef.current < 0.1) {
        shakeRef.current = 0;
        canvas.style.transform = '';
      }
    }

    // Clear
    ctx.fillStyle = COLORS.BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Spawn Rockets
    const now = Date.now();
    if (now - lastSpawnRef.current > Math.max(500, 2000 - score)) {
      spawnRocket();
      lastSpawnRef.current = now;
    }

    // Update & Draw Rockets
    rocketsRef.current = rocketsRef.current.filter(r => {
      r.progress += r.speed;
      r.x = r.x + (r.targetX - r.x) * r.speed / (1 - r.progress + r.speed);
      r.y = r.y + (r.targetY - r.y) * r.speed / (1 - r.progress + r.speed);

      // Draw trail
      ctx.beginPath();
      ctx.strokeStyle = COLORS.ENEMY;
      ctx.lineWidth = 1;
      ctx.moveTo(r.x - (r.targetX - r.x) * 0.05, r.y - (r.targetY - r.y) * 0.05);
      ctx.lineTo(r.x, r.y);
      ctx.stroke();

      // Check impact
      if (r.progress >= 1) {
        triggerShake(8);
        // Create impact explosion
        explosionsRef.current.push({
          id: `impact-${Math.random()}`,
          x: r.x,
          y: r.y,
          radius: 0,
          maxRadius: 30,
          growing: true,
        });

        // Damage cities or turrets
        citiesRef.current.forEach(c => {
          if (c.active && Math.abs(c.x - r.x) < 30) c.active = false;
        });
        turretsRef.current.forEach(t => {
          if (t.active && Math.abs(t.x - r.x) < 30) t.active = false;
        });

        return false;
      }
      return true;
    });

    // Update & Draw Missiles
    missilesRef.current = missilesRef.current.filter(m => {
      m.progress += m.speed;
      m.x = m.startX + (m.targetX - m.startX) * m.progress;
      m.y = m.startY + (m.targetY - m.startY) * m.progress;

      ctx.beginPath();
      ctx.strokeStyle = COLORS.PLAYER;
      ctx.lineWidth = 1;
      ctx.moveTo(m.startX, m.startY);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();

      // Draw Target X
      ctx.beginPath();
      ctx.strokeStyle = COLORS.PLAYER;
      ctx.moveTo(m.targetX - 3, m.targetY - 3);
      ctx.lineTo(m.targetX + 3, m.targetY + 3);
      ctx.moveTo(m.targetX + 3, m.targetY - 3);
      ctx.lineTo(m.targetX - 3, m.targetY + 3);
      ctx.stroke();

      if (m.progress >= 1) {
        explosionsRef.current.push({
          id: `exp-${Math.random()}`,
          x: m.targetX,
          y: m.targetY,
          radius: 0,
          maxRadius: 40,
          growing: true,
        });
        return false;
      }
      return true;
    });

    // Update & Draw Explosions
    explosionsRef.current = explosionsRef.current.filter(e => {
      if (e.growing) {
        e.radius += 1.5;
        if (e.radius >= e.maxRadius) e.growing = false;
      } else {
        e.radius -= 0.8;
      }

      if (e.radius <= 0) return false;

      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${e.radius / e.maxRadius})`;
      ctx.fill();

      // Check collision with rockets
      rocketsRef.current = rocketsRef.current.filter(r => {
        const dist = Math.hypot(r.x - e.x, r.y - e.y);
        if (dist < e.radius) {
          triggerShake(2);
          setScore(s => {
            const newScore = s + 20;
            if (newScore >= WIN_SCORE) setGameState('WON');
            return newScore;
          });
          return false;
        }
        return true;
      });

      return true;
    });

    // Draw Ground
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, canvas.height - 10, canvas.width, 10);

    // Draw Cities
    citiesRef.current.forEach(c => {
      if (c.active) {
        ctx.fillStyle = COLORS.CITY;
        ctx.fillRect(c.x - 12, c.y - 20, 24, 20);
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(c.x - 8, c.y - 15, 4, 4);
        ctx.fillRect(c.x + 4, c.y - 15, 4, 4);
      }
    });

    // Draw Turrets
    turretsRef.current.forEach(t => {
      if (t.active) {
        ctx.fillStyle = COLORS.TURRET;
        ctx.beginPath();
        ctx.arc(t.x, t.y - 5, 20, Math.PI, 0);
        ctx.fill();
        // Barrel
        ctx.fillRect(t.x - 4, t.y - 30, 8, 10);
      }
    });

    // Check Game Over
    if (turretsRef.current.every(t => !t.active)) {
      setGameState('LOST');
    }

    frameRef.current = requestAnimationFrame(update);
  }, [gameState, score, spawnRocket]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        // Use window innerHeight to be absolutely sure about the viewport
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      frameRef.current = requestAnimationFrame(update);
    } else {
      cancelAnimationFrame(frameRef.current);
    }
    return () => cancelAnimationFrame(frameRef.current);
  }, [gameState, update]);

  return (
    <div className="game-container font-display" ref={containerRef}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleCanvasClick}
        onTouchStart={handleCanvasClick}
        className="w-full h-full"
      />

      {/* HUD */}
      <div className="absolute top-24 left-6 right-6 flex justify-between items-start pointer-events-none">
        <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl">
          <div className="text-xs uppercase tracking-widest text-zinc-400 mb-1">{t.score}</div>
          <div className="text-3xl font-bold tabular-nums text-emerald-400">{score}</div>
          <div className="text-[10px] text-zinc-500 mt-1 uppercase tracking-tighter">{t.target}</div>
        </div>

        <div className="flex gap-4">
          {turretsRef.current.map((turret, i) => (
            <div key={i} className={`bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-xl flex flex-col items-center min-w-[60px] transition-opacity ${!turret.active ? 'opacity-30' : 'opacity-100'}`}>
              <div className="text-[10px] uppercase tracking-tighter text-zinc-400 mb-1">T{i+1}</div>
              <div className={`text-xl font-bold ${turret.missiles < 5 ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>
                {turret.missiles}
              </div>
            </div>
          ))}
        </div>

        <button 
          onClick={() => setLang(l => l === 'zh' ? 'en' : 'zh')}
          className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-xl hover:bg-white/10 transition-colors"
        >
          <Languages className="w-5 h-5" />
        </button>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {gameState !== 'PLAYING' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 z-50 text-center pt-48"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md w-full"
            >
              {gameState === 'START' && (
                <>
                  <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-emerald-500/30">
                    <RocketIcon className="w-10 h-10 text-emerald-400" />
                  </div>
                  <h1 className="text-5xl font-bold mb-4 tracking-tight">{t.title}</h1>
                  <p className="text-zinc-400 mb-10 leading-relaxed">{t.instructions}</p>
                  <button
                    onClick={initGame}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-2xl transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 text-lg"
                  >
                    <Target className="w-5 h-5" />
                    {t.start}
                  </button>
                </>
              )}

              {gameState === 'WON' && (
                <>
                  <div className="w-20 h-20 bg-yellow-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-yellow-500/30">
                    <Trophy className="w-10 h-10 text-yellow-400" />
                  </div>
                  <h2 className="text-4xl font-bold mb-4 text-yellow-400">{t.win}</h2>
                  <div className="text-6xl font-bold mb-10 tabular-nums">{score}</div>
                  <button
                    onClick={initGame}
                    className="w-full bg-white text-black font-bold py-4 rounded-2xl transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 text-lg"
                  >
                    <RefreshCw className="w-5 h-5" />
                    {t.restart}
                  </button>
                </>
              )}

              {gameState === 'LOST' && (
                <>
                  <div className="w-20 h-20 bg-red-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-red-500/30">
                    <XCircle className="w-10 h-10 text-red-400" />
                  </div>
                  <h2 className="text-4xl font-bold mb-4 text-red-400">{t.lose}</h2>
                  <div className="text-6xl font-bold mb-10 tabular-nums">{score}</div>
                  <button
                    onClick={initGame}
                    className="w-full bg-red-500 hover:bg-red-400 text-white font-bold py-4 rounded-2xl transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 text-lg"
                  >
                    <RefreshCw className="w-5 h-5" />
                    {t.restart}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
