function createArcade(effect) {
  const panel = document.getElementById('arcade');
  const field = document.getElementById('arcade-field');
  const select = document.getElementById('arcade-mode');
  const help = document.getElementById('arcade-help');
  const status = document.getElementById('arcade-status');
  const startButton = document.getElementById('arcade-start');
  const images = ['assets/friend4.webp', 'assets/friend5.webp', 'assets/friend6.webp', 'friend1.png'];
  const names = ['Хитрец', 'Очкарик', 'Фаер', 'Егорчик'];
  const descriptions = {
    tap: 'Лови персонажей тапами. У тебя 20 секунд.',
    dodge: 'Веди персонажа пальцем, чтобы уворачиваться. На ПК работают и стрелки.',
    memory: 'Запомни, кто загорелся, и нажми на персонажей в том же порядке.'
  };
  let timers = new Set();
  let frame = 0;
  let cleanup = () => {};
  let running = false;

  function later(callback, ms) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, ms);
    timers.add(timer);
  }

  function stop() {
    running = false;
    timers.forEach(clearTimeout);
    timers.clear();
    cancelAnimationFrame(frame);
    cleanup();
    cleanup = () => {};
    field.replaceChildren();
    field.className = '';
    startButton.disabled = false;
    status.textContent = '';
  }

  function finish(score, unit) {
    const key = 'angry-bomz:record:' + select.value;
    let best = score;
    try {
      best = Math.max(score, Number(localStorage.getItem(key)) || 0);
      localStorage.setItem(key, best);
    } catch {}
    stop();
    status.textContent = `Результат — ${score} ${unit}. Рекорд — ${best} ${unit}.`;
    effect(440, 550, 660);
  }

  function portrait(element, index) {
    const image = document.createElement('img');
    image.src = images[index];
    image.alt = '';
    element.setAttribute('aria-label', names[index]);
    element.append(image);
    return image;
  }

  function tapGame() {
    let score = 0;
    let index = 0;
    const end = performance.now() + 20000;
    const target = document.createElement('button');
    target.style.width = target.style.height = '72px';
    const image = portrait(target, index);
    field.append(target);
    function move() {
      target.style.left = Math.random() * Math.max(0, field.clientWidth - 72) + 'px';
      target.style.top = Math.random() * Math.max(0, field.clientHeight - 72) + 'px';
    }
    function countdown() {
      const remaining = Math.ceil((end - performance.now()) / 1000);
      if (remaining <= 0) { finish(score, 'оч.'); return; }
      status.textContent = `Очки — ${score} · Осталось ${remaining} с`;
    }
    target.onclick = () => {
      if (performance.now() >= end) { finish(score, 'оч.'); return; }
      score++;
      index = (index + 1) % images.length;
      image.src = images[index];
      target.setAttribute('aria-label', names[index]);
      effect(480 + index * 100);
      move();
      countdown();
    };
    function tick() {
      countdown();
      if (running) later(tick, 200);
    }
    move();
    tick();
  }

  function dodgeGame() {
    const size = 52;
    const player = document.createElement('div');
    player.className = 'runner';
    player.style.width = player.style.height = size + 'px';
    portrait(player, 1);
    field.append(player);
    let x = (field.clientWidth - size) / 2;
    const hazards = [];
    let elapsed = 0;
    let last = performance.now();
    let spawnIn = 0.8;
    let shown = -1;
    function track(event) {
      x = event.clientX - field.getBoundingClientRect().left - size / 2;
    }
    function grab(event) {
      if (!event.isPrimary || event.button !== 0) return;
      field.setPointerCapture(event.pointerId);
      track(event);
    }
    function drag(event) {
      if (field.hasPointerCapture(event.pointerId)) track(event);
    }
    function key(event) {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      x += event.key === 'ArrowLeft' ? -28 : 28;
    }
    field.addEventListener('pointerdown', grab);
    field.addEventListener('pointermove', drag);
    document.addEventListener('keydown', key);
    cleanup = () => {
      field.removeEventListener('pointerdown', grab);
      field.removeEventListener('pointermove', drag);
      document.removeEventListener('keydown', key);
    };
    function draw(now) {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      elapsed += dt;
      spawnIn -= dt;
      const width = field.clientWidth;
      const height = field.clientHeight;
      const y = height - size - 12;
      x = Math.max(0, Math.min(width - size, x));
      player.style.transform = `translate(${x}px,${y}px)`;
      if (spawnIn <= 0) {
        const bar = document.createElement('div');
        bar.className = 'obstacle';
        const w = Math.round(width * (0.16 + Math.random() * 0.12));
        const left = Math.random() * (width - w);
        bar.style.width = w + 'px';
        field.append(bar);
        hazards.push({ bar, w, left, top: -22 });
        spawnIn += Math.max(0.27, 0.67 - elapsed * 0.011);
      }
      for (let i = hazards.length - 1; i >= 0; i--) {
        const hazard = hazards[i];
        hazard.top += dt * Math.min(540, 150 + elapsed * 9);
        if (hazard.top + 22 > y + 5 && hazard.top < y + size - 5 &&
            hazard.left < x + size - 5 && hazard.left + hazard.w > x + 5) {
          effect(185, 105);
          finish(Math.floor(elapsed), 'с');
          return;
        }
        if (hazard.top > height) {
          hazard.bar.remove();
          hazards.splice(i, 1);
        } else {
          hazard.bar.style.transform = `translate(${hazard.left}px,${hazard.top}px)`;
        }
      }
      if (Math.floor(elapsed) !== shown) {
        shown = Math.floor(elapsed);
        status.textContent = `Время — ${shown} с`;
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
  }

  function memoryGame() {
    const sequence = [];
    let entered = 0;
    let ready = false;
    field.className = 'memory';
    const tiles = images.map((_, index) => {
      const tile = document.createElement('button');
      portrait(tile, index);
      field.append(tile);
      tile.onclick = () => {
        if (!ready) return;
        if (sequence[entered] !== index) {
          effect(185, 105);
          finish(sequence.length - 1, 'раунд.');
          return;
        }
        effect(380 + index * 140);
        entered++;
        if (entered === sequence.length) {
          ready = false;
          status.textContent = 'Верно!';
          later(showRound, 600);
        }
      };
      return tile;
    });

    function showRound() {
      entered = 0;
      sequence.push(Math.floor(Math.random() * tiles.length));
      status.textContent = 'Запоминай…';
      sequence.forEach((index, position) => {
        const offset = position * 660;
        later(() => {
          tiles[index].classList.add('lit');
          effect(380 + index * 140);
        }, offset);
        later(() => tiles[index].classList.remove('lit'), offset + 420);
      });
      later(() => {
        ready = true;
        status.textContent = `Твой ход · Раунд ${sequence.length}`;
      }, sequence.length * 660);
    }
    showRound();
  }

  select.onchange = () => {
    stop();
    help.textContent = descriptions[select.value];
  };
  select.onchange();
  startButton.onclick = () => {
    stop();
    running = true;
    startButton.disabled = true;
    effect(440, 660);
    const games = { tap: tapGame, dodge: dodgeGame, memory: memoryGame };
    games[select.value]();
  };
  return { panel, stop };
}
