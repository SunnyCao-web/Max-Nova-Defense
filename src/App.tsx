/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Rocket as RocketIcon, Shield, Target, Trophy, XCircle, RefreshCw, Languages, Volume2, VolumeX } from 'lucide-react';
import { GameState, Point, Rocket, Missile, Explosion, City, Turret, Person, Car, COLORS } from './types';

const WIN_SCORE = 1000;
const INITIAL_CITIES = 9;
const BGM_URL = 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3';

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
  const frameRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const shakeRef = useRef(0);

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

  const drawWatermelon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Main body (Green skin)
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.7, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2d5a27'; // Dark green
    ctx.fill();
    ctx.strokeStyle = '#1a3a1a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Stripes
    ctx.strokeStyle = '#4a7c44'; // Lighter green stripes
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(0, i * size * 0.3, size * 0.8, 0, Math.PI, i > 0);
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawSky = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Sky Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#1e4877'); // Deep blue
    gradient.addColorStop(0.6, '#4584b4'); // Mid blue
    gradient.addColorStop(1, '#87ceeb'); // Sky blue
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Simple Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    const cloudSeeds = [
      { x: 0.1, y: 0.2, s: 40 },
      { x: 0.3, y: 0.15, s: 50 },
      { x: 0.6, y: 0.25, s: 45 },
      { x: 0.85, y: 0.1, s: 60 },
    ];

    cloudSeeds.forEach(c => {
      const cx = c.x * width;
      const cy = c.y * height;
      ctx.beginPath();
      ctx.arc(cx, cy, c.s, 0, Math.PI * 2);
      ctx.arc(cx + c.s * 0.6, cy - c.s * 0.2, c.s * 0.8, 0, Math.PI * 2);
      ctx.arc(cx + c.s * 1.2, cy, c.s * 0.7, 0, Math.PI * 2);
      ctx.fill();
    });
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

      // Draw Watermelon Rocket
      const angle = Math.atan2(r.targetY - r.y, r.targetX - r.x);
      drawWatermelon(ctx, r.x, r.y, 12, angle);

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
      if (m.progress >= 2) return false; // Collided

      m.progress += m.speed;
      m.x = m.startX + (m.targetX - m.startX) * m.progress;
      m.y = m.startY + (m.targetY - m.startY) * m.progress;

      // Draw trail
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.moveTo(m.startX, m.startY);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();

      // Draw Watermelon Missile
      const angle = Math.atan2(m.targetY - m.startY, m.targetX - m.startX);
      drawWatermelon(ctx, m.x, m.y, 10, angle);

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

    // Update & Draw People
    peopleRef.current.forEach(p => {
      p.x += p.speed * p.direction;
      if (p.x < 0) p.direction = 1;
      if (p.x > canvas.width) p.direction = -1;

      const walkCycle = Math.sin(Date.now() * 0.01) * 3;

      ctx.save();
      ctx.translate(p.x, p.y);
      
      // Legs (Walking animation)
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.lineTo(walkCycle, 0); // Leg 1
      ctx.moveTo(0, -4);
      ctx.lineTo(-walkCycle, 0); // Leg 2
      ctx.stroke();

      // Body (Shirt)
      ctx.fillStyle = p.color;
      ctx.fillRect(-2, -10, 4, 6);

      // Arms
      ctx.strokeStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(-2, -9);
      ctx.lineTo(-2 - Math.abs(walkCycle) * 0.5, -6);
      ctx.moveTo(2, -9);
      ctx.lineTo(2 + Math.abs(walkCycle) * 0.5, -6);
      ctx.stroke();

      // Head
      ctx.fillStyle = '#ffdbac'; // Skin tone
      ctx.beginPath();
      ctx.arc(0, -12, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Hair (Optional detail)
      ctx.fillStyle = '#4a3728';
      ctx.beginPath();
      ctx.arc(0, -13, 2.5, Math.PI, 0);
      ctx.fill();

      ctx.restore();
    });

    // Update & Draw Cars
    carsRef.current.forEach(c => {
      c.x += c.speed * c.direction;
      if (c.x < -50) c.x = canvas.width + 50;
      if (c.x > canvas.width + 50) c.x = -50;

      ctx.save();
      ctx.translate(c.x, c.y);
      if (c.direction < 0) ctx.scale(-1, 1);

      // Car Body (Lower part)
      ctx.fillStyle = c.color;
      ctx.fillRect(-12, -8, 24, 6); 
      
      // Car Roof (Upper part)
      ctx.fillRect(-6, -12, 12, 5);

      // Wheels
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(-8, -2, 3, 0, Math.PI * 2);
      ctx.arc(8, -2, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Wheel Hubs
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(-8, -2, 1.5, 0, Math.PI * 2);
      ctx.arc(8, -2, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Windows
      ctx.fillStyle = '#87ceeb';
      ctx.fillRect(1, -11, 4, 3); // Front window
      ctx.fillRect(-5, -11, 5, 3); // Side window

      // Headlight (Front)
      ctx.fillStyle = '#ffffaa';
      ctx.fillRect(10, -7, 2, 2);
      
      // Taillight (Back)
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(-12, -7, 2, 2);

      ctx.restore();
    });

    // Draw Ground
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, canvas.height - 50, canvas.width, 10);

    // Draw Cities
    citiesRef.current.forEach(c => {
      if (c.active) {
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
          ctx.fillStyle = '#f1c40f'; // Yellow window light
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
