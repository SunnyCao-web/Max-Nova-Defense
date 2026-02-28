/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Rocket as RocketIcon, Shield, Target, Trophy, XCircle, RefreshCw, Languages, Volume2, VolumeX, Pause, Play } from 'lucide-react';
import { GameState, Point, Rocket, Missile, Explosion, City, Turret, Person, Car, StreetLamp, Debris, COLORS } from './types';

const WIN_SCORE = 1000;
const INITIAL_CITIES = 9;
const BGM_URL = 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3';
const SFX = {
  LAUNCH: 'https://assets.mixkit.co/sfx/preview/mixkit-fast-rocket-whoosh-1714.mp3',
  EXPLOSION: 'https://assets.mixkit.co/sfx/preview/mixkit-explosion-hit-1704.mp3',
  IMPACT: 'https://assets.mixkit.co/sfx/preview/mixkit-heavy-impact-768.mp3',
  WIN: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3',
  LOSE: 'https://assets.mixkit.co/sfx/preview/mixkit-game-over-dark-orchestra-633.mp3',
  START: 'https://assets.mixkit.co/sfx/preview/mixkit-interface-hint-notification-911.mp3',
};

const TURRET_CONFIG = [
  { x: 0.1, missiles: 999 },
  { x: 0.3, missiles: 999 },
  { x: 0.45, missiles: 999 },
  { x: 0.7, missiles: 999 },
  { x: 0.9, missiles: 999 },
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [isMuted, setIsMuted] = useState(false);
  
  // Game Entities Refs to avoid re-renders
  const rocketsRef = useRef<Rocket[]>([]);
  const missilesRef = useRef<Missile[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const citiesRef = useRef<City[]>([]);
  const turretsRef = useRef<Turret[]>([]);
  const peopleRef = useRef<Person[]>([]);
  const carsRef = useRef<Car[]>([]);
  const debrisRef = useRef<Debris[]>([]);
  const starsRef = useRef<{x: number, y: number, size: number, opacity: number}[]>([]);
  const smokeRef = useRef<{x: number, y: number, life: number, size: number}[]>([]);
  const streetLampsRef = useRef<StreetLamp[]>([]);
  const frameRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const shakeRef = useRef(0);
  const mousePosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const audio = new Audio(BGM_URL);
    audio.loop = true;
    audio.volume = 0.1; // Set to a lower volume as requested
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      if (gameState === 'PLAYING' && !isMuted) {
        audioRef.current.play().catch(() => {
          console.log('Autoplay blocked');
        });
      }
    }
  }, [isMuted, gameState]);

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

  const playSound = useCallback((url: string, volume = 0.4) => {
    if (isMuted) return;
    const audio = new Audio(url);
    audio.volume = volume;
    audio.play().catch(() => {});
  }, [isMuted]);

  const triggerShake = (intensity: number) => {
    shakeRef.current = Math.min(shakeRef.current + intensity, 15);
  };

  const initGame = useCallback(() => {
    const width = canvasRef.current?.width || 800;
    const height = canvasRef.current?.height || 600;

    // Init Cities
    const cities: City[] = [];
    const citySpacing = width / (INITIAL_CITIES + 2);
    for (let i = 0; i < INITIAL_CITIES; i++) {
      const x = (i + 1.5) * citySpacing;
      let type: 'apartment' | 'eastern-market' | 'restaurant' | 'skyscraper' = 'apartment';
      
      if (i === Math.floor(INITIAL_CITIES / 2)) {
        type = 'eastern-market';
      } else if ([1, 7].includes(i)) {
        type = 'restaurant';
      } else if ([0, 8].includes(i)) {
        type = 'skyscraper';
      } else if ([3, 5].includes(i)) {
        type = 'restaurant';
      }
      
      cities.push({ id: `city-${i}`, x, y: height - 50, active: true, type });
    }
    citiesRef.current = cities;

    // Init Turrets
    const turrets: Turret[] = TURRET_CONFIG.map((conf, i) => ({
      id: `turret-${i}`,
      x: conf.x * width,
      y: height - 50,
      active: true,
      missiles: conf.missiles,
      maxMissiles: conf.missiles,
    }));
    turretsRef.current = turrets;

    // Init People
    const people: Person[] = [];
    const shirtColors = ['#ff6666', '#66ff66', '#6666ff', '#ffff66', '#ff66ff', '#66ffff', '#ffffff', '#ff9933'];
    for (let i = 0; i < 12; i++) {
      people.push({
        id: `person-${i}`,
        x: Math.random() * width,
        y: height - 50,
        speed: 0.1 + Math.random() * 0.15,
        direction: Math.random() > 0.5 ? 1 : -1,
        color: shirtColors[Math.floor(Math.random() * shirtColors.length)]
      });
    }
    peopleRef.current = people;

    // Init Cars
    const cars: Car[] = [];
    const carColors = ['#ff4444', '#4444ff', '#ffffff', '#ffff44', '#ff8800'];
    for (let i = 0; i < 4; i++) {
      cars.push({
        id: `car-${i}`,
        x: Math.random() * width,
        y: height - 50,
        speed: 0.8 + Math.random() * 0.5,
        direction: Math.random() > 0.5 ? 1 : -1,
        color: carColors[Math.floor(Math.random() * carColors.length)]
      });
    }
    carsRef.current = cars;

    // Init Street Lamps
    const streetLamps: StreetLamp[] = [];
    const lampSpacing = 200;
    for (let x = 100; x < width; x += lampSpacing) {
      streetLamps.push({
        id: `lamp-${x}`,
        x: x,
        y: height - 50,
        active: true,
        color: '#00f2ff' // Cyberpunk cyan
      });
    }
    streetLampsRef.current = streetLamps;

    rocketsRef.current = [];
    missilesRef.current = [];
    explosionsRef.current = [];
    debrisRef.current = [];
    smokeRef.current = [];
    
    // Init Stars
    const stars = [];
    for (let i = 0; i < 150; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.7,
        size: Math.random() * 1.5,
        opacity: Math.random()
      });
    }
    starsRef.current = stars;

    shakeRef.current = 0;
    setScore(0);
    setGameState('PLAYING');
    playSound(SFX.START);
  }, [playSound]);

  const spawnRocket = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const startX = Math.random() * canvas.width;
    const targetX = Math.random() * canvas.width;
    const targetY = canvas.height - 50;

    rocketsRef.current.push({
      id: Math.random().toString(36),
      x: startX,
      y: 0,
      targetX,
      targetY,
      speed: 0.0007 + Math.random() * 0.0007 + (score / 70000), // Slower base speed and scaling
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
      playSound(SFX.LAUNCH, 0.2);
      // Missiles are now unlimited
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

  const drawAsteroid = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, id: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Fire Trail (Atmospheric Entry)
    const fireGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 3);
    fireGrad.addColorStop(0, 'rgba(255, 100, 0, 0.8)');
    fireGrad.addColorStop(0.4, 'rgba(255, 50, 0, 0.4)');
    fireGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
    
    ctx.fillStyle = fireGrad;
    ctx.beginPath();
    ctx.arc(0, 0, size * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Asteroid Body (Irregular)
    ctx.beginPath();
    const seed = parseInt(id.slice(-4), 36) || 0;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const jitter = (Math.sin(seed + i) * 0.3 + 0.7);
      const r = size * jitter;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    
    const bodyGrad = ctx.createRadialGradient(-size/3, -size/3, 0, 0, 0, size);
    bodyGrad.addColorStop(0, '#95a5a6'); // Lighter grey
    bodyGrad.addColorStop(1, '#2c3e50'); // Darker grey
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Craters
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 3; i++) {
      const cx = Math.cos(seed + i * 2) * size * 0.4;
      const cy = Math.sin(seed + i * 2) * size * 0.4;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  const drawRuins = (ctx: CanvasRenderingContext2D, x: number, y: number, type: string) => {
    ctx.save();
    ctx.translate(x, y);
    
    ctx.fillStyle = '#3a3a3a'; // Dark grey for ruins
    
    if (type === 'skyscraper') {
      // Jagged base
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(-14, -20);
      ctx.lineTo(-8, -15);
      ctx.lineTo(0, -25);
      ctx.lineTo(6, -10);
      ctx.lineTo(14, -18);
      ctx.lineTo(14, 0);
      ctx.fill();
    } else if (type === 'eastern-market') {
      ctx.beginPath();
      ctx.moveTo(-25, 0);
      ctx.lineTo(-25, -10);
      ctx.lineTo(-10, -5);
      ctx.lineTo(5, -12);
      ctx.lineTo(25, -8);
      ctx.lineTo(25, 0);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(-12, -15);
      ctx.lineTo(-4, -8);
      ctx.lineTo(6, -12);
      ctx.lineTo(12, -5);
      ctx.lineTo(12, 0);
      ctx.fill();
    }
    
    // Add some static debris around
    ctx.fillStyle = '#222';
    for (let i = 0; i < 5; i++) {
      const dx = (Math.sin(x + i) * 20);
      const dy = -Math.abs(Math.cos(x + i) * 5);
      ctx.fillRect(dx, dy, 3, 3);
    }

    ctx.restore();
  };

  const drawMissile = (ctx: CanvasRenderingContext2D, x: number, y: number, rotation: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Missile Body (Metallic)
    const gradient = ctx.createLinearGradient(-8, 0, 8, 0);
    gradient.addColorStop(0, '#7f8c8d');
    gradient.addColorStop(0.5, '#ecf0f1');
    gradient.addColorStop(1, '#7f8c8d');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(10, 0); // Tip
    ctx.lineTo(-8, -4); // Top back
    ctx.lineTo(-10, -4); // Top fin back
    ctx.lineTo(-10, 4); // Bottom fin back
    ctx.lineTo(-8, 4); // Bottom back
    ctx.closePath();
    ctx.fill();

    // Fins
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(-12, -8);
    ctx.lineTo(-10, -4);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(-6, 4);
    ctx.lineTo(-12, 8);
    ctx.lineTo(-10, 4);
    ctx.closePath();
    ctx.fill();

    // Glowing Tip
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#e74c3c';
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(10, 0, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Engine Glow
    const engineGlow = ctx.createRadialGradient(-10, 0, 0, -10, 0, 10);
    engineGlow.addColorStop(0, '#f1c40f');
    engineGlow.addColorStop(0.5, 'rgba(230, 126, 34, 0.5)');
    engineGlow.addColorStop(1, 'rgba(230, 126, 34, 0)');
    ctx.fillStyle = engineGlow;
    ctx.beginPath();
    ctx.arc(-10, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const drawSky = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Night Sky Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#050b1a'); // Deep space blue
    gradient.addColorStop(0.5, '#0a1a3a'); // Mid night blue
    gradient.addColorStop(1, '#1a2a4a'); // Horizon blue
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Stars
    starsRef.current.forEach(s => {
      s.opacity = 0.3 + Math.abs(Math.sin(Date.now() * 0.001 + s.x)) * 0.7;
      ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Moon
    ctx.save();
    ctx.translate(width * 0.85, height * 0.15);
    // Moon Glow
    const moonGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 50);
    moonGlow.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    moonGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, Math.PI * 2);
    ctx.fill();
    // Moon Body
    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.fill();
    // Moon Craters
    ctx.fillStyle = '#e0e0e0';
    [[-8, -5, 4], [5, 8, 5], [-5, 10, 3], [10, -5, 4]].forEach(([cx, cy, cr]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // Atmospheric Haze
    const haze = ctx.createLinearGradient(0, height * 0.6, 0, height);
    haze.addColorStop(0, 'rgba(26, 42, 74, 0)');
    haze.addColorStop(1, 'rgba(26, 42, 74, 0.4)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, height * 0.6, width, height * 0.4);

    // Realistic Clouds (Soft, wispy)
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    const cloudSeeds = [
      { x: 0.1, y: 0.3, w: 120, h: 40 },
      { x: 0.4, y: 0.2, w: 180, h: 50 },
      { x: 0.7, y: 0.35, w: 150, h: 45 },
      { x: 0.9, y: 0.25, w: 130, h: 35 },
    ];

    cloudSeeds.forEach(c => {
      const cx = c.x * width;
      const cy = c.y * height;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, c.w);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, c.w, c.h, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
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

    // Draw Sky
    drawSky(ctx, canvas.width, canvas.height);

    // Update & Draw Debris
    debrisRef.current = debrisRef.current.filter(d => {
      d.x += d.vx;
      d.y += d.vy;
      d.vy += 0.15; // Gravity
      d.rotation += d.rotationSpeed;
      d.life -= 0.01;

      if (d.y > canvas.height - 50) {
        d.y = canvas.height - 50;
        d.vx *= 0.8;
        d.vy *= -0.3;
      }

      if (d.life <= 0) return false;

      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rotation);
      ctx.fillStyle = d.color;
      ctx.globalAlpha = d.life;
      ctx.fillRect(-d.size/2, -d.size/2, d.size, d.size);
      ctx.restore();
      return true;
    });

    // Update & Draw Smoke
    smokeRef.current = smokeRef.current.filter(s => {
      s.life -= 0.02;
      s.size += 0.2;
      if (s.life <= 0) return false;
      ctx.fillStyle = `rgba(200, 200, 200, ${s.life * 0.3})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });

    // Spawn Rockets
    const now = Date.now();
    if (now - lastSpawnRef.current > Math.max(500, 2000 - score)) {
      spawnRocket();
      lastSpawnRef.current = now;
    }

    // Collision Detection: Rockets vs Missiles
    rocketsRef.current.forEach((r, rIdx) => {
      missilesRef.current.forEach((m, mIdx) => {
        const dist = Math.hypot(r.x - m.x, r.y - m.y);
        if (dist < 20) { // Collision radius
          // Both explode
          playSound(SFX.EXPLOSION, 0.3);
          explosionsRef.current.push({
            id: `col-r-${r.id}`,
            x: r.x,
            y: r.y,
            radius: 0,
            maxRadius: 40,
            growing: true,
          });
          // Mark for removal (using progress > 1 as a hack or just filtering later)
          r.progress = 2; 
          m.progress = 2;
          setScore(s => s + 20);
        }
      });

      // Collision Detection: Rocket vs Rocket
      rocketsRef.current.forEach((r2, r2Idx) => {
        if (rIdx !== r2Idx) {
          const dist = Math.hypot(r.x - r2.x, r.y - r2.y);
          if (dist < 20) {
            playSound(SFX.EXPLOSION, 0.3);
            explosionsRef.current.push({
              id: `col-rr-${r.id}-${r2.id}`,
              x: (r.x + r2.x) / 2,
              y: (r.y + r2.y) / 2,
              radius: 0,
              maxRadius: 40,
              growing: true,
            });
            r.progress = 2;
            r2.progress = 2;
            setScore(s => s + 40);
          }
        }
      });
    });

    // Update & Draw Rockets
    rocketsRef.current = rocketsRef.current.filter(r => {
      if (r.progress >= 2) return false; // Collided

      r.progress += r.speed;
      r.x = r.x + (r.targetX - r.x) * r.speed / (1 - r.progress + r.speed);
      r.y = r.y + (r.targetY - r.y) * r.speed / (1 - r.progress + r.speed);

      // Draw trail
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x - (r.targetX - r.x) * 0.1, r.y - (r.targetY - r.y) * 0.1);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Asteroid
      const angle = Math.atan2(r.targetY - r.y, r.targetX - r.x);
      drawAsteroid(ctx, r.x, r.y, 14, angle + Date.now() * 0.005, r.id);

      // Check impact
      if (r.progress >= 1) {
        triggerShake(8);
        playSound(SFX.IMPACT, 0.5);
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
          if (c.active && Math.abs(c.x - r.x) < 30) {
            c.active = false;
            // Spawn crumbling debris
            for (let i = 0; i < 15; i++) {
              debrisRef.current.push({
                id: `debris-${Math.random()}`,
                x: c.x + (Math.random() - 0.5) * 30,
                y: c.y - Math.random() * 40,
                vx: (Math.random() - 0.5) * 4,
                vy: -Math.random() * 5,
                size: 2 + Math.random() * 4,
                color: '#4a4a4a',
                life: 1,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2
              });
            }
          }
        });
        turretsRef.current.forEach(t => {
          if (t.active && Math.abs(t.x - r.x) < 30) {
            t.active = false;
            // Spawn metallic crumbling debris
            for (let i = 0; i < 20; i++) {
              debrisRef.current.push({
                id: `debris-t-${Math.random()}`,
                x: t.x + (Math.random() - 0.5) * 40,
                y: t.y - Math.random() * 20,
                vx: (Math.random() - 0.5) * 6,
                vy: -Math.random() * 8,
                size: 3 + Math.random() * 5,
                color: i % 2 === 0 ? '#7f8c8d' : '#2c3e50', // Metallic colors
                life: 1.2,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.3
              });
            }
          }
        });

        // Immediate removal of nearby people and cars
        peopleRef.current = peopleRef.current.filter(p => Math.abs(p.x - r.x) >= 20);
        carsRef.current.forEach(c => {
          if (Math.abs(c.x - r.x) < 30) {
            c.isJunk = true;
          }
        });

        // Damage street lamps
        streetLampsRef.current.forEach(l => {
          if (l.active && Math.abs(l.x - r.x) < 20) {
            l.active = false;
            // Spawn glass/metal debris
            for (let i = 0; i < 5; i++) {
              debrisRef.current.push({
                id: `debris-l-${Math.random()}`,
                x: l.x,
                y: l.y - 30,
                vx: (Math.random() - 0.5) * 4,
                vy: -Math.random() * 4,
                size: 1 + Math.random() * 2,
                color: i % 2 === 0 ? '#00f2ff' : '#333',
                life: 0.8,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.5
              });
            }
          }
        });

        // Dust Cloud on impact
        for (let i = 0; i < 10; i++) {
          smokeRef.current.push({
            x: r.x + (Math.random() - 0.5) * 40,
            y: r.y + (Math.random() - 0.5) * 10,
            life: 0.8 + Math.random() * 0.4,
            size: 5 + Math.random() * 10
          });
        }

        return false;
      }
      return true;
    });

    // Update & Draw Missiles
    missilesRef.current = missilesRef.current.filter(m => {
      if (m.progress >= 2) return false; // Collided

      m.progress += m.speed;
      m.x = m.startX + (m.targetX - m.startX) * m.progress;
      m.y = m.startY + (m.targetY - m.startY) * m.progress;

      // Draw trail
      ctx.beginPath();
      const trailGrad = ctx.createLinearGradient(m.startX, m.startY, m.x, m.y);
      trailGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      trailGrad.addColorStop(0.8, 'rgba(255, 255, 255, 0.4)');
      trailGrad.addColorStop(1, 'rgba(255, 200, 50, 0.8)');
      
      ctx.strokeStyle = trailGrad;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.moveTo(m.startX, m.startY);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Detailed Missile
      const angle = Math.atan2(m.targetY - m.startY, m.targetX - m.startX);
      drawMissile(ctx, m.x, m.y, angle);

      // Add Smoke Trail
      if (frameRef.current % 2 === 0) {
        smokeRef.current.push({ x: m.x, y: m.y, life: 1, size: 2 });
      }

      // Draw Target X
      ctx.beginPath();
      ctx.strokeStyle = COLORS.PLAYER;
      ctx.moveTo(m.targetX - 3, m.targetY - 3);
      ctx.lineTo(m.targetX + 3, m.targetY + 3);
      ctx.moveTo(m.targetX + 3, m.targetY - 3);
      ctx.lineTo(m.targetX - 3, m.targetY + 3);
      ctx.stroke();

      if (m.progress >= 1) {
        playSound(SFX.EXPLOSION, 0.3);
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

      const ratio = e.radius / e.maxRadius;
      
      // 1. Outer Glow (Large, soft)
      const glow = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius * 1.5);
      glow.addColorStop(0, `rgba(255, 100, 0, ${0.4 * ratio})`);
      glow.addColorStop(1, 'rgba(255, 50, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // 2. Fire Layer (Orange/Yellow)
      const fire = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius);
      fire.addColorStop(0, `rgba(255, 200, 50, ${ratio})`);
      fire.addColorStop(0.6, `rgba(255, 100, 0, ${0.8 * ratio})`);
      fire.addColorStop(1, 'rgba(200, 50, 0, 0)');
      ctx.fillStyle = fire;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();

      // 3. Core (White/Bright Yellow)
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${ratio})`;
      ctx.fill();

      // 4. Shockwave (Thin ring expanding)
      if (e.growing) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 1.2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 * (1 - ratio)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 5. Sparks (Random bits flying out)
      const seed = parseInt(e.id.slice(-4), 36) || 0;
      ctx.fillStyle = `rgba(255, 255, 200, ${ratio})`;
      for (let i = 0; i < 8; i++) {
        const angle = (seed + i) * 137.5; // Golden angle
        const dist = e.radius * (1 + Math.sin(seed + i) * 0.5) * (1 - ratio * 0.5);
        const px = e.x + Math.cos(angle) * dist;
        const py = e.y + Math.sin(angle) * dist;
        const size = Math.max(1, 3 * ratio);
        ctx.fillRect(px - size/2, py - size/2, size, size);
      }

      // Check collision with rockets
      rocketsRef.current = rocketsRef.current.filter(r => {
        const dist = Math.hypot(r.x - e.x, r.y - e.y);
        if (dist < e.radius) {
          triggerShake(2);
          setScore(s => {
            const newScore = s + 20;
            if (newScore >= WIN_SCORE) {
              setGameState('WON');
              playSound(SFX.WIN);
            }
            return newScore;
          });
          // Chain reaction: Rocket explodes
          playSound(SFX.EXPLOSION, 0.2);
          explosionsRef.current.push({
            id: `chain-r-${Math.random()}`,
            x: r.x,
            y: r.y,
            radius: 0,
            maxRadius: 35,
            growing: true,
          });
          return false;
        }
        return true;
      });

      // Check collision with missiles (fireworks)
      missilesRef.current = missilesRef.current.filter(m => {
        const dist = Math.hypot(m.x - e.x, m.y - e.y);
        if (dist < e.radius) {
          // Chain reaction: Missile explodes prematurely
          playSound(SFX.EXPLOSION, 0.2);
          explosionsRef.current.push({
            id: `chain-m-${Math.random()}`,
            x: m.x,
            y: m.y,
            radius: 0,
            maxRadius: 40,
            growing: true,
          });
          return false;
        }
        return true;
      });

      // Check collision with people
      peopleRef.current = peopleRef.current.filter(p => {
        const dist = Math.hypot(p.x - e.x, p.y - e.y);
        return dist > e.radius + 5;
      });

      // Check collision with cars
      carsRef.current = carsRef.current.filter(c => {
        const dist = Math.hypot(c.x - e.x, c.y - e.y);
        return dist > e.radius + 10;
      });

      return true;
    });

    // Update & Draw People
    peopleRef.current.forEach(p => {
      // Check for nearby asteroids (rockets)
      let isPanicking = false;
      let closestRocketX = 0;
      let minRocketDist = 150; // Detection radius

      rocketsRef.current.forEach(r => {
        const dist = Math.hypot(r.x - p.x, r.y - p.y);
        if (dist < minRocketDist) {
          isPanicking = true;
          minRocketDist = dist;
          closestRocketX = r.x;
        }
      });

      let currentSpeed = p.speed;
      if (isPanicking) {
        currentSpeed *= 3; // Run faster!
        // Move away from the asteroid
        p.direction = p.x > closestRocketX ? 1 : -1;
      }

      p.x += currentSpeed * p.direction;
      if (p.x < 0) p.direction = 1;
      if (p.x > canvas.width) p.direction = -1;

      const walkCycle = Math.sin(Date.now() * (isPanicking ? 0.03 : 0.01)) * 3;

      ctx.save();
      ctx.translate(p.x, p.y);
      
      // Panic Indicator (Exclamation mark)
      if (isPanicking) {
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', 0, -22);
      }
      
      // Ground Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Legs (Walking animation - more detailed)
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      // Leg 1
      ctx.moveTo(0, -5);
      ctx.lineTo(walkCycle * 1.2, 0);
      // Leg 2
      ctx.moveTo(0, -5);
      ctx.lineTo(-walkCycle * 1.2, 0);
      ctx.stroke();

      // Torso (Humanoid shape)
      const bodyGrad = ctx.createLinearGradient(0, -11, 0, -5);
      bodyGrad.addColorStop(0, p.color);
      bodyGrad.addColorStop(1, '#111');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(-3, -11);
      ctx.lineTo(3, -11); // Shoulders
      ctx.lineTo(2, -5);
      ctx.lineTo(-2, -5); // Waist
      ctx.closePath();
      ctx.fill();

      // Arms (Swinging opposite to legs)
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // Arm 1
      ctx.moveTo(-2.5, -10);
      ctx.lineTo(-3.5 - walkCycle * 0.8, -6);
      // Arm 2
      ctx.moveTo(2.5, -10);
      ctx.lineTo(3.5 + walkCycle * 0.8, -6);
      ctx.stroke();

      // Head (Stylized AI/Robot Face)
      ctx.beginPath();
      ctx.arc(0, -13, 3.8, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();
      
      // Glowing AI Eye
      ctx.beginPath();
      ctx.arc(p.direction > 0 ? 1.5 : -1.5, -13.5, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = '#00f2ff';
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#00f2ff';
      ctx.fill();
      ctx.shadowBlur = 0;

      // Digital mouth line
      ctx.strokeStyle = '#00f2ff';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(p.direction > 0 ? 0 : -2.5, -11.5);
      ctx.lineTo(p.direction > 0 ? 2.5 : 0, -11.5);
      ctx.stroke();
      
      ctx.restore();
    });

    // Update & Draw Cars
    carsRef.current.forEach(c => {
      // Check for nearby asteroids (rockets)
      let isPanicking = false;
      let closestRocketX = 0;
      let minRocketDist = 250; // Detection radius for cars (larger than people)
      let veryCloseRocket = false;

      if (!c.isJunk) {
        rocketsRef.current.forEach(r => {
          const dist = Math.hypot(r.x - c.x, r.y - c.y);
          if (dist < minRocketDist) {
            isPanicking = true;
            minRocketDist = dist;
            closestRocketX = r.x;
            if (dist < 80) veryCloseRocket = true;
          }
        });
      }

      // Abandonment Logic
      if (veryCloseRocket && !c.abandoned && !c.isJunk && Math.random() < 0.01) {
        c.abandoned = true;
        // Spawn a person running away
        peopleRef.current.push({
          id: `driver-${Date.now()}-${Math.random()}`,
          x: c.x,
          y: c.y,
          speed: 0.2 + Math.random() * 0.2,
          direction: c.x > closestRocketX ? 1 : -1,
          color: '#ffffff' // Driver in white shirt
        });
      }

      let currentSpeed = (c.abandoned || c.isJunk) ? 0 : c.speed;
      if (isPanicking && !c.abandoned && !c.isJunk) {
        currentSpeed *= 2.5; // Speed up!
        // Move away from the asteroid
        c.direction = c.x > closestRocketX ? 1 : -1;
      }

      c.x += currentSpeed * c.direction;
      if (c.x < -100) c.x = canvas.width + 100;
      if (c.x > canvas.width + 100) c.x = -100;

      ctx.save();
      ctx.translate(c.x, c.y);
      if (c.direction < 0) ctx.scale(-1, 1);

      // Panic Indicator (Honking/Alert)
      if (isPanicking && !c.abandoned && !c.isJunk) {
        ctx.fillStyle = '#ffcc00'; // Warning yellow
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('BEEP!', 0, -18);
      } else if (c.abandoned && !c.isJunk) {
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ABANDONED', 0, -18);
      } else if (c.isJunk) {
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('JUNK', 0, -18);
      }

      // Ground Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Car Body (Detailed Gradient)
      const bodyGrad = ctx.createLinearGradient(0, -12, 0, -2);
      let carColor = c.color;
      if (c.isJunk) carColor = '#1a1a1a'; // Burnt out black
      else if (c.abandoned) carColor = '#333'; // Darker if abandoned
      
      bodyGrad.addColorStop(0, carColor);
      bodyGrad.addColorStop(1, '#000000'); // Darker bottom
      ctx.fillStyle = bodyGrad;
      
      // Main Chassis
      ctx.beginPath();
      ctx.roundRect(-14, -8, 28, 7, 3);
      ctx.fill();
      
      // Cabin/Roof
      ctx.beginPath();
      ctx.moveTo(-10, -8);
      ctx.lineTo(-6, -14);
      ctx.lineTo(6, -14);
      ctx.lineTo(10, -8);
      ctx.closePath();
      ctx.fill();

      // Windows (Glass effect)
      if (!c.isJunk) {
        ctx.fillStyle = 'rgba(135, 206, 235, 0.6)'; // Sky blue glass
        ctx.beginPath();
        ctx.moveTo(-8, -8.5);
        ctx.lineTo(-5, -13);
        ctx.lineTo(0, -13);
        ctx.lineTo(0, -8.5);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(1, -8.5);
        ctx.lineTo(1, -13);
        ctx.lineTo(5, -13);
        ctx.lineTo(8, -8.5);
        ctx.closePath();
        ctx.fill();

        // Reflection on glass
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-4, -12);
        ctx.lineTo(-2, -9);
        ctx.stroke();
      } else {
        // Broken windows for junk car
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.beginPath();
        ctx.moveTo(-8, -8.5);
        ctx.lineTo(-5, -13);
        ctx.lineTo(8, -8.5);
        ctx.closePath();
        ctx.fill();
        
        // Smoke from junk car
        if (frameRef.current % 10 === 0) {
          smokeRef.current.push({ x: c.x + (Math.random() - 0.5) * 10, y: c.y - 12, life: 1, size: 3 + Math.random() * 5 });
        }
      }

      // Wheels (More detailed)
      const drawWheel = (wx: number) => {
        ctx.fillStyle = c.isJunk ? '#000' : '#111'; // Tire
        ctx.beginPath();
        ctx.arc(wx, -2, 4, 0, Math.PI * 2);
        ctx.fill();
        if (!c.isJunk) {
          ctx.fillStyle = '#7f8c8d'; // Hubcap
          ctx.beginPath();
          ctx.arc(wx, -2, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      };
      drawWheel(-9);
      drawWheel(9);

      // Taillights (Red glow)
      if (!c.abandoned && !c.isJunk && powerOn) {
        ctx.fillStyle = '#ff0000';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#ff0000';
        ctx.fillRect(-14, -7, 2, 3);
        ctx.shadowBlur = 0;

        // Headlights (Front glow)
        ctx.fillStyle = '#ffffcc';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ffffcc';
        ctx.fillRect(12, -7, 2, 3);
        ctx.shadowBlur = 0;

        // Headlight Beam
        const beam = ctx.createLinearGradient(14, -5, 50, -5);
        beam.addColorStop(0, 'rgba(255, 255, 200, 0.4)');
        beam.addColorStop(1, 'rgba(255, 255, 200, 0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(14, -6);
        ctx.lineTo(50, -15);
        ctx.lineTo(50, 5);
        ctx.closePath();
        ctx.fill();
      } else if ((c.abandoned || !powerOn) && !c.isJunk) {
        // Abandoned or Power Off car lights (dim/off)
        ctx.fillStyle = '#330000';
        ctx.fillRect(-14, -7, 2, 3);
        ctx.fillStyle = '#333300';
        ctx.fillRect(12, -7, 2, 3);
      } else if (c.isJunk) {
        // Junk car lights (broken)
        ctx.fillStyle = '#000';
        ctx.fillRect(-14, -7, 2, 3);
        ctx.fillRect(12, -7, 2, 3);
      }

      ctx.restore();
    });

    // Draw Ground
    ctx.save();
    // Main Ground
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, canvas.height - 50, canvas.width, 50);
    
    // Ground Texture (Pavement/Road)
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, canvas.height - 50);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    
    // Horizon Glow (City lights)
    const horizonGlow = ctx.createLinearGradient(0, canvas.height - 60, 0, canvas.height - 50);
    horizonGlow.addColorStop(0, 'rgba(255, 200, 100, 0)');
    horizonGlow.addColorStop(1, 'rgba(255, 200, 100, 0.15)');
    ctx.fillStyle = horizonGlow;
    ctx.fillRect(0, canvas.height - 60, canvas.width, 10);
    
    // Road Markings
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < canvas.width; i += 100) {
      ctx.fillRect(i, canvas.height - 25, 40, 2);
    }
    ctx.restore();

    // Draw Street Lamps
    const anyLampBroken = streetLampsRef.current.some(l => !l.active);
    const powerOn = !anyLampBroken;

    streetLampsRef.current.forEach(l => {
      if (!l.active) {
        // Draw broken lamp
        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -30);
        ctx.stroke();
        ctx.restore();
        return;
      }

      ctx.save();
      ctx.translate(l.x, l.y);
      
      // Pole
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -35);
      ctx.stroke();
      
      // Arm
      ctx.beginPath();
      ctx.moveTo(0, -35);
      ctx.lineTo(10, -35);
      ctx.stroke();

      // Lamp Head
      ctx.fillStyle = '#111';
      ctx.fillRect(8, -37, 6, 3);

      if (powerOn) {
        // Light Glow
        const glow = ctx.createRadialGradient(11, -35, 0, 11, -35, 25);
        glow.addColorStop(0, l.color);
        glow.addColorStop(0.3, l.color + '66');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(11, -35, 25, 0, Math.PI * 2);
        ctx.fill();

        // Light Beam on ground
        const groundGlow = ctx.createRadialGradient(11, 0, 0, 11, 0, 40);
        groundGlow.addColorStop(0, l.color + '44');
        groundGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = groundGlow;
        ctx.beginPath();
        ctx.ellipse(11, 0, 30, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

    // Draw Cities
    citiesRef.current.forEach(c => {
      if (c.active) {
        // Dynamic Lighting from explosions
        const nearestExp = explosionsRef.current.reduce((prev, curr) => {
          const d = Math.hypot(curr.x - c.x, curr.y - c.y);
          return d < prev.dist ? { dist: d, exp: curr } : prev;
        }, { dist: 200, exp: null as any });

        if (nearestExp.exp && powerOn) {
          ctx.save();
          ctx.shadowBlur = 15;
          ctx.shadowColor = `rgba(255, 150, 50, ${1 - nearestExp.dist / 200})`;
        }

        if (c.type === 'eastern-market') {
          // Draw Eastern Market Landmark
          ctx.save();
          ctx.translate(c.x, c.y);
          
          // Main Shed (Red Brick)
          ctx.fillStyle = '#8b2e2e'; // Brick red
          ctx.fillRect(-25, -30, 50, 30);
          
          // Roof (Arched)
          ctx.beginPath();
          ctx.moveTo(-28, -30);
          ctx.quadraticCurveTo(0, -45, 28, -30);
          ctx.fillStyle = '#4a4a4a'; // Dark roof
          ctx.fill();
          
          // Arched Windows/Entrances
          ctx.fillStyle = '#1a1a1a';
          for (let j = -1; j <= 1; j++) {
            const wx = j * 15;
            ctx.beginPath();
            ctx.arc(wx, -15, 5, Math.PI, 0);
            ctx.lineTo(wx + 5, -5);
            ctx.lineTo(wx - 5, -5);
            ctx.fill();
          }
          
          // Sign
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 6px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('EASTERN MARKET', 0, -32);
          
          ctx.restore();
        } else if (c.type === 'skyscraper') {
          // Draw Skyscraper
          ctx.save();
          ctx.translate(c.x, c.y);
          
          const skyHeight = 80;
          const skyWidth = 28;
          
          // Main Body
          ctx.fillStyle = '#2c3e50'; // Dark blue-grey
          ctx.fillRect(-skyWidth/2, -skyHeight, skyWidth, skyHeight);
          
          // Antenna
          ctx.strokeStyle = '#7f8c8d';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, -skyHeight);
          ctx.lineTo(0, -skyHeight - 15);
          ctx.stroke();
          
          // Red light on top
          if (Math.floor(Date.now() / 500) % 2 === 0) {
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(0, -skyHeight - 15, 2, 0, Math.PI * 2);
            ctx.fill();
          }
          
          // Windows (Grid)
          ctx.fillStyle = powerOn ? '#f1c40f' : '#1a1a1a'; // Yellow window light or off
          const winSize = 3;
          const winGap = 4;
          for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 3; col++) {
              // Randomly turn off some windows
              if ((row + col + Math.floor(c.x)) % 5 !== 0) {
                const wx = -skyWidth/2 + 5 + col * (winSize + winGap);
                const wy = -skyHeight + 8 + row * (winSize + winGap);
                ctx.fillRect(wx, wy, winSize, winSize);
              }
            }
          }
          
          ctx.restore();
        } else if (c.type === 'restaurant') {
          // Draw Restaurant
          ctx.save();
          ctx.translate(c.x, c.y);
          
          // Building
          ctx.fillStyle = '#ffcc33'; // Warm yellow
          ctx.fillRect(-15, -20, 30, 20);
          
          // Awning
          ctx.fillStyle = '#ff4444'; // Red awning
          ctx.fillRect(-18, -22, 36, 6);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          for (let k = -18; k < 18; k += 6) {
            ctx.strokeRect(k, -22, 6, 6);
          }
          
          // Door and Window
          ctx.fillStyle = '#333';
          ctx.fillRect(-4, -10, 8, 10); // Door
          ctx.fillStyle = '#87ceeb';
          ctx.fillRect(-12, -12, 6, 6); // Left window
          ctx.fillRect(6, -12, 6, 6); // Right window
          
          // Signage
          ctx.fillStyle = '#000';
          ctx.font = 'bold 5px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('DINER', 0, -24);
          
          ctx.restore();
        } else {
          // Draw Regular Apartment
          ctx.fillStyle = COLORS.CITY;
          const buildingHeight = 45;
          ctx.fillRect(c.x - 12, c.y - buildingHeight, 24, buildingHeight);
          
          // Windows
          ctx.fillStyle = '#0a0a0a';
          for (let row = 1; row <= 4; row++) {
            const winY = c.y - buildingHeight + (row * 8);
            ctx.fillRect(c.x - 8, winY, 4, 4);
            ctx.fillRect(c.x + 4, winY, 4, 4);
          }
        }
        
        if (nearestExp.exp) ctx.restore();
      } else {
        // Draw Ruins
        drawRuins(ctx, c.x, c.y, c.type || 'apartment');
      }
    });

    // Draw Turrets
    turretsRef.current.forEach(t => {
      if (t.active) {
        ctx.save();
        ctx.translate(t.x, t.y);

        // Calculate angle to mouse
        const angle = Math.atan2(mousePosRef.current.y - t.y, mousePosRef.current.x - t.x);

        // Turret Base (Metallic)
        const gradient = ctx.createLinearGradient(-20, 0, 20, 0);
        gradient.addColorStop(0, '#4a4a4a');
        gradient.addColorStop(0.5, '#7f8c8d');
        gradient.addColorStop(1, '#4a4a4a');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, -5, 22, Math.PI, 0);
        ctx.fill();
        
        // Base Shadow/Detail
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Mechanical details on base
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-15, -5, 30, 5); // Bottom plate
        
        // Rotating Head
        ctx.save();
        ctx.rotate(angle + Math.PI / 2); // Adjust for vertical barrel

        // Barrel
        const barrelGrad = ctx.createLinearGradient(-5, -35, 5, -35);
        barrelGrad.addColorStop(0, '#2c3e50');
        barrelGrad.addColorStop(0.5, '#34495e');
        barrelGrad.addColorStop(1, '#2c3e50');
        
        ctx.fillStyle = barrelGrad;
        ctx.fillRect(-5, -35, 10, 25);
        
        // Muzzle Brake
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-7, -38, 14, 4);
        
        // Barrel Detail (Lines)
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-3, -35);
        ctx.lineTo(-3, -10);
        ctx.stroke();

        ctx.restore();

        // Status Light
        ctx.fillStyle = t.missiles > 0 ? '#00ff00' : '#ff0000';
        ctx.beginPath();
        ctx.arc(0, -15, 3, 0, Math.PI * 2);
        ctx.fill();
        // Glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = t.missiles > 0 ? '#00ff00' : '#ff0000';
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.restore();
      }
    });

    // Check Game Over
    if (turretsRef.current.every(t => !t.active)) {
      setGameState('LOST');
      playSound(SFX.LOSE);
    }

    // Final Post-Processing (Scanlines & Vignette)
    ctx.save();
    // Scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    for (let i = 0; i < canvas.height; i += 4) {
      ctx.fillRect(0, i, canvas.width, 1);
    }
    // Vignette
    const vignette = ctx.createRadialGradient(canvas.width/2, canvas.height/2, canvas.width * 0.4, canvas.width/2, canvas.height/2, canvas.width * 0.8);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

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

    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p') {
        setGameState(prev => {
          if (prev === 'PLAYING') return 'PAUSED';
          if (prev === 'PAUSED') return 'PLAYING';
          return prev;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
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

        <div className="flex gap-2 flex-wrap justify-center">
          {turretsRef.current.map((turret, i) => (
            <div key={i} className={`bg-black/40 backdrop-blur-md border border-white/10 p-2 rounded-xl flex flex-col items-center min-w-[50px] transition-opacity ${!turret.active ? 'opacity-30' : 'opacity-100'}`}>
              <div className="text-[10px] uppercase tracking-tighter text-zinc-400 mb-0.5">T{i+1}</div>
              <div className="text-lg font-bold text-yellow-400">
                ∞
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setLang(l => l === 'zh' ? 'en' : 'zh')}
            className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-xl hover:bg-white/10 transition-colors"
          >
            <Languages className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setIsMuted(m => !m)}
            className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-xl hover:bg-white/10 transition-colors"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          {gameState === 'PLAYING' && (
            <button 
              onClick={() => setGameState('PAUSED')}
              className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-xl hover:bg-white/10 transition-colors"
            >
              <Pause className="w-5 h-5" />
            </button>
          )}
          {gameState === 'PAUSED' && (
            <button 
              onClick={() => setGameState('PLAYING')}
              className="pointer-events-auto bg-emerald-500/80 backdrop-blur-md border border-emerald-500/30 p-3 rounded-xl hover:bg-emerald-400 transition-colors"
            >
              <Play className="w-5 h-5 text-black" />
            </button>
          )}
        </div>
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

              {gameState === 'PAUSED' && (
                <>
                  <div className="w-20 h-20 bg-blue-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-blue-500/30">
                    <Pause className="w-10 h-10 text-blue-400" />
                  </div>
                  <h2 className="text-4xl font-bold mb-4 text-blue-400">{lang === 'zh' ? '遊戲暫停' : 'PAUSED'}</h2>
                  <p className="text-zinc-400 mb-10 leading-relaxed">
                    {lang === 'zh' ? '點擊下方按鈕繼續保衛城市' : 'Click the button below to continue defending the city'}
                  </p>
                  <button
                    onClick={() => setGameState('PLAYING')}
                    className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold py-4 rounded-2xl transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 text-lg"
                  >
                    <Play className="w-5 h-5" />
                    {lang === 'zh' ? '繼續遊戲' : 'RESUME'}
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
