const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const timeEl = document.getElementById("time");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const objectiveEl = document.getElementById("objective");
const startScreen = document.getElementById("startScreen");
const startBtn = document.getElementById("startBtn");
const messageEl = document.getElementById("message");

const W = canvas.width;
const H = canvas.height;

const levels = [
  {
    time: 60,
    player: { x: 75, y: 455 },
    exit: { x: 835, y: 55, w: 42, h: 58 },
    obstacles: [
      {x: 190,y: 80,w: 240,h: 28}, {x: 500,y: 80,w: 190,h: 28},
      {x: 100,y: 205,w: 210,h: 28}, {x: 380,y: 205,w: 250,h: 28},
      {x: 700,y: 205,w: 100,h: 28}, {x: 190,y: 330,w: 280,h: 28},
      {x: 560,y: 330,w: 190,h: 28}
    ],
    items: [
      {x:145,y:145,type:"book"}, {x:350,y:270,type:"coin"},
      {x:515,y:145,type:"coin"}, {x:730,y:390,type:"book"},
      {x:95,y:290,type:"coin"}
    ],
    teachers: [{x:450,y:145,dx:1.3,dy:0}, {x:800,y:285,dx:0,dy:1.1}]
  },
  {
    time: 55,
    player: { x: 65, y: 470 },
    exit: { x: 820, y: 40, w: 45, h: 60 },
    obstacles: [
      {x:130,y:65,w:30,h:180}, {x:130,y:310,w:30,h:150},
      {x:300,y:0,w:30,h:160}, {x:300,y:225,w:30,h:210},
      {x:480,y:80,w:30,h:180}, {x:480,y:330,w:30,h:190},
      {x:660,y:0,w:30,h:160}, {x:660,y:230,w:30,h:210},
      {x:0,y:120,w:75,h:25}, {x:735,y:150,w:165,h:25}
    ],
    items: [
      {x:220,y:280,type:"coin"}, {x:395,y:90,type:"book"},
      {x:570,y:285,type:"coin"}, {x:770,y:390,type:"book"},
      {x:220,y:455,type:"coin"}
    ],
    teachers: [{x:210,y:130,dx:0,dy:1.25}, {x:585,y:400,dx:1.2,dy:0}]
  },
  {
    time: 50,
    player: { x: 65, y: 455 },
    exit: { x: 820, y: 230, w: 45, h: 60 },
    obstacles: [
      {x:110,y:70,w:190,h:28}, {x:360,y:70,w:170,h:28},
      {x:600,y:70,w:200,h:28}, {x:0,y:180,w:220,h:28},
      {x:300,y:180,w:200,h:28}, {x:580,y:180,w:180,h:28},
      {x:80,y:300,w:250,h:28}, {x:410,y:300,w:250,h:28},
      {x:720,y:300,w:180,h:28}, {x:210,y:420,w:280,h:28}
    ],
    items: [
      {x:150,y:135,type:"book"}, {x:270,y:250,type:"coin"},
      {x:540,y:135,type:"coin"}, {x:700,y:250,type:"book"},
      {x:350,y:370,type:"coin"}, {x:760,y:430,type:"book"}
    ],
    teachers: [
      {x:400,y:130,dx:1.4,dy:0}, {x:720,y:250,dx:-1.2,dy:0},
      {x:520,y:370,dx:1.3,dy:0}
    ]
  }
];

let level = 0;
let score = 0;
let lives = 3;
let time = 60;
let running = false;
let lastTime = 0;
let timerAccumulator = 0;
let items = [];
let teachers = [];
let keys = {};

const player = {
  x: 0, y: 0, w: 24, h: 30, speed: 220, invincible: 0
};

startBtn.addEventListener("click", startGame);
window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
  if (["arrowup","arrowdown","arrowleft","arrowright"," "].includes(e.key.toLowerCase())) e.preventDefault();
  if (!running && e.key === "Enter") startGame();
});
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

function startGame() {
  level = 0;
  score = 0;
  lives = 3;
  loadLevel();
  running = true;
  startScreen.classList.add("hidden");
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function loadLevel() {
  const data = levels[level];
  player.x = data.player.x;
  player.y = data.player.y;
  player.invincible = 1.2;
  time = data.time;
  timerAccumulator = 0;
  items = data.items.map(i => ({...i, collected:false}));
  teachers = data.teachers.map(t => ({...t}));
  levelEl.textContent = level + 1;
  objectiveEl.textContent = "Colete itens e encontre a saída!";
  updateHUD();
}

function loop(now) {
  if (!running) return;
  const dt = Math.min((now - lastTime) / 1000, 0.035);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  timerAccumulator += dt;
  if (timerAccumulator >= 1) {
    const seconds = Math.floor(timerAccumulator);
    time -= seconds;
    timerAccumulator -= seconds;
    if (time <= 0) {
      time = 0;
      endGame(false, "O tempo acabou!");
      return;
    }
  }

  if (player.invincible > 0) player.invincible -= dt;

  let dx = 0, dy = 0;
  if (keys["arrowleft"] || keys["a"]) dx--;
  if (keys["arrowright"] || keys["d"]) dx++;
  if (keys["arrowup"] || keys["w"]) dy--;
  if (keys["arrowdown"] || keys["s"]) dy++;

  if (dx || dy) {
    const length = Math.hypot(dx, dy);
    dx /= length; dy /= length;
    movePlayer(dx * player.speed * dt, 0);
    movePlayer(0, dy * player.speed * dt);
  }

  teachers.forEach(t => {
    t.x += t.dx * dt * 60;
    t.y += t.dy * dt * 60;

    if (t.x < 35 || t.x > W - 35) t.dx *= -1;
    if (t.y < 45 || t.y > H - 45) t.dy *= -1;

    if (player.invincible <= 0 && rectsOverlap(player, {x:t.x-14,y:t.y-14,w:28,h:28})) {
      hitTeacher();
    }
  });

  items.forEach(item => {
    if (!item.collected && distance(player.x+12, player.y+15, item.x, item.y) < 28) {
      item.collected = true;
      score += item.type === "coin" ? 100 : 150;
      showMessage(item.type === "coin" ? "+100 pontos!" : "+150 pontos!");
    }
  });

  const ex = levels[level].exit;
  if (rectsOverlap(player, ex)) nextLevel();
  updateHUD();
}

function movePlayer(mx, my) {
  const next = {x:player.x+mx, y:player.y+my, w:player.w, h:player.h};
  if (next.x < 18 || next.x + next.w > W - 18) return;
  if (next.y < 18 || next.y + next.h > H - 18) return;

  const blocked = levels[level].obstacles.some(o => rectsOverlap(next, o));
  if (!blocked) {
    player.x += mx;
    player.y += my;
  }
}

function hitTeacher() {
  lives--;
  player.invincible = 1.6;
  score = Math.max(0, score - 100);
  showMessage("Fantasma! -1 vida");
  if (lives <= 0) {
    endGame(false, "Você ficou sem vidas!");
    return;
  }
  player.x = levels[level].player.x;
  player.y = levels[level].player.y;
}

function nextLevel() {
  if (level === levels.length - 1) {
    endGame(true, "Você escapou da prova!");
    return;
  }
  score += 300;
  level++;
  loadLevel();
  showMessage("Fase " + (level + 1) + "!");
}

function endGame(won, title) {
  running = false;
  draw();
  setTimeout(() => {
    startScreen.classList.remove("hidden");
    startScreen.querySelector("h2").textContent = won ? "Você conseguiu!" : title;
    startScreen.querySelector("p").innerHTML =
      (won ? "Parabéns! Você passou pelas 3 fases." : "Tente novamente e melhore sua pontuação.") +
      "<br><br><strong>Pontuação: " + score + "</strong>";
    startBtn.textContent = "JOGAR NOVAMENTE";
    startScreen.querySelector("small").textContent = "Dica: use as paredes para desviar dos fantasmas.";
  }, 250);
}

function updateHUD() {
  scoreEl.textContent = score;
  timeEl.textContent = time;
  livesEl.textContent = "♥".repeat(lives) + "♡".repeat(3 - lives);
}

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.classList.remove("hidden");
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => messageEl.classList.add("hidden"), 900);
}

function distance(x1,y1,x2,y2) {
  return Math.hypot(x1-x2, y1-y2);
}

function rectsOverlap(a,b) {
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}

function draw() {
  const data = levels[level];

  // floor
  ctx.fillStyle = "#111a2c";
  ctx.fillRect(0,0,W,H);

  // tiles
  for (let y=0; y<H; y+=40) {
    for (let x=0; x<W; x+=40) {
      ctx.fillStyle = ((x/40 + y/40) % 2 === 0) ? "#131f33" : "#15243a";
      ctx.fillRect(x,y,40,40);
    }
  }

  // subtle school markings
  ctx.fillStyle = "#263653";
  ctx.font = "bold 12px Arial";
  ctx.fillText("CORREDOR", 25, 35);

  // obstacles
  data.obstacles.forEach(o => {
    ctx.fillStyle = "#283a59";
    roundRect(o.x,o.y,o.w,o.h,6,true);
    ctx.fillStyle = "#3a4f72";
    ctx.fillRect(o.x, o.y, o.w, 5);
  });

  // exit
  const e = data.exit;
  ctx.fillStyle = "#56d68b";
  roundRect(e.x,e.y,e.w,e.h,9,true);
  ctx.fillStyle = "#d9ffe8";
  ctx.font = "bold 10px Arial";
  ctx.textAlign = "center";
  ctx.fillText("SAÍDA", e.x+e.w/2, e.y+e.h/2+4);
  ctx.textAlign = "left";

  // items
  items.forEach(item => {
    if (item.collected) return;
    if (item.type === "coin") drawCoin(item.x,item.y);
    else drawBook(item.x,item.y);
  });

  // teachers
  teachers.forEach(t => drawTeacher(t.x,t.y));

  // player
  if (player.invincible <= 0 || Math.floor(player.invincible * 10) % 2 === 0) {
    drawPlayer(player.x, player.y);
  }
}

function drawPlayer(x,y) {
  // shadow
  ctx.fillStyle = "#0005";
  ctx.beginPath();
  ctx.ellipse(x+12,y+31,14,5,0,0,Math.PI*2);
  ctx.fill();

  // body
  ctx.fillStyle = "#5da9ff";
  roundRect(x+3,y+11,18,17,5,true);
  // head
  ctx.fillStyle = "#f0b58d";
  ctx.beginPath();
  ctx.arc(x+12,y+8,8,0,Math.PI*2);
  ctx.fill();
  // hair
  ctx.fillStyle = "#2b2130";
  ctx.beginPath();
  ctx.arc(x+12,y+6,8,Math.PI,Math.PI*2);
  ctx.fill();
  // backpack
  ctx.fillStyle = "#ffd166";
  roundRect(x-1,y+12,5,13,3,true);
  // legs
  ctx.fillStyle = "#263452";
  ctx.fillRect(x+5,y+27,5,5);
  ctx.fillRect(x+14,y+27,5,5);
}

function drawTeacher(x,y) {
  ctx.fillStyle = "#0005";
  ctx.beginPath();
  ctx.ellipse(x,y+17,16,5,0,0,Math.PI*2);
  ctx.fill();

  ctx.fillStyle = "#ff647c";
  roundRect(x-12,y+1,24,18,6,true);
  ctx.fillStyle = "#e9ad83";
  ctx.beginPath();
  ctx.arc(x,y-2,8,0,Math.PI*2);
  ctx.fill();
  ctx.fillStyle = "#242033";
  ctx.beginPath();
  ctx.arc(x,y-5,8,Math.PI,Math.PI*2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 10px Arial";
  ctx.textAlign = "center";
  ctx.fillText("!",x,y+13);
  ctx.textAlign = "left";
}

function drawCoin(x,y) {
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.arc(x,y,10,0,Math.PI*2);
  ctx.fill();
  ctx.fillStyle = "#9b6d00";
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.fillText("$",x,y+4);
  ctx.textAlign = "left";
}

function drawBook(x,y) {
  ctx.fillStyle = "#9d7cff";
  roundRect(x-11,y-8,22,17,3,true);
  ctx.fillStyle = "#e9e3ff";
  ctx.fillRect(x-2,y-7,2,15);
  ctx.fillStyle = "#6b4bc1";
  ctx.fillRect(x-8,y-4,4,2);
  ctx.fillRect(x+4,y-4,4,2);
}

function roundRect(x,y,w,h,r,fill) {
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  if (fill) ctx.fill();
}

draw();