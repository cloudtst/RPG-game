(() => {
"use strict";

/* =========================================================
   Canvas / sizing
   ========================================================= */
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize);
resize();

/* =========================================================
   Utilities
   ========================================================= */
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

function circlesHit(a, b) {
  const r = a.r + b.r;
  return dist2(a.x, a.y, b.x, b.y) <= r * r;
}

const STORAGE_KEY = "neonRunnerBestScore";
function getBestScore() {
  try { return parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0; }
  catch (e) { return 0; }
}
function setBestScore(v) {
  try { localStorage.setItem(STORAGE_KEY, String(v)); } catch (e) { /* ignore */ }
}

/* =========================================================
   Particles
   ========================================================= */
class Particle {
  constructor(x, y, color, speed, life) {
    this.x = x; this.y = y;
    const a = rand(0, Math.PI * 2);
    this.vx = Math.cos(a) * speed;
    this.vy = Math.sin(a) * speed;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = rand(1.5, 3.5);
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.94;
    this.vy *= 0.94;
    this.life -= dt;
    return this.life > 0;
  }
  draw(ctx) {
    const t = clamp(this.life / this.maxLife, 0, 1);
    ctx.globalAlpha = t;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * t, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

const particles = [];
function burst(x, y, color, count, speed = 140, life = 0.5) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, color, speed * rand(0.4, 1), life * rand(0.6, 1.3)));
  }
}

/* =========================================================
   Input: keyboard + touch joystick + fire button
   ========================================================= */
const input = { x: 0, y: 0 };

const keys = {};
window.addEventListener("keydown", (e) => { keys[e.code] = true; });
window.addEventListener("keyup", (e) => { keys[e.code] = false; });

function keyboardVector() {
  let x = 0, y = 0;
  if (keys["ArrowLeft"] || keys["KeyA"]) x -= 1;
  if (keys["ArrowRight"] || keys["KeyD"]) x += 1;
  if (keys["ArrowUp"] || keys["KeyW"]) y -= 1;
  if (keys["ArrowDown"] || keys["KeyS"]) y += 1;
  const len = Math.hypot(x, y);
  return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
}

// Touch joystick
const joyZone = document.getElementById("joystick-zone");
const joyKnob = document.getElementById("joystick-knob");
let joyActive = false, joyId = null, joyOrigin = { x: 0, y: 0 };
const JOY_RADIUS = 46;

function joyStart(clientX, clientY, id) {
  joyActive = true; joyId = id;
  const rect = joyZone.getBoundingClientRect();
  joyOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
function joyMove(clientX, clientY) {
  if (!joyActive) return;
  let dx = clientX - joyOrigin.x;
  let dy = clientY - joyOrigin.y;
  const d = Math.hypot(dx, dy);
  if (d > JOY_RADIUS) { dx = dx / d * JOY_RADIUS; dy = dy / d * JOY_RADIUS; }
  joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  input.x = dx / JOY_RADIUS;
  input.y = dy / JOY_RADIUS;
}
function joyEnd() {
  joyActive = false; joyId = null;
  joyKnob.style.transform = `translate(0px, 0px)`;
  input.x = 0; input.y = 0;
}

joyZone.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  joyStart(t.clientX, t.clientY, t.identifier);
}, { passive: false });
joyZone.addEventListener("touchmove", (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) if (t.identifier === joyId) joyMove(t.clientX, t.clientY);
}, { passive: false });
window.addEventListener("touchend", (e) => {
  for (const t of e.changedTouches) if (t.identifier === joyId) joyEnd();
}, { passive: false });
window.addEventListener("touchcancel", () => joyEnd());

// Mouse fallback for the joystick (desktop testing)
joyZone.addEventListener("mousedown", (e) => { joyStart(e.clientX, e.clientY, "mouse"); });
window.addEventListener("mousemove", (e) => { if (joyId === "mouse") joyMove(e.clientX, e.clientY); });
window.addEventListener("mouseup", () => { if (joyId === "mouse") joyEnd(); });

/* =========================================================
   Entities
   ========================================================= */
class Bullet {
  constructor(x, y, vx, vy, r, color, dmg, fromPlayer) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.r = r; this.color = color; this.dmg = dmg;
    this.fromPlayer = fromPlayer; this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y < -20 || this.y > H + 20 || this.x < -20 || this.x > W + 20) this.dead = true;
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

class PowerUp {
  constructor(x, y, type) {
    this.x = x; this.y = y; this.type = type; this.r = 12;
    this.vy = 60; this.dead = false; this.t = 0;
  }
  update(dt) {
    this.t += dt;
    this.y += this.vy * dt;
    this.x += Math.sin(this.t * 3) * 20 * dt;
    if (this.y > H + 20) this.dead = true;
  }
  draw(ctx) {
    const colors = { shield: "#7CF9FF", rapid: "#FFD86B", multi: "#B98CFF", life: "#FF5C8A" };
    const glyphs = { shield: "S", rapid: "R", multi: "M", life: "+" };
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.t * 2);
    ctx.fillStyle = colors[this.type];
    ctx.shadowColor = colors[this.type];
    ctx.shadowBlur = 12;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rr = i % 2 === 0 ? this.r : this.r * 0.5;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#04121a";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(glyphs[this.type], this.x, this.y + 1);
  }
}

class Player {
  constructor() {
    this.x = W / 2; this.y = H * 0.75;
    this.r = 16;
    this.speed = 320;
    this.fireCooldown = 0;
    this.baseFireRate = 0.24;
    this.invuln = 0;
    this.shieldTimer = 0;
    this.rapidTimer = 0;
    this.multiTimer = 0;
    this.thrusterT = 0;
  }
  get fireRate() { return this.rapidTimer > 0 ? this.baseFireRate * 0.45 : this.baseFireRate; }

  update(dt) {
    const kv = keyboardVector();
    const ix = clamp(input.x + kv.x, -1, 1);
    const iy = clamp(input.y + kv.y, -1, 1);
    const len = Math.hypot(ix, iy);
    const nx = len > 1 ? ix / len : ix;
    const ny = len > 1 ? iy / len : iy;

    this.x = clamp(this.x + nx * this.speed * dt, this.r + 4, W - this.r - 4);
    this.y = clamp(this.y + ny * this.speed * dt, H * 0.12, H - this.r - 8);

    this.thrusterT += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.shieldTimer > 0) this.shieldTimer -= dt;
    if (this.rapidTimer > 0) this.rapidTimer -= dt;
    if (this.multiTimer > 0) this.multiTimer -= dt;

    // Auto-fire, unlimited — always shooting as fast as the current fire rate allows.
    this.fireCooldown -= dt;
    if (this.fireCooldown <= 0) {
      this.shoot();
      this.fireCooldown = this.fireRate;
    }
  }

  shoot() {
    const speed = 620;
    const spread = this.multiTimer > 0 ? [-0.28, 0, 0.28] : [0];
    for (const a of spread) {
      bullets.push(new Bullet(
        this.x + Math.sin(a) * 6, this.y - 18,
        Math.sin(a) * speed, -Math.cos(a) * speed,
        4, "#7CF9FF", 1, true
      ));
    }
  }

  hit() {
    if (this.invuln > 0) return false;
    if (this.shieldTimer > 0) { this.shieldTimer = 0; this.invuln = 0.6; burst(this.x, this.y, "#7CF9FF", 16); return false; }
    this.invuln = 1.4;
    return true;
  }

  draw(ctx) {
    if (this.invuln > 0 && Math.floor(this.invuln * 14) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    // thruster flame
    const flameLen = 10 + Math.sin(this.thrusterT * 20) * 4;
    ctx.fillStyle = "rgba(124,249,255,0.7)";
    ctx.beginPath();
    ctx.moveTo(-6, 14);
    ctx.lineTo(0, 14 + flameLen);
    ctx.lineTo(6, 14);
    ctx.closePath();
    ctx.fill();

    // ship body
    ctx.fillStyle = "#e8f6ff";
    ctx.shadowColor = "#7CF9FF";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(14, 14);
    ctx.lineTo(0, 8);
    ctx.lineTo(-14, 14);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    if (this.shieldTimer > 0) {
      ctx.strokeStyle = "rgba(124,249,255,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

const ENEMY_TYPES = {
  drifter:  { hp: 2, r: 14, speed: 90,  score: 10, color: "#FF5C8A" },
  zigzag:   { hp: 3, r: 14, speed: 110, score: 15, color: "#FFD86B" },
  shooter:  { hp: 4, r: 16, speed: 60,  score: 25, color: "#B98CFF" },
  charger:  { hp: 3, r: 13, speed: 70,  score: 20, color: "#FF884D" },
};

class Enemy {
  constructor(type, x, y, waveScale) {
    const def = ENEMY_TYPES[type];
    this.type = type;
    this.x = x; this.y = y;
    this.r = def.r;
    this.hp = Math.ceil(def.hp * waveScale);
    this.maxHp = this.hp;
    this.speed = def.speed;
    this.scoreValue = def.score;
    this.color = def.color;
    this.t = rand(0, 10);
    this.shootCd = rand(1, 2.2);
    this.chargeTarget = null;
    this.dead = false;
    this.flash = 0;
  }
  update(dt, playerRef) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;

    if (this.type === "drifter") {
      this.y += this.speed * dt;
    } else if (this.type === "zigzag") {
      this.y += this.speed * dt;
      this.x += Math.sin(this.t * 3) * 90 * dt;
    } else if (this.type === "shooter") {
      if (this.y < H * 0.28) this.y += this.speed * dt;
      this.x += Math.sin(this.t * 1.5) * 40 * dt;
      this.shootCd -= dt;
      if (this.shootCd <= 0) {
        this.shootCd = rand(1.4, 2.4);
        const ang = Math.atan2(playerRef.y - this.y, playerRef.x - this.x);
        bullets.push(new Bullet(this.x, this.y, Math.cos(ang) * 220, Math.sin(ang) * 220, 5, "#B98CFF", 1, false));
      }
    } else if (this.type === "charger") {
      if (!this.chargeTarget && this.y > H * 0.2) {
        this.chargeTarget = { x: playerRef.x, y: playerRef.y };
      }
      if (this.chargeTarget) {
        const ang = Math.atan2(this.chargeTarget.y - this.y, this.chargeTarget.x - this.x);
        this.x += Math.cos(ang) * this.speed * 2.2 * dt;
        this.y += Math.sin(ang) * this.speed * 2.2 * dt;
      } else {
        this.y += this.speed * dt;
      }
    }

    this.x = clamp(this.x, this.r, W - this.r);
    if (this.y > H + 40) this.dead = true;
  }
  takeDamage(dmg) {
    this.hp -= dmg;
    this.flash = 0.08;
    if (this.hp <= 0) { this.dead = true; return true; }
    return false;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = this.flash > 0 ? "#ffffff" : this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, this.r);
    ctx.lineTo(this.r, -this.r * 0.6);
    ctx.lineTo(0, -this.r * 0.1);
    ctx.lineTo(-this.r, -this.r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    if (this.hp < this.maxHp) {
      const w = this.r * 2;
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(-w / 2, -this.r - 10, w, 3);
      ctx.fillStyle = "#7CF9FF";
      ctx.fillRect(-w / 2, -this.r - 10, w * clamp(this.hp / this.maxHp, 0, 1), 3);
    }
    ctx.restore();
  }
}

class Boss {
  constructor(waveScale) {
    this.x = W / 2; this.y = -80;
    this.r = 42;
    this.maxHp = Math.ceil(70 * waveScale);
    this.hp = this.maxHp;
    this.speed = 90;
    this.t = 0;
    this.shootCd = 1;
    this.entering = true;
    this.dead = false;
    this.flash = 0;
  }
  update(dt, playerRef) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.entering) {
      this.y += 60 * dt;
      if (this.y >= H * 0.18) this.entering = false;
      return;
    }
    this.x = W / 2 + Math.sin(this.t * 0.7) * (W / 2 - this.r - 20);
    this.shootCd -= dt;
    if (this.shootCd <= 0) {
      this.shootCd = 0.55;
      for (let i = -2; i <= 2; i++) {
        const ang = Math.atan2(playerRef.y - this.y, playerRef.x - this.x) + i * 0.18;
        bullets.push(new Bullet(this.x, this.y + this.r * 0.5, Math.cos(ang) * 240, Math.sin(ang) * 240, 6, "#FF5C8A", 1, false));
      }
    }
  }
  takeDamage(dmg) {
    if (this.entering) return false;
    this.hp -= dmg;
    this.flash = 0.06;
    if (this.hp <= 0) { this.dead = true; return true; }
    return false;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = this.flash > 0 ? "#ffffff" : "#FF5C8A";
    ctx.shadowColor = "#FF5C8A";
    ctx.shadowBlur = 22;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = i % 2 === 0 ? this.r : this.r * 0.62;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    const w = 180;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(W / 2 - w / 2, 14, w, 6);
    ctx.fillStyle = "#FF5C8A";
    ctx.fillRect(W / 2 - w / 2, 14, w * clamp(this.hp / this.maxHp, 0, 1), 6);
  }
}

/* =========================================================
   Game state
   ========================================================= */
let bullets = [];
let enemies = [];
let powerUps = [];
let player = null;
let boss = null;

let score = 0;
let lives = 3;
let wave = 1;
const WAVE_ENEMIES_BASE = 6;
let spawnQueue = [];
let spawnTimer = 0;
let waveClearPause = 0;
let state = "menu"; // menu | playing | paused | gameover
let bgStars = [];

function initStars() {
  bgStars = [];
  for (let i = 0; i < 90; i++) {
    bgStars.push({ x: rand(0, W), y: rand(0, H), s: rand(0.6, 2.2), sp: rand(20, 90) });
  }
}
initStars();
window.addEventListener("resize", initStars);

function buildWaveQueue(n) {
  const types = ["drifter", "drifter", "zigzag"];
  if (wave >= 2) types.push("charger");
  if (wave >= 3) types.push("shooter");
  const q = [];
  for (let i = 0; i < n; i++) q.push(types[randInt(0, types.length - 1)]);
  return q;
}

function startWave() {
  const isBossWave = wave % 5 === 0;
  document.getElementById("hud-wave").textContent = "WAVE " + wave;
  showWaveBanner(isBossWave ? `BOSS WAVE` : `WAVE ${wave}`);

  if (isBossWave) {
    boss = new Boss(1 + wave * 0.06);
    spawnQueue = [];
  } else {
    boss = null;
    const count = WAVE_ENEMIES_BASE + Math.floor(wave * 1.6);
    spawnQueue = buildWaveQueue(count);
  }
  spawnTimer = 0.4;
}

function showWaveBanner(text) {
  const el = document.getElementById("wave-banner");
  el.textContent = text;
  el.classList.remove("hidden");
  void el.offsetWidth; // restart animation
  el.style.animation = "none";
  requestAnimationFrame(() => { el.style.animation = ""; });
}

function dropMaybePowerUp(x, y) {
  if (Math.random() < 0.14) {
    const roll = Math.random();
    let type = "shield";
    if (roll < 0.32) type = "rapid";
    else if (roll < 0.62) type = "multi";
    else if (roll < 0.72) type = "life";
    powerUps.push(new PowerUp(x, y, type));
  }
}

function applyPowerUp(type) {
  if (type === "shield") player.shieldTimer = 6;
  else if (type === "rapid") player.rapidTimer = 7;
  else if (type === "multi") player.multiTimer = 7;
  else if (type === "life") { lives = Math.min(lives + 1, 5); updateLivesHud(); }
}

function updateLivesHud() {
  const container = document.getElementById("hud-lives");
  while (container.children.length < Math.max(lives, 3)) {
    const span = document.createElement("span");
    span.className = "life";
    container.appendChild(span);
  }
  const all = document.querySelectorAll(".life");
  all.forEach((n, i) => n.classList.toggle("spent", i >= lives));
}

function resetGame() {
  bullets = []; enemies = []; powerUps = [];
  player = new Player();
  boss = null;
  score = 0; lives = 3; wave = 1;
  updateScoreHud();
  updateLivesHud();
  startWave();
}

function updateScoreHud() {
  document.getElementById("hud-score").textContent = "SCORE " + score;
}

/* =========================================================
   Collisions & spawning
   ========================================================= */
function update(dt) {
  if (state !== "playing") return;

  player.update(dt);

  // spawn queue drip-feed
  if (spawnQueue.length > 0) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const type = spawnQueue.shift();
      const x = rand(40, W - 40);
      enemies.push(new Enemy(type, x, -30, 1 + wave * 0.05));
      spawnTimer = clamp(0.9 - wave * 0.04, 0.28, 0.9);
    }
  }

  for (const b of bullets) b.update(dt);
  for (const e of enemies) e.update(dt, player);
  for (const p of powerUps) p.update(dt);
  if (boss) boss.update(dt, player);
  for (let i = particles.length - 1; i >= 0; i--) {
    if (!particles[i].update(dt)) particles.splice(i, 1);
  }

  // bullet vs enemy / boss
  for (const b of bullets) {
    if (b.dead || !b.fromPlayer) continue;
    for (const e of enemies) {
      if (e.dead) continue;
      if (circlesHit(b, e)) {
        b.dead = true;
        if (e.takeDamage(b.dmg)) {
          score += e.scoreValue;
          updateScoreHud();
          burst(e.x, e.y, e.color, 14);
          dropMaybePowerUp(e.x, e.y);
        }
        break;
      }
    }
    if (!b.dead && boss && !boss.dead && circlesHit(b, boss)) {
      b.dead = true;
      if (boss.takeDamage(b.dmg)) {
        score += 300;
        updateScoreHud();
        burst(boss.x, boss.y, "#FF5C8A", 40, 220, 0.8);
      }
    }
  }

  // bullet vs player
  for (const b of bullets) {
    if (b.dead || b.fromPlayer) continue;
    if (circlesHit(b, player)) {
      b.dead = true;
      if (player.hit()) onPlayerHit();
    }
  }

  // enemy vs player (collision damage)
  for (const e of enemies) {
    if (e.dead) continue;
    if (circlesHit(e, player)) {
      e.dead = true;
      burst(e.x, e.y, e.color, 10);
      if (player.hit()) onPlayerHit();
    }
  }
  if (boss && !boss.dead && circlesHit(boss, player)) {
    if (player.hit()) onPlayerHit();
  }

  // powerup vs player
  for (const p of powerUps) {
    if (p.dead) continue;
    if (circlesHit(p, player)) {
      p.dead = true;
      applyPowerUp(p.type);
    }
  }

  bullets = bullets.filter((b) => !b.dead);
  enemies = enemies.filter((e) => !e.dead);
  powerUps = powerUps.filter((p) => !p.dead);

  // wave clear check
  const waveEmpty = spawnQueue.length === 0 && enemies.length === 0 && (!boss || boss.dead);
  if (waveEmpty) {
    waveClearPause -= dt;
    if (waveClearPause <= 0 && waveClearPause > -900) {
      waveClearPause = -1000; // guard against re-trigger
      score += 50 + wave * 5;
      updateScoreHud();
      wave += 1;
      setTimeout(() => { if (state === "playing") { waveClearPause = 1.1; startWave(); } }, 900);
    }
  } else {
    waveClearPause = 1.1;
  }
}

function onPlayerHit() {
  lives -= 1;
  updateLivesHud();
  burst(player.x, player.y, "#7CF9FF", 26, 200, 0.7);
  if (lives <= 0) {
    endGame();
  }
}

function endGame() {
  state = "gameover";
  const best = Math.max(getBestScore(), score);
  setBestScore(best);
  document.getElementById("final-score").textContent = "Score: " + score;
  document.getElementById("best-score").textContent = "Best: " + best;
  show("gameover-screen");
}

/* =========================================================
   Rendering
   ========================================================= */
function render() {
  ctx.clearRect(0, 0, W, H);

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#0a0a16");
  grad.addColorStop(1, "#05050a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#ffffff";
  for (const s of bgStars) {
    ctx.globalAlpha = 0.5;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;

  if (state === "playing" || state === "paused") {
    for (const p of powerUps) p.draw(ctx);
    for (const e of enemies) e.draw(ctx);
    if (boss) boss.draw(ctx);
    for (const b of bullets) b.draw(ctx);
    for (const p of particles) p.draw(ctx);
    player.draw(ctx);
  }
}

function animateStars(dt) {
  for (const s of bgStars) {
    s.y += s.sp * dt;
    if (s.y > H) { s.y = -2; s.x = rand(0, W); }
  }
}

/* =========================================================
   Main loop
   ========================================================= */
let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;

  animateStars(dt);
  update(dt);
  render();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* =========================================================
   Screen management
   ========================================================= */
function show(id) {
  document.querySelectorAll(".overlay").forEach((el) => el.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}
function hideAllOverlays() {
  document.querySelectorAll(".overlay").forEach((el) => el.classList.add("hidden"));
}

document.getElementById("high-score-line").textContent = "Best: " + getBestScore();

document.getElementById("start-btn").addEventListener("click", () => {
  hideAllOverlays();
  resetGame();
  state = "playing";
});

document.getElementById("pause-btn").addEventListener("click", () => {
  if (state === "playing") {
    state = "paused";
    show("pause-screen");
  }
});
document.getElementById("resume-btn").addEventListener("click", () => {
  hideAllOverlays();
  state = "playing";
});
document.getElementById("restart-from-pause-btn").addEventListener("click", () => {
  hideAllOverlays();
  resetGame();
  state = "playing";
});
document.getElementById("restart-btn").addEventListener("click", () => {
  hideAllOverlays();
  resetGame();
  state = "playing";
});

})();
