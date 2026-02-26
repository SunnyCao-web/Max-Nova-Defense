export type GameState = 'START' | 'PLAYING' | 'WON' | 'LOST';

export interface Point {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
}

export interface Rocket extends Entity {
  targetX: number;
  targetY: number;
  speed: number;
  progress: number; // 0 to 1
}

export interface Missile extends Entity {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  speed: number;
  progress: number; // 0 to 1
}

export interface Explosion extends Entity {
  radius: number;
  maxRadius: number;
  growing: boolean;
}

export interface City extends Entity {
  active: boolean;
}

export interface Turret extends Entity {
  active: boolean;
  missiles: number;
  maxMissiles: number;
}

export const COLORS = {
  ENEMY: '#ff4444',
  PLAYER: '#44ff44',
  EXPLOSION: '#ffffff',
  CITY: '#4444ff',
  TURRET: '#ffff44',
  BG: '#0a0a0a',
};
