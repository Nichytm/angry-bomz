function createArcade(effect) {
  const panel = document.getElementById('arcade');
  const list = document.getElementById('arcade-list');
  const play = document.getElementById('arcade-play');
  const canvas = document.getElementById('arcade-field');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('arcade-overlay');
  const title = document.getElementById('arcade-title');
  const result = document.getElementById('arcade-result');
  const summary = document.getElementById('arcade-summary');
  const start = document.getElementById('arcade-start');
  const help = document.getElementById('arcade-help');
  const controls = document.getElementById('arcade-controls');
  const first = document.getElementById('arcade-first');
  const second = document.getElementById('arcade-second');
  const [leftHud, rightHud] = document.getElementById('arcade-hud').children;
  const width = 480;
  const height = 520;
  canvas.width = width * 2;
  canvas.height = height * 2;
  ctx.scale(2, 2);

  const portraits = [6, 5, 4].map(index => {
    const image = new Image();
    image.src = `assets/friend${index}.webp`;
    return image;
  });
  const ink = '#eaf1ea';
  const lime = '#dcfa59';
  const pink = '#ff6485';
  const amber = '#ffc063';
  const aqua = '#65e9d8';
  const keys = new Set();
  const pointer = { id: null, x: width / 2, y: height - 70 };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const config = {
    roofs: {
      title: 'Крыши',
      summary: 'Разгоняйся по крышам, собирай монеты и выбирай, когда прыгнуть, а когда проскользнуть.',
      help: 'Тап по полю или пробел — прыжок. Зажми «Скольжение», чтобы проехать под трубой.',
      buttons: ['Прыжок', 'Скольжение'],
      create: roofs
    },
    heist: {
      title: 'Налёт',
      summary: 'Вынеси добычу с трёх складов. Чем больше забрал, тем активнее охрана.',
      help: 'Веди пальцем или стрелками. Рывок помогает вырваться из окружения.',
      buttons: ['Рывок'],
      create: heist
    },
    boss: {
      title: 'Босс двора',
      summary: 'Босс меняет залпы по ходу боя. Сломай щит, чтобы открыть окно для атаки.',
      help: 'Двигайся пальцем или стрелками. Выстрелы автоматические. Используй импульс, чтобы разбить залп.',
      buttons: ['Импульс'],
      create: boss
    }
  };
  let selected;
  let game;
  let running = false;
  let frame;
  let lastFrame;
  let sliding = false;

  function box(x, y, w, h, color, radius = 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
  }
  function circle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  function text(label, x, y, color = ink, size = 18) {
    ctx.font = `800 ${size}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(label, x, y);
  }
  function face(image, x, y, r, color) {
    circle(x, y, r + 3, color);
    if (!image.complete || !image.naturalWidth) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(image, x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
  function gem(x, y, color, size = 9) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    box(-size, -size, size * 2, size * 2, color, 3);
    box(-size + 3, -size + 3, size - 2, 3, '#fff6ce', 1);
    ctx.restore();
  }
  function grid(background, line) {
    box(0, 0, width, height, background);
    for (let x = 0; x < width; x += 40) box(x, 0, 1, height, line);
    for (let y = 0; y < height; y += 40) box(0, y, width, 1, line);
  }
  function hud(left, right) {
    if (leftHud.textContent !== left) leftHud.textContent = left;
    if (rightHud.textContent !== right) rightHud.textContent = right;
  }
  function secondary(buttonReady, label) {
    first.disabled = !buttonReady;
    if (first.textContent !== label) first.textContent = label;
  }
  function releasePointer() {
    const id = pointer.id;
    pointer.id = null;
    if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(frame);
    releasePointer();
    keys.clear();
    sliding = false;
  }
  function showList() {
    stop();
    selected = null;
    game = null;
    list.hidden = false;
    play.hidden = true;
  }
  function bestScore(score) {
    const key = 'angry-bomz:v2:' + selected;
    try {
      const best = Math.max(score ?? 0, Number(localStorage.getItem(key)) || 0);
      if (score !== undefined) localStorage.setItem(key, best);
      return best;
    } catch {
      return score ?? 0;
    }
  }
  function finish(heading, detail, score, won = false) {
    stop();
    const best = bestScore(score);
    controls.hidden = true;
    help.hidden = true;
    overlay.hidden = false;
    result.textContent = heading;
    summary.textContent = `${detail} · Рекорд ${best}`;
    start.textContent = 'Ещё раз';
    if (won) effect(440, 570, 790);
    else effect(330, 200, 130);
  }
  function select(mode) {
    stop();
    selected = mode;
    const options = config[mode];
    list.hidden = true;
    play.hidden = false;
    controls.hidden = true;
    help.hidden = true;
    overlay.hidden = false;
    title.textContent = options.title;
    result.textContent = options.title;
    summary.textContent = options.summary;
    help.textContent = options.help;
    first.textContent = options.buttons[0];
    first.disabled = false;
    second.hidden = options.buttons.length < 2;
    second.textContent = options.buttons[1] ?? '';
    start.textContent = 'Начать';
    game = options.create();
    game.draw();
    hud('Рекорд ' + bestScore(), 'Готов к старту');
  }
  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.033, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    game.update(dt);
    game.draw();
    if (running) frame = requestAnimationFrame(loop);
  }
  start.onclick = () => {
    if (!selected || running) return;
    game = config[selected].create();
    overlay.hidden = true;
    controls.hidden = false;
    help.hidden = false;
    running = true;
    first.disabled = false;
    lastFrame = performance.now();
    frame = requestAnimationFrame(loop);
    effect(360, 540);
  };
  for (const card of list.querySelectorAll('button')) card.onclick = () => select(card.dataset.game);
  document.getElementById('arcade-back').onclick = showList;
  first.onclick = () => { if (running) game.action(); };
  function startSlide(event) {
    if (!running || event.button !== 0) return;
    second.setPointerCapture(event.pointerId);
    sliding = true;
  }
  second.addEventListener('pointerdown', startSlide);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) {
    second.addEventListener(type, () => { sliding = false; });
  }
  second.addEventListener('keydown', event => { if (event.key === ' ' || event.key === 'Enter') sliding = true; });
  second.addEventListener('keyup', () => { sliding = false; });
  function track(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = (event.clientX - rect.left) * width / rect.width;
    pointer.y = (event.clientY - rect.top) * height / rect.height;
  }
  canvas.addEventListener('pointerdown', event => {
    if (!running || !event.isPrimary || event.button !== 0) return;
    if (selected === 'roofs') { game.action(); return; }
    track(event);
    pointer.id = event.pointerId;
    canvas.setPointerCapture(pointer.id);
  });
  canvas.addEventListener('pointermove', event => { if (event.pointerId === pointer.id) track(event); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => { if (event.pointerId === pointer.id) releasePointer(); });
  }
  document.addEventListener('keydown', event => {
    if (!running || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) return;
    if (event.key === ' ' && event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    keys.add(event.key);
    if (!event.repeat && (event.key === ' ' || selected === 'roofs' && event.key === 'ArrowUp')) game.action();
  });
  document.addEventListener('keyup', event => keys.delete(event.key));
  window.addEventListener('blur', () => {
    releasePointer();
    keys.clear();
    sliding = false;
  });

  function movePlayer(player, dt, speed, minY, maxY) {
    const dx = Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
    const dy = Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp'));
    let targetX = player.x + dx * speed * dt;
    let targetY = player.y + dy * speed * dt;
    if (pointer.id !== null) {
      const x = pointer.x - player.x;
      const y = clamp(pointer.y - 17, minY, maxY) - player.y;
      const step = Math.min(1, speed * dt / (Math.hypot(x, y) || 1));
      targetX = player.x + x * step;
      targetY = player.y + y * step;
    }
    player.x = clamp(targetX, 22, width - 22);
    player.y = clamp(targetY, minY, maxY);
  }

  function roofs() {
    const ground = 405;
    const playerX = 104;
    const obstacles = [];
    const coins = [];
    const skyline = Array.from({ length: 14 }, (_, index) => ({
      x: index * 54, h: 56 + (index * 47 % 108)
    }));
    let heightAbove = 0;
    let velocity = 0;
    let grounded = true;
    let travelled = 0;
    let next = 370;
    let coinsTaken = 0;
    let obstacleIndex = 0;
    let duck = false;
    let fall = false;
    function action() {
      if (!grounded || fall) return;
      grounded = false;
      velocity = 470;
      effect(420, 620);
    }
    function update(dt) {
      const speed = Math.min(435, 212 + travelled / 52);
      if (!fall) travelled += speed * dt;
      if (travelled + width > next) {
        const type = ['crate', 'pipe', 'gap', 'crate', 'gap', 'pipe'][obstacleIndex % 6];
        const w = type === 'gap' ? 94 + Math.min(42, obstacleIndex * 3) : 48;
        obstacles.push({ type, x: next, w });
        for (let i = 0; i < 3; i++) coins.push({ x: next - 18 + i * 32, y: ground - (type === 'pipe' ? 21 : 99) });
        next += 305 + (obstacleIndex % 3) * 18;
        obstacleIndex++;
      }
      while (obstacles.length && obstacles[0].x + obstacles[0].w < travelled - 30) obstacles.shift();
      while (coins.length && coins[0].x < travelled - 30) coins.shift();
      const worldX = travelled + playerX;
      const gap = obstacles.some(o => o.type === 'gap' && worldX > o.x + 7 && worldX < o.x + o.w - 7);
      if (grounded && gap) { grounded = false; fall = true; }
      if (!grounded) {
        heightAbove += velocity * dt;
        velocity -= 1060 * dt;
        if (heightAbove <= 0 && velocity < 0) {
          if (gap) fall = true;
          if (!fall) { heightAbove = 0; velocity = 0; grounded = true; }
        }
      }
      duck = grounded && (sliding || keys.has('ArrowDown'));
      const feet = ground - heightAbove;
      const head = feet - (duck ? 23 : 49);
      const score = Math.floor(travelled / 10) + coinsTaken * 15;
      if (fall && feet > height + 35) { finish('Сорвался с крыши', `Очки ${score}`, score); return; }
      for (const o of obstacles) {
        if (o.type === 'gap' || worldX + 13 < o.x || worldX - 12 > o.x + o.w) continue;
        if (o.type === 'crate' && feet > ground - 43 || o.type === 'pipe' && head < ground - 31 && feet > ground - 126) {
          finish(o.type === 'crate' ? 'Врезался в ящик' : 'Попался на трубе', `Очки ${score}`, score);
          return;
        }
      }
      for (const coin of coins) {
        if (coin.taken || Math.abs(worldX - coin.x) > 19 || coin.y < head - 12 || coin.y > feet + 8) continue;
        coin.taken = true;
        coinsTaken++;
        effect(780);
      }
      hud(`Очки ${score}`, `Монеты ${coinsTaken}`);
    }
    function draw() {
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, '#24203a');
      sky.addColorStop(1, '#d47855');
      box(0, 0, width, height, sky);
      circle(343, 129, 59, '#ffb272');
      for (const [index, building] of skyline.entries()) {
        const x = ((building.x - travelled * .23) % 756 + 756) % 756 - 65;
        const y = ground - building.h;
        box(x, y, 48, building.h + 16, index % 2 ? '#47334b' : '#583949');
        for (let row = y + 13; row < ground - 6; row += 20) {
          box(x + 8, row, 6, 5, '#ab7971');
          if (index % 3) box(x + 27, row, 6, 5, '#e7a174');
        }
      }
      let edge = 0;
      for (const gap of obstacles.filter(o => o.type === 'gap')) {
        const startX = clamp(gap.x - travelled, 0, width);
        const endX = clamp(gap.x + gap.w - travelled, 0, width);
        if (startX > edge) drawRoof(edge, startX);
        edge = Math.max(edge, endX);
      }
      drawRoof(edge, width);
      for (const o of obstacles) {
        const x = o.x - travelled;
        if (o.type === 'crate') {
          box(x, ground - 43, o.w, 43, '#b86640', 5);
          box(x + 5, ground - 36, o.w - 10, 5, amber, 2);
          box(x + 5, ground - 14, o.w - 10, 4, '#6d4139', 2);
        }
        if (o.type === 'pipe') {
          box(x + 7, ground - 122, 9, 78, '#544854');
          box(x, ground - 52, o.w, 21, '#b7c8c4', 7);
          box(x + 12, ground - 53, 6, 23, '#667b81', 2);
        }
      }
      for (const coin of coins) if (!coin.taken) gem(coin.x - travelled, coin.y, amber, 7);
      const feet = ground - heightAbove;
      box(playerX - 16, feet - (duck ? 12 : 26), duck ? 38 : 32, duck ? 11 : 21, aqua, 6);
      if (!duck) {
        const stride = grounded ? Math.sin(travelled / 7) * 11 : 7;
        box(playerX - 11 + stride, feet - 10, 10, 10, '#263943', 3);
        box(playerX + 3 - stride, feet - 10, 10, 10, '#263943', 3);
      }
      face(portraits[0], playerX + (duck ? 11 : 0), feet - (duck ? 16 : 37), duck ? 13 : 18, amber);
    }
    function drawRoof(from, to) {
      if (to <= from) return;
      box(from, ground, to - from, height - ground, '#2e293d');
      box(from, ground, to - from, 9, '#f3a975');
      box(from, ground + 18, to - from, 2, '#755260');
    }
    return { action, update, draw };
  }

  function heist() {
    const player = { x: 240, y: 465 };
    const exit = { x: 240, y: 45 };
    const rooms = [
      [[85, 390], [395, 390], [235, 245], [98, 135], [385, 135]],
      [[75, 425], [408, 426], [240, 335], [104, 227], [370, 214], [240, 110]],
      [[76, 424], [390, 411], [243, 384], [98, 310], [380, 277], [233, 216], [91, 132], [387, 133]]
    ];
    let room = 0;
    let loot = [];
    let guards = [];
    let health = 3;
    let cooldown = 0;
    let dash = 0;
    let grace = 0;
    let score = 0;
    let elapsed = 0;
    function loadRoom() {
      player.x = 240;
      player.y = 465;
      loot = rooms[room].map(([x, y]) => ({ x, y, taken: false }));
      guards = Array.from({ length: room + 2 }, (_, i) => ({
        x: 80 + i * (320 / (room + 1)), y: 73 + (i % 2) * 70, phase: i * 2.7
      }));
      grace = .6;
      releasePointer();
    }
    loadRoom();
    function action() {
      if (cooldown > 0) return;
      cooldown = 3.4;
      dash = .42;
      effect(310, 570);
    }
    function update(dt) {
      elapsed += dt;
      cooldown = Math.max(0, cooldown - dt);
      grace = Math.max(0, grace - dt);
      dash = Math.max(0, dash - dt);
      movePlayer(player, dt, dash > 0 ? 610 : 305, 28, height - 25);
      for (const item of loot) {
        if (!item.taken && distance(item, player) < 32) {
          item.taken = true;
          score += 100;
          effect(570, 740);
        }
      }
      const remaining = loot.filter(item => !item.taken).length;
      for (const guard of guards) {
        const aware = distance(guard, player) < 137 || remaining <= Math.ceil(loot.length / 2);
        const patrolX = width / 2 + Math.sin(elapsed * .9 + guard.phase) * 175;
        const patrolY = 205 + Math.cos(elapsed * .7 + guard.phase) * 112;
        const x = (aware ? player.x : patrolX) - guard.x;
        const y = (aware ? player.y : patrolY) - guard.y;
        guard.angle = Math.atan2(y, x);
        const progress = Math.min(1, (aware ? 117 + room * 23 : 86) * dt / (Math.hypot(x, y) || 1));
        guard.x += x * progress;
        guard.y += y * progress;
        if (distance(guard, player) < 31 && dash <= 0 && grace <= 0) {
          health--;
          if (health <= 0) { finish('Охрана догнала', `Добыча ${score}`, score); return; }
          grace = 1.3;
          effect(205, 160);
        }
      }
      if (remaining === 0 && distance(exit, player) < 41) {
        score += 350 + health * 50;
        room++;
        if (room === rooms.length) { finish('Добыча вывезена', `Очки ${score}`, score, true); return; }
        loadRoom();
        effect(480, 660, 825);
      }
      hud(`Склад ${room + 1}/3 · Жизни ${health}`, remaining ? `Добыча ${remaining}` : 'Выход открыт');
      secondary(cooldown === 0, cooldown ? `Рывок · ${Math.ceil(cooldown)} с` : 'Рывок');
    }
    function draw() {
      grid('#163438', '#23484b');
      box(14, 14, width - 28, height - 28, 'rgba(70,131,126,.09)', 22);
      const open = loot.every(item => item.taken);
      box(exit.x - 50, 19, 100, 51, open ? '#638249' : '#304b4f', 10);
      text(open ? 'ОТКРЫТО' : 'ВЫХОД', exit.x, 50, open ? lime : ink, 14);
      for (const item of loot) {
        if (!item.taken) {
          circle(item.x, item.y, 21, 'rgba(255,210,127,.13)');
          gem(item.x, item.y, amber, 9);
        }
      }
      for (const guard of guards) {
        const angle = guard.angle ?? 0;
        ctx.fillStyle = 'rgba(255,132,112,.20)';
        ctx.beginPath();
        ctx.moveTo(guard.x, guard.y);
        ctx.arc(guard.x, guard.y, 86, angle - .39, angle + .39);
        ctx.closePath();
        ctx.fill();
        circle(guard.x, guard.y, 16, '#b45656');
        box(guard.x - 9, guard.y - 5, 18, 8, '#38252f', 3);
        circle(guard.x + Math.cos(angle) * 11, guard.y + Math.sin(angle) * 11, 4, pink);
      }
      if (grace <= 0 || Math.floor(elapsed * 12) % 2 === 0) {
        face(portraits[1], player.x, player.y, 20, dash ? lime : aqua);
      }
    }
    return { action, draw, update };
  }

  function boss() {
    const player = { x: 240, y: 455 };
    const enemy = { x: 240, y: 103 };
    const maxHp = 58;
    const attacks = [];
    const shots = [];
    let shield = 12;
    let hp = maxHp;
    let health = 4;
    let elapsed = 0;
    let fireIn = .15;
    let volleyIn = .7;
    let cooldown = 0;
    let grace = 0;
    let pulse = 0;
    let vulnerable = 0;
    let volleys = 0;
    let flash = 0;
    function action() {
      if (cooldown > 0) return;
      cooldown = 4.7;
      pulse = .45;
      grace = Math.max(grace, .48);
      for (let i = attacks.length - 1; i >= 0; i--) {
        if (distance(attacks[i], player) < 144) attacks.splice(i, 1);
      }
      effect(300, 550, 900);
    }
    function volley(phase) {
      const aim = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      const pattern = phase === 3 && volleys % 2 ? [-.58, -.42, -.26, -.1, .1, .26, .42, .58] :
        phase >= 2 ? [-.46, -.23, 0, .23, .46] : [-.3, 0, .3];
      for (const offset of pattern) {
        const angle = aim + offset;
        const speed = 158 + phase * 39;
        attacks.push({ x: enemy.x, y: enemy.y + 30, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
      }
      volleys++;
    }
    function update(dt) {
      elapsed += dt;
      grace = Math.max(0, grace - dt);
      cooldown = Math.max(0, cooldown - dt);
      pulse = Math.max(0, pulse - dt);
      flash = Math.max(0, flash - dt);
      if (vulnerable > 0) {
        vulnerable = Math.max(0, vulnerable - dt);
        if (vulnerable === 0) shield = hp > 20 ? 10 : 7;
      }
      const phase = hp > 38 ? 1 : hp > 19 ? 2 : 3;
      enemy.x = 240 + Math.sin(elapsed * (phase === 3 ? 2.1 : 1.35)) * 132;
      movePlayer(player, dt, 410, 250, height - 28);
      fireIn -= dt;
      if (fireIn <= 0) {
        fireIn += .16;
        shots.push({ x: player.x, y: player.y - 19 });
      }
      volleyIn -= dt;
      if (volleyIn <= 0) {
        volleyIn += 1.17 - phase * .16;
        volley(phase);
      }
      for (let i = shots.length - 1; i >= 0; i--) {
        const shot = shots[i];
        shot.y -= 610 * dt;
        if (distance(shot, enemy) < 42) {
          shots.splice(i, 1);
          flash = .1;
          if (shield > 0) {
            shield--;
            if (shield === 0) { vulnerable = 6.5; effect(680, 410); }
          } else {
            hp--;
            if (hp === 0) {
              const score = Math.max(100, 3600 - Math.floor(elapsed * 21) + health * 130);
              finish('Босс повержен', `Очки ${score}`, score, true);
              return;
            }
          }
        } else if (shot.y < -20) shots.splice(i, 1);
      }
      for (let i = attacks.length - 1; i >= 0; i--) {
        const attack = attacks[i];
        attack.x += attack.vx * dt;
        attack.y += attack.vy * dt;
        if (distance(attack, player) < 24) {
          attacks.splice(i, 1);
          if (grace <= 0) {
            health--;
            grace = 1.05;
            effect(230, 150);
            if (health <= 0) { finish('Босс удержал двор', `Очки ${(maxHp - hp) * 35}`, (maxHp - hp) * 35); return; }
          }
        } else if (attack.x < -20 || attack.x > width + 20 || attack.y > height + 20) attacks.splice(i, 1);
      }
      hud(`Жизни ${health} · Фаза ${phase}/3`, shield ? `Щит ${shield}` : `Окно атаки ${Math.ceil(vulnerable)} с`);
      secondary(cooldown === 0, cooldown ? `Импульс · ${Math.ceil(cooldown)} с` : 'Импульс');
    }
    function draw() {
      grid('#272238', '#38304d');
      box(20, 48, width - 40, height - 68, 'rgba(210,130,231,.035)', 24);
      box(38, 22, width - 76, 12, '#4d3d56', 6);
      box(38, 22, (width - 76) * hp / maxHp, 12, pink, 6);
      circle(enemy.x, enemy.y, 52, shield ? '#674770' : '#703d58');
      if (shield) {
        ctx.strokeStyle = flash ? ink : '#cba7fd';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, 53, 0, Math.PI * 2);
        ctx.stroke();
      }
      face(portraits[2], enemy.x, enemy.y, 38, flash ? ink : pink);
      for (const shot of shots) box(shot.x - 3, shot.y - 9, 6, 14, lime, 3);
      for (const attack of attacks) {
        circle(attack.x, attack.y, 10, pink);
        circle(attack.x, attack.y, 4, '#ffb0b7');
      }
      if (pulse > 0) {
        ctx.strokeStyle = `rgba(101,233,216,${pulse / .45})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(player.x, player.y, 24 + (1 - pulse / .45) * 120, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (grace <= 0 || Math.floor(elapsed * 12) % 2 === 0) face(portraits[0], player.x, player.y, 21, aqua);
    }
    return { action, update, draw };
  }
  return { panel, stop: showList };
}
