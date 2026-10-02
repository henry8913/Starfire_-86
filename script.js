(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const hiEl = document.getElementById('hi');
  const shipIcons = document.getElementById('shipIcons');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ovTitle');
  const ovHead = document.getElementById('ovHead');
  const ovScore = document.getElementById('ovScore');
  const ovNote = document.getElementById('ovNote');
  const ovSub = document.getElementById('ovSub');
  const restartBtn = document.getElementById('restart');
  const coinBtn = document.getElementById('coinBtn');
  const shareBtnEl = document.getElementById('shareBtn');
  const marqueeEl = document.getElementById('marquee');
  const scoreTableEl = document.getElementById('scoreTable');
  const nameEntryEl = document.getElementById('nameEntry');
  const nameRowEl = document.getElementById('nameRow');
  const nameDisplayEl = document.getElementById('nameDisplay');
  const editNameBtn = document.getElementById('editNameBtn');
  const nameInputEl = document.getElementById('nameInput');
  const joystickEl = document.getElementById('joystick');
  const stickEl = document.getElementById('stick');
  const joyZoneEl = document.getElementById('joyZone');
  const wrapEl = document.getElementById('wrap');

  let W = canvas.width;
  let H = canvas.height;

  // ---------- stato ----------
  let state = 'menu';
  let score, lives, frame;
  let ship, bullets, enemies, particles, popups, stars;
  let spawnTimer, shootCooldown, invuln;
  let paused = false, hitFlash = 0;
  let keys = {};
  let joyVec = { x: 0, y: 0 };
  let level = 1, levelState = 'wave', levelTotal = 0, levelKilled = 0;
  let boss = null;
  let ebullets = [], pickups = [];
  let superMissiles = 0;
  let weapon = 1, bombs = 2, flashWhite = 0;
  let speedBoost = 0;
  let banner = { txt: '', t: 0, max: 0 };
  let shake = 0, combo = 0, comboT = 0;
  let shieldT = 0, rapidT = 0, magnetT = 0;

  function loadItem(key, def) {
    try { return Number(localStorage.getItem(key) || def); } catch (e) { return def; }
  }
  function saveItem(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* storage non disponibile */ }
  }
  let high = loadItem('starfirebest', 0);
  let hiShown = high;
  let scores = [];
  try { scores = JSON.parse(localStorage.getItem('starfirescores') || '[]'); } catch (e) { scores = []; }
  if (!Array.isArray(scores)) scores = [];
  let credits = 3;
  let contMode = false, contSec = 6, contDeadline = 0, contInt = null;
  let enteringName = false, nameLetters = ['A', 'A', 'A'];
  let nameMode = 'menu', playerName = 'AAA';
  try { const savedName = localStorage.getItem('starfirename'); if (savedName) playerName = savedName.slice(0, 3).toUpperCase(); } catch (e) {}
  let pendingScore = 0, highlightRank = -1;

  function saveScores() {
    try { localStorage.setItem('starfirescores', JSON.stringify(scores.slice(0, 10))); } catch (e) {}
  }

  // ---------- audio retro (WebAudio) ----------
  let ac = null;
  let muted = false;
  try { muted = localStorage.getItem('starfiremute') === '1'; } catch (e) {}
  function setMuted(m) {
    muted = m;
    const el = document.getElementById('snd');
    el.textContent = muted ? 'OFF' : 'ON';
    el.classList.toggle('off', muted);
    saveItem('starfiremute', muted ? '1' : '0');
  }
  function ensureAudio() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, endFreq, dur, type, vol) {
    if (muted) return;
    const a = ensureAudio();
    if (!a) return;
    const t0 = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function sndShoot() { tone(1250, 320, 0.07, 'square', 0.04); }
  function sndSuper() { tone(500, 1500, 0.12, 'square', 0.06); }
  function sndKill() { tone(180, 850, 0.16, 'sawtooth', 0.08); }
  function sndExplosion() { tone(220, 40, 0.3, 'sawtooth', 0.13); }
  function sndPickup() { tone(600, 1200, 0.18, 'square', 0.09); }
  function sndPower() { tone(400, 900, 0.15, 'square', 0.09); setTimeout(() => tone(600, 1200, 0.15, 'square', 0.09), 120); }
  function sndBomb() { tone(120, 30, 0.7, 'sawtooth', 0.16); setTimeout(() => tone(60, 20, 0.8, 'sawtooth', 0.12), 80); }
  function sndBoss() { tone(90, 40, 0.5, 'sawtooth', 0.12); setTimeout(() => tone(60, 30, 0.6, 'sawtooth', 0.12), 120); }
  function sndOver() { tone(420, 60, 0.6, 'sawtooth', 0.11); setTimeout(() => tone(200, 40, 0.7, 'sawtooth', 0.11), 180); }

  function vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function addShake(v) { shake = Math.min(26, shake + v); }
  function comboMult() { return Math.min(5, 1 + Math.floor(combo / 5)); }

  // ---------- stelle parallasse ----------
  function makeStars() {
    stars = [];
    for (let i = 0; i < 70; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.6 + .3, v: Math.random() * 1.5 + .4, b: Math.random() > 0.8 });
    }
  }

  function reset() {
    score = 0;
    lives = 3;
    frame = 0;
    shootCooldown = 0;
    invuln = 90;
    superMissiles = 0;
    weapon = 1;
    bombs = 2;
    flashWhite = 0;
    speedBoost = 0;
    shieldT = 0; rapidT = 0; magnetT = 0;
    combo = 0; comboT = 0; shake = 0;
    stopContinue();
    ship = { x: W / 2, y: H - 48, w: 30, h: 26 };
    bullets = [];
    enemies = [];
    ebullets = [];
    pickups = [];
    particles = [];
    popups = [];
    boss = null;
    banner = { txt: '', t: 0, max: 0 };
    makeStars();
    scoreEl.textContent = '000000';
    updateSuperHud();
    updateBombHud();
    updateLivesIcons();
    startLevel(1);
  }

  function updateLivesIcons() {
    shipIcons.innerHTML = '';
    for (let i = 0; i < lives; i++) {
      const sp = document.createElement('span');
      sp.className = 'ship-icon';
      sp.innerHTML = '<svg viewBox="0 0 16 16"><polygon points="8,0 2,14 14,14" fill="#46e0ff" stroke="#fff" stroke-width="1"/><rect x="6" y="8" width="4" height="6" fill="#1fa8cc"/></svg>';
      shipIcons.appendChild(sp);
    }
  }

  // ---------- input ----------
  function bind() {
    document.addEventListener('keydown', (e) => {
      // Inserimento nome: lascia digitare al campo, INVIO conferma
      if (enteringName) {
        if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); confirmName(); }
        return;
      }
      if (e.code === 'Space') e.preventDefault();
      if (e.code === 'KeyM' && !e.repeat) setMuted(!muted);
      if (e.code === 'KeyC' && !e.repeat) pressCoin();
      if (e.code === 'KeyN' && !e.repeat) enterMenuName();
      if (contMode) {
        if (!e.repeat && (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter')) continueGame();
        return;
      }
      if (e.code === 'KeyP' && !e.repeat && state === 'playing' && !contMode) paused = !paused;
      if (e.code === 'KeyB' && !e.repeat) pressBomb();
      keys[e.code] = true;
      if (e.code === 'Space' && !e.repeat && state !== 'playing') { ensureAudio(); startGame(); }
    });
    document.addEventListener('keyup', (e) => { keys[e.code] = false; });
    function onRestart() {
    ensureAudio();
    if (contMode) { continueGame(); return; }
    startGame();
  }
  restartBtn.addEventListener('click', onRestart);
    coinBtn.addEventListener('click', () => { ensureAudio(); pressCoin(); });
    editNameBtn.addEventListener('click', () => { ensureAudio(); enterMenuName(); });

    // Inserimento nome: campo di testo + pulsante OK
    const iniPad = document.getElementById('iniPad');
    if (iniPad) {
      iniPad.addEventListener('pointerdown', (e) => {
        const btn = e.target.closest('[data-ini]');
        if (!btn || !enteringName) return;
        e.preventDefault();
        if (btn.dataset.ini === 'ok') confirmName();
      });
    }
    if (nameInputEl) {
      nameInputEl.addEventListener('input', () => {
        const v = (nameInputEl.value || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
        if (nameInputEl.value !== v) nameInputEl.value = v;
        nameLetters = v.split('');
      });
    }
    marqueeEl.addEventListener('click', () => { ensureAudio(); pressCoin(); });
    document.getElementById('snd').addEventListener('click', () => { ensureAudio(); setMuted(!muted); });
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) shareBtn.addEventListener('click', shareGame);
    const btnPause = document.getElementById('btnPause');
    if (btnPause) btnPause.addEventListener('click', () => { ensureAudio(); if (state === 'playing' && !contMode) paused = !paused; });
    const btnFull = document.getElementById('btnFull');
    if (btnFull) btnFull.addEventListener('click', () => {
      ensureAudio();
      try {
        if (!document.fullscreenElement) { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); }
        else if (document.exitFullscreen) document.exitFullscreen();
      } catch (e) {}
    });

    window.addEventListener('blur', () => { if (state === 'playing') paused = true; });

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (state !== 'playing' && !enteringName) { ensureAudio(); startGame(); }
    });

    function bindTouch(id, code, startable, onTap) {
      const el = document.getElementById(id);
      let tpid = null;
      const on = (e) => {
        e.preventDefault();
        if (startable && state !== 'playing' && !enteringName) { ensureAudio(); startGame(); }
        el.classList.add('pressed');
        setKey(code, true);
        tpid = e.pointerId;
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
        if (onTap) onTap();
      };
      const off = (e) => {
        if (e) e.preventDefault();
        if (tpid !== null && e && e.pointerId !== tpid) return;
        tpid = null;
        el.classList.remove('pressed');
        setKey(code, false);
      };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    bindTouch('btnFire', 'Space', true);
    bindTouch('btnBomb', 'KeyB', false, pressBomb);
    bindJoystick();
  }

  // ---------- joystick virtuale flottante (mobile) ----------
  function bindJoystick() {
    if (!joyZoneEl || !joystickEl || !stickEl) return;
    let active = false, pid = null, originX = 0, originY = 0, maxR = 52;
    function move(e) {
      if (!active || e.pointerId !== pid) return;
      if (e.pointerType === 'mouse' && e.buttons === 0) { end(e); return; }
      let dx = e.clientX - originX, dy = e.clientY - originY;
      const dist = Math.hypot(dx, dy);
      if (dist > maxR) { dx = dx / dist * maxR; dy = dy / dist * maxR; }
      stickEl.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      const dead = 9;
      joyVec.x = Math.abs(dx) < dead ? 0 : dx / maxR;
      joyVec.y = Math.abs(dy) < dead ? 0 : dy / maxR;
    }
    function end(e) {
      if (!active || (e && e.pointerId !== pid)) return;
      active = false; pid = null;
      joyVec.x = 0; joyVec.y = 0;
      stickEl.style.transform = 'translate(0,0)';
      joystickEl.classList.remove('active');
    }
    joyZoneEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      ensureAudio();
      const wr = wrapEl.getBoundingClientRect();
      const R = (joystickEl.offsetWidth || 132) / 2;
      let bx = Math.max(R, Math.min(wr.width - R, e.clientX - wr.left));
      let by = Math.max(R, Math.min(wr.height - R, e.clientY - wr.top));
      joystickEl.style.left = bx + 'px';
      joystickEl.style.top = by + 'px';
      joystickEl.classList.add('active');
      originX = wr.left + bx;
      originY = wr.top + by;
      maxR = R - 14;
      active = true; pid = e.pointerId;
      try { joyZoneEl.setPointerCapture(e.pointerId); } catch (err) {}
      move(e);
    });
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    joyZoneEl.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ---------- dimensionamento canvas (mobile fullscreen) ----------
  function isTouch() {
    if (typeof window.matchMedia !== 'function') return (navigator.maxTouchPoints || 0) > 0;
    return window.matchMedia('(pointer: coarse)').matches ||
           window.matchMedia('(hover: none)').matches ||
           ('ontouchstart' in window) ||
           (navigator.maxTouchPoints || 0) > 0;
  }
  let forceMobile = null; // null = auto, true/false = override (test)
  function mobileMode() { return forceMobile === null ? isTouch() : forceMobile; }

  function fitCanvas() {
    document.body.classList.toggle('mobile', mobileMode());
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (document.body.classList.contains('mobile')) {
      const r = wrapEl.getBoundingClientRect();
      const w = Math.max(200, Math.round(r.width));
      const h = Math.max(260, Math.round(r.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      W = w; H = h;
    } else {
      canvas.width = 480;
      canvas.height = 640;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      W = 480; H = 640;
    }
    if (ship) {
      ship.x = Math.max(22, Math.min(W - 22, ship.x));
      ship.y = Math.max(64, Math.min(H - 22, ship.y));
    }
    if (stars) makeStars();
  }

  function setKey(code, on) { keys[code] = on; }

  function sndCoin() {
    if (muted) return;
    const a = ensureAudio();
    if (!a) return;
    const t0 = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(900, t0);
    o.frequency.exponentialRampToValueAtTime(1800, t0 + 0.06);
    g.gain.setValueAtTime(0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    o.connect(g); g.connect(a.destination);
    o.start(t0); o.stop(t0 + 0.14);
  }

  function updateMarquee() {
    if (credits > 0) {
      marqueeEl.textContent = '** 1P:' + playerName + ' · CREDITI: ' + credits + ' · PRESS START **';
    } else {
      marqueeEl.textContent = '** INSERT COIN - 1 GETTONE = 2 CREDITI **';
    }
  }

  function addScore(pts) {
    score += pts;
    scoreEl.textContent = pad(score);
  }

  function pressCoin() {
    credits = Math.min(6, credits + 2);
    updateMarquee();
    sndCoin();
    if (contMode && credits > 0) { continueGame(); return; }
    if (state === 'menu' || state === 'over') {
      ovTitle.textContent = credits > 0 ? '>> PRESS START <<' : '>> INSERISCI UN GETTONE <<';
      if (restartBtn.textContent.indexOf('GETTONE') !== -1) restartBtn.textContent = '▶ INIZIA';
    }
  }

  function qualifies(score) {
    if (score <= 0) return false;
    if (scores.length < 10) return true;
    return score > scores[scores.length - 1].score;
  }

  function renderTable(hl) {
    highlightRank = (hl === undefined) ? -1 : hl;
    if (!scores.length) {
      scoreTableEl.innerHTML = '<div class="empty">--- NESSUN RECORD ---</div>';
      return;
    }
    let html = '<div class="hdr">RANK&nbsp;&nbsp;NAME&nbsp;&nbsp;&nbsp;&nbsp;SCORE</div>';
    for (let i = 0; i < 10; i++) {
      const s = scores[i];
      if (!s) break;
      const rank = String(i + 1).padStart(2, '0');
      const row = (i === highlightRank) ? ' class="row new"' : ' class="row"';
      html += `<div${row}><span>${rank}</span><span>${s.name}</span><span>${pad(s.score)}</span></div>`;
    }
    scoreTableEl.innerHTML = html;
  }

  function showAttract() {
    state = 'menu';
    ovHead.textContent = '1 PLAYER';
    ovTitle.textContent = credits > 0 ? '>> PRESS START <<' : '>> INSERT COIN - 1 GETTONE = 2 CREDITI <<';
    ovScore.textContent = 'RECORD ' + pad(hiShown);
    ovSub.style.display = '';
    ovNote.style.display = '';
    nameRowEl.style.display = '';
    nameDisplayEl.textContent = playerName;
    nameEntryEl.style.display = 'none';
    scoreTableEl.style.display = '';
    restartBtn.style.display = '';
    restartBtn.textContent = credits > 0 ? '▶ INIZIA' : '🪙 GETTONE';
    coinBtn.style.display = '';
    if (shareBtnEl) shareBtnEl.style.display = '';
    renderTable();
    updateMarquee();
  }

  function enterMenuName() {
    if (enteringName || state !== 'menu') return;
    enteringName = true;
    nameMode = 'menu';
    nameLetters = playerName.split('');
    ovHead.textContent = 'GIOCATORE';
    ovTitle.textContent = '>> INSERISCI IL TUO NOME <<';
    ovScore.textContent = 'QUESTE INIZIALI VERRANNO SALVATE IN CLASSIFICA';
    ovSub.style.display = 'none';
    ovNote.style.display = 'none';
    nameRowEl.style.display = 'none';
    restartBtn.style.display = 'none';
    coinBtn.style.display = 'none';
    if (shareBtnEl) shareBtnEl.style.display = 'none';
    scoreTableEl.style.display = 'none';
    nameEntryEl.style.display = '';
    renderIni();
    focusNameInput();
  }

  function showNameEntry() {
    enteringName = true;
    nameMode = 'record';
    nameLetters = playerName.split('');
    pendingScore = score;
    ovHead.textContent = 'NUOVO RECORD!';
    ovTitle.textContent = '>> INSERISCI IL TUO NOME <<';
    ovScore.textContent = 'SCORE ' + pad(score);
    ovSub.style.display = 'none';
    ovNote.style.display = 'none';
    nameRowEl.style.display = 'none';
    restartBtn.style.display = 'none';
    if (shareBtnEl) shareBtnEl.style.display = 'none';
    nameEntryEl.style.display = '';
    scoreTableEl.innerHTML = '';
    renderIni();
    focusNameInput();
  }

  function focusNameInput() {
    if (!nameInputEl) return;
    try {
      nameInputEl.focus();
      nameInputEl.setSelectionRange(0, nameInputEl.value.length);
    } catch (e) {}
  }

  function renderIni() {
    if (nameInputEl) nameInputEl.value = nameLetters.join('');
  }

  function confirmName() {
    enteringName = false;
    nameEntryEl.style.display = 'none';
    scoreTableEl.style.display = '';
    if (nameInputEl) nameInputEl.blur();
    const name = nameLetters.join('') || 'AAA';
    if (nameMode === 'record') {
      scores.push({ name, score: pendingScore, level });
      scores.sort((a, b) => b.score - a.score);
      scores = scores.slice(0, 10);
      saveScores();
      playerName = name;
      try { localStorage.setItem('starfirename', playerName); } catch (e) {}
      const idx = scores.findIndex(s => s.score === pendingScore && s.name === name);
      ovHead.textContent = 'GAME OVER';
      ovTitle.textContent = credits > 0 ? '>> PRESS START <<' : '>> INSERT COIN - 1 GETTONE = 2 CREDITI <<';
      ovScore.textContent = 'SCORE ' + pad(score) + '  ·  RECORD ' + pad(high);
      ovSub.style.display = '';
      restartBtn.style.display = '';
      restartBtn.textContent = '↻ CONTINUA';
      if (shareBtnEl) shareBtnEl.style.display = '';
      renderTable(idx);
      sndOver();
    } else {
      playerName = name;
      try { localStorage.setItem('starfirename', playerName); } catch (e) {}
      showAttract();
    }
  }

  function shareGame() {
    ensureAudio();
    const url = 'https://starfire.henrydev.it/';
    const btn = document.getElementById('shareBtn');
    if (navigator.share) {
      navigator.share({ title: "STARFIRE '86", text: "Gioca a STARFIRE '86 - sparatutto arcade retrò!", url }).catch(() => {});
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        if (btn) { const t = btn.textContent; btn.textContent = '✓ LINK COPIATO'; setTimeout(() => { btn.textContent = t; }, 1600); }
      }).catch(() => {});
      return;
    }
    if (btn) btn.textContent = url;
  }

  function startGame() {
    if (state === 'playing') return;
    if (credits <= 0) {
      ovTitle.textContent = '>> INSERISCI UN GETTONE <<';
      sndCoin();
      updateMarquee();
      return;
    }
    credits--;
    updateMarquee();
    reset();
    state = 'playing';
    paused = false;
    lastTime = performance.now();
    acc = 0;
    overlay.classList.remove('show');
    requestAnimationFrame(loop);
  }

  function endGame() {
    state = 'over';
    sndOver();
    if (score > high) {
      high = score;
      saveItem('starfirebest', high);
      hiShown = high;
    }
    hiEl.textContent = pad(hiShown);
    ovHead.textContent = 'GAME OVER';
    ovTitle.textContent = credits > 0 ? '>> PRESS START <<' : '>> INSERT COIN - 1 GETTONE = 2 CREDITI <<';
    ovScore.textContent = 'SCORE ' + pad(score) + '  ·  RECORD ' + pad(high);
    ovSub.style.display = '';
    ovNote.style.display = '';
    nameRowEl.style.display = 'none';
    nameEntryEl.style.display = 'none';
    restartBtn.textContent = '↻ CONTINUA';
    restartBtn.style.display = '';
    coinBtn.style.display = '';
    if (shareBtnEl) shareBtnEl.style.display = '';
    overlay.classList.add('show');
    if (qualifies(score)) {
      showNameEntry();
    } else {
      renderTable();
    }
  }

  function pad(n) { return String(n).padStart(6, '0'); }

  // ---------- sparo ----------
  function shoot() {
    const sy = ship.y;
    if (superMissiles > 0) {
      superMissiles--;
      updateSuperHud();
      bullets.push({ x: ship.x, y: sy - 4, vx: 0, vy: -13, super: true });
      bullets.push({ x: ship.x - 10, y: sy + 2, vx: -1.1, vy: -12.5, super: true });
      bullets.push({ x: ship.x + 10, y: sy + 2, vx: 1.1, vy: -12.5, super: true });
      sndSuper();
      return;
    }
    const v = -9 - weapon;
    if (weapon <= 0) {
      bullets.push({ x: ship.x, y: sy - 2, vx: 0, vy: v });
    } else if (weapon === 1) {
      bullets.push({ x: ship.x - 9, y: sy + 2, vx: 0, vy: v });
      bullets.push({ x: ship.x + 9, y: sy + 2, vx: 0, vy: v });
    } else if (weapon === 2) {
      bullets.push({ x: ship.x, y: sy - 2, vx: 0, vy: v });
      bullets.push({ x: ship.x - 9, y: sy + 4, vx: 0, vy: v });
      bullets.push({ x: ship.x + 9, y: sy + 4, vx: 0, vy: v });
    } else {
      bullets.push({ x: ship.x, y: sy - 4, vx: 0, vy: v - 1 });
      bullets.push({ x: ship.x - 9, y: sy + 2, vx: -1.4, vy: v });
      bullets.push({ x: ship.x + 9, y: sy + 2, vx: 1.4, vy: v });
      bullets.push({ x: ship.x - 18, y: sy + 6, vx: -2.4, vy: v });
      bullets.push({ x: ship.x + 18, y: sy + 6, vx: 2.4, vy: v });
    }
    sndShoot();
  }

  // ---------- nemici ----------
  const ENEMY_TYPES = [
    { w: 26, h: 20, hp: 1, pts: 50,  c1: '#ff5252', c2: '#ff8a8a', spd: 1.6, tier: 1 },
    { w: 34, h: 24, hp: 2, pts: 120, c1: '#ff9d00', c2: '#ffd28a', spd: 1.1, tier: 1 },
    { w: 20, h: 16, hp: 1, pts: 80,  c1: '#d45bff', c2: '#f0b6ff', spd: 2.6, tier: 1 },
    { w: 44, h: 30, hp: 3, pts: 220, c1: '#22c6a8', c2: '#8af0dd', spd: 0.9, tier: 2 },
    { w: 18, h: 14, hp: 1, pts: 150, c1: '#ff6bff', c2: '#ffd6ff', spd: 2.0, tier: 2, dive: true },
    { w: 30, h: 22, hp: 2, pts: 160, c1: '#4a8bff', c2: '#a8c8ff', spd: 1.9, tier: 3 },
    { w: 26, h: 22, hp: 2, pts: 190, c1: '#ff4ad0', c2: '#ffb0ff', spd: 1.0, tier: 2, shoot: true },
    { w: 22, h: 18, hp: 1, pts: 140, c1: '#4affa8', c2: '#b6ffdd', spd: 1.7, tier: 2, zig: true }
  ];

  function poolForLevel(l) {
    const maxTier = 1 + Math.floor((l - 1) / 2);
    return ENEMY_TYPES.filter(t => t.tier <= maxTier);
  }

  function spawnSquad() {
    const pool = poolForLevel(level);
    const t = pool[Math.floor(Math.random() * pool.length)];
    const cx = Math.random() * (W - 160) + 80;
    const n = 3 + Math.min(2, Math.floor(level / 2));
    for (let k = 0; k < n; k++) {
      const off = (k - (n - 1) / 2) * 26;
      enemies.push({
        x: cx + off,
        y: -t.h - 5 - Math.abs(off) * 0.4,
        w: t.w, h: t.h, hp: t.hp, pts: t.pts,
        c1: t.c1, c2: t.c2,
        spd: t.spd + 0.3 + (level - 1) * 0.03 + Math.random() * 0.3,
        t0: Math.random() * 100,
        wiggle: false,
        dive: !!t.dive,
        dived: false,
        shoot: false,
        zig: false,
        shootT: 0,
        explode: 0,
        max: 20
      });
    }
  }

  function spawnEnemy() {
    const pool = poolForLevel(level);
    const t = pool[Math.floor(Math.random() * pool.length)];
    enemies.push({
      x: Math.random() * (W - t.w - 10) + 5,
      y: -t.h - 5,
      w: t.w, h: t.h, hp: t.hp, pts: t.pts,
      c1: t.c1, c2: t.c2,
      spd: t.spd + (level - 1) * 0.03 + Math.random() * 0.9,
      t0: Math.random() * 100,
      wiggle: Math.random() > 0.6 && !t.dive && !t.shoot && !t.zig,
      dive: !!t.dive,
      dived: false,
      shoot: !!t.shoot,
      zig: !!t.zig,
      shootT: 30 + Math.floor(Math.random() * 90),
      explode: 0,
      max: 20
    });
  }

  function explode(x, y, colors) {
    addShake(1.6);
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * 4 + 1;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 40 + Math.random() * 20, max: 60, size: Math.random() * 3 + 1.5, color: colors[i % colors.length] });
    }
  }

  function bigExplode(x, y) {
    addShake(13);
    vibrate(70);
    for (let k = 0; k < 3; k++) {
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = Math.random() * 6 + 1;
        particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 50 + Math.random() * 40, max: 90, size: Math.random() * 4 + 2, color: ['#ffe14d', '#ff5252', '#fff', '#ff9d00'][i % 4] });
      }
    }
  }

  // ---------- livelli, boss e power-up ----------
  const THEMES = [
    { name: 'DESERTO',     top: '#2a1a05', bottom: '#0a0400', star: '#ffca7a', star2: '#ff7a4a' },
    { name: 'ARTICO',      top: '#06222e', bottom: '#01060a', star: '#aef0ff', star2: '#7adcff' },
    { name: 'CITTA',       top: '#1a0a2a', bottom: '#06020c', star: '#ffb07a', star2: '#ffd87a' },
    { name: 'GIUNGLA',     top: '#062a12', bottom: '#020a04', star: '#aef07a', star2: '#7affa4' },
    { name: 'SPAZIO',      top: '#2a1140', bottom: '#03020a', star: '#cdd6ff', star2: '#ff7ae0' },
    { name: 'VULCANO',     top: '#3a0a05', bottom: '#0c0201', star: '#ff9a6a', star2: '#ff5a2a' }
  ];
  let theme = THEMES[4];

  // Tipi di boss: ognuno con pattern di fuoco, movimento e colori diversi
  const BOSS_KINDS = [
    { name: 'SENTINELLA', hull: '#3a1140', trim: '#5a1a5a', core: '#ff2222', glow: '#f00', hpMul: 1.00, w: 120, h: 92, iv: 70 },
    { name: 'POLIPO',     hull: '#0e3a3a', trim: '#176a5a', core: '#22ff99', glow: '#0f8', hpMul: 1.15, w: 132, h: 96, iv: 96 },
    { name: 'ARTIGLIERE', hull: '#3a3210', trim: '#6a5a1a', core: '#ffcc22', glow: '#fc0', hpMul: 1.25, w: 124, h: 90, iv: 44 },
    { name: 'RAGNATELA',  hull: '#2a0e3a', trim: '#5a1a6a', core: '#cc44ff', glow: '#a0f', hpMul: 1.35, w: 128, h: 96, iv: 56 }
  ];

  function setBanner(txt, dur) { banner.txt = txt; banner.t = dur; banner.max = dur; }

  function updateSuperHud() {
    const el = document.getElementById('sp');
    el.textContent = superMissiles;
    el.classList.toggle('on', superMissiles > 0);
  }

  function startLevel(l) {
    level = l;
    levelState = 'wave';
    levelKilled = 0;
    levelTotal = Math.min(24, 6 + l * 2);
    boss = null;
    ebullets = [];
    enemies = [];
    pickups = [];
    spawnTimer = 30;
    theme = THEMES[(l - 1) % THEMES.length];
    setBanner('LIVELLO ' + l + ' - ' + theme.name, 90);
  }

  function spawnBoss() {
    const kind = (level - 1) % BOSS_KINDS.length;
    const k = BOSS_KINDS[kind];
    const hp = Math.round((15 + level * 7) * k.hpMul);
    boss = {
      x: W / 2, y: 70, w: k.w, h: k.h,
      hp, maxHp: hp, pts: 5000 + kind * 1500,
      fireTimer: 70, hitFlash: 0, explode: 0,
      phase2: false, kind, angle: Math.random() * Math.PI * 2
    };
    ebullets = [];
    levelState = 'boss';
    setBanner('!! BOSS: ' + k.name + ' !!', 90);
    sndBoss();
  }

  function bossFire() {
    const b = boss;
    const fx = b.x, fy = b.y + b.h / 2;
    const spd = 2.1 + level * 0.12;

    if (b.kind === 1) {
      // POLIPO: anello completo rotante
      const n = 12;
      for (let k = 0; k < n; k++) {
        const a = Math.PI * 2 * (k / n) + b.angle;
        ebullets.push({ x: fx, y: fy, vx: Math.cos(a) * 1.9, vy: Math.sin(a) * 1.9, r: 5 });
      }
      b.angle += 0.35;
      sndShoot();
      return;
    }

    if (b.kind === 2) {
      // ARTIGLIERE: spirale a 3 bracci
      for (let k = 0; k < 3; k++) {
        const a = b.angle + Math.PI * 2 * (k / 3);
        ebullets.push({ x: fx, y: fy, vx: Math.cos(a) * (spd + 0.4), vy: Math.sin(a) * (spd + 0.4), r: 5 });
      }
      b.angle += 0.42;
      sndShoot();
      return;
    }

    if (b.kind === 3) {
      // RAGNATELA: ventaglio rapido verso la nave + anello periodico
      const base = Math.atan2(ship.y - b.y, ship.x - b.x);
      for (let k = -2; k <= 2; k++) {
        const a = base + k * 0.18;
        ebullets.push({ x: fx, y: fy, vx: Math.cos(a) * (spd + 0.6), vy: Math.sin(a) * (spd + 0.6), r: 4 });
      }
      if (b.fireTimer % 5 === 0) {
        const n = 14;
        for (let k = 0; k < n; k++) {
          const a = Math.PI * 2 * (k / n);
          ebullets.push({ x: fx, y: fy, vx: Math.cos(a) * 1.8, vy: Math.sin(a) * 1.8, r: 4 });
        }
      }
      sndShoot();
      return;
    }

    // SENTINELLA (kind 0): mirato a 3 vie + anello dai livelli alti
    if (level >= 3 && (b.fireTimer % 2 === 0)) {
      const n = 10;
      for (let k = 0; k < n; k++) {
        const a = Math.PI * (k / n) + Math.sin(frame * 0.1) * 0.3;
        ebullets.push({ x: fx, y: fy, vx: Math.cos(a) * 2.2, vy: Math.sin(a) * 2.2, r: 5 });
      }
      sndShoot();
      return;
    }
    const a0 = Math.atan2(ship.y - b.y, ship.x - b.x);
    ebullets.push({ x: fx, y: fy, vx: Math.cos(a0) * spd, vy: Math.sin(a0) * spd, r: 5 });
    if (level >= 3) {
      ebullets.push({ x: fx - 22, y: fy, vx: Math.cos(a0 - 0.4) * spd * 0.85, vy: Math.sin(a0 - 0.4) * spd * 0.85, r: 5 });
      ebullets.push({ x: fx + 22, y: fy, vx: Math.cos(a0 + 0.4) * spd * 0.85, vy: Math.sin(a0 + 0.4) * spd * 0.85, r: 5 });
    }
    sndShoot();
  }

  function spawnPickup(x, y) {
    const r = Math.random();
    let kind = null;
    if (r < 0.10) kind = 'P';
    else if (r < 0.16) kind = 'B';
    else if (r < 0.22) kind = 'S';
    else if (r < 0.27) kind = 'spd';
    else if (r < 0.30) kind = 'life';
    else if (r < 0.35) kind = 'H';
    else if (r < 0.40) kind = 'R';
    else if (r < 0.44) kind = 'M';
    if (kind) pickups.push({ x, y, kind, vy: 1.3, t0: Math.random() * 100 });
  }

  function updateBombHud() {
    const el = document.getElementById('bomb');
    el.textContent = bombs;
    el.classList.toggle('on', bombs > 0);
  }

  function applyPickup(p) {
    if (p.kind === 'P') {
      weapon = Math.min(3, weapon + 1);
      popups.push({ x: p.x, y: p.y, txt: 'POWER UP!', life: 50, max: 50 });
      sndPower();
    } else if (p.kind === 'B') {
      bombs = Math.min(6, bombs + 1);
      updateBombHud();
      popups.push({ x: p.x, y: p.y, txt: 'BOMBA +1', life: 50, max: 50 });
      sndPickup();
    } else if (p.kind === 'S') {
      superMissiles = Math.min(12, superMissiles + 5);
      popups.push({ x: p.x, y: p.y, txt: 'SUPER MISSILI!', life: 50, max: 50 });
      updateSuperHud();
      sndPickup();
    } else if (p.kind === 'spd') {
      speedBoost = 300;
      popups.push({ x: p.x, y: p.y, txt: 'VELOCITA!', life: 50, max: 50 });
      sndPickup();
    } else if (p.kind === 'H') {
      shieldT = 600;
      popups.push({ x: p.x, y: p.y, txt: 'SCUDO!', life: 50, max: 50 });
      sndPower();
    } else if (p.kind === 'R') {
      rapidT = 600;
      popups.push({ x: p.x, y: p.y, txt: 'RAPID FIRE!', life: 50, max: 50 });
      sndPower();
    } else if (p.kind === 'M') {
      magnetT = 600;
      popups.push({ x: p.x, y: p.y, txt: 'MAGNETE!', life: 50, max: 50 });
      sndPickup();
    } else {
      if (lives < 6) lives++;
      updateLivesIcons();
      popups.push({ x: p.x, y: p.y, txt: '1UP!', life: 50, max: 50 });
      sndPickup();
    }
  }

  function pressBomb() {
    if (state !== 'playing' || bombs <= 0) return;
    bombs--;
    updateBombHud();
    sndBomb();
    flashWhite = 14;
    invuln = 60;
    addShake(20);
    vibrate(90);
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.explode > 0) continue;
      e.explode = 18;
      explode(e.x + e.w / 2, e.y + e.h / 2, [e.c1, '#fff', '#ffe14d']);
      addScore(e.pts);
      levelKilled++;
    }
    ebullets = [];
    if (boss && boss.explode === 0) damageBoss(10, boss.x, boss.y + boss.h / 2);
  }

  function damageBoss(dmg, x, y) {
    boss.hp -= dmg;
    boss.hitFlash = 6;
    explode(x, y, ['#ffe14d', '#fff']);
    if (boss.hp <= 0) {
      boss.hp = 0;
      boss.explode = 45;
      bigExplode(boss.x, boss.y + boss.h / 2);
      addScore(boss.pts);
      popups.push({ x: W / 2, y: boss.y + 30, txt: 'BOSS +' + boss.pts, life: 60, max: 60 });
      sndExplosion();
    }
  }

  function hitShip() {
    if (weapon > 0) {
      weapon--;
      popups.push({ x: ship.x, y: ship.y - 20, txt: 'ARMA DOWN', life: 45, max: 45 });
    }
    explode(ship.x, ship.y, ['#46e0ff', '#fff', '#ffe14d']);
    sndExplosion();
    hitFlash = 18;
    addShake(18);
    vibrate(120);
    combo = 0; comboT = 0;
    lives--;
    updateLivesIcons();
    invuln = 60;
    if (lives <= 0) beginContinue();
  }

  // Hitbox "core" della nave: piu' piccola dello sprite, per un gioco piu' giusto (soprattutto su mobile)
  function shipHit() {
    return { x: ship.x - 9, y: ship.y + 4, w: 18, h: 16 };
  }

  // ---------- CONTINUA (classico arcade: riparti dal punto in cui sei morto) ----------
  function beginContinue() {
    contMode = true;
    contDeadline = performance.now() + 6000;
    contSec = 6;
    overlay.classList.add('show');
    ovHead.textContent = 'SEI STATO ABBATTUTO!';
    ovTitle.textContent = '>> CONTINUA? <<';
    ovScore.textContent = 'SCORE ' + pad(score) + '  ·  LIVELLO ' + level;
    nameRowEl.style.display = 'none';
    nameEntryEl.style.display = 'none';
    ovNote.style.display = 'none';
    restartBtn.textContent = 'CONTINUA (1 CREDITO)';
    restartBtn.style.display = '';
    coinBtn.style.display = '';
    if (shareBtnEl) shareBtnEl.style.display = '';
    ovSub.style.display = '';
    updateContinueText();
    contInt = setInterval(contTick, 200);
  }

  function stopContinue() {
    contMode = false;
    if (contInt) { clearInterval(contInt); contInt = null; }
  }

  function contTick() {
    if (!contMode) return;
    const now = performance.now();
    contSec = Math.max(0, Math.ceil((contDeadline - now) / 1000));
    updateContinueText();
    if (now >= contDeadline) {
      stopContinue();
      endGame();
    }
  }

  function updateContinueText() {
    let msg;
    if (credits > 0) {
      msg = 'CREDITI: <b>' + credits + '</b> · 1 CREDITO PER CONTINUARE<br>RIPARTI DAL LIVELLO <b>' + level + '</b>';
    } else {
      msg = 'INSERISCI UN GETTONE (1 = 2 CREDITI) PER CONTINUARE<br>RIPARTI DAL LIVELLO <b>' + level + '</b>';
    }
    ovSub.innerHTML = msg + '<br>RESTO: <b>' + contSec + '</b>s';
  }

  function continueGame() {
    if (!contMode) return;
    if (credits <= 0) { ovTitle.textContent = '>> INSERISCI UN GETTONE <<'; return; }
    credits--;
    updateMarquee();
    stopContinue();
    state = 'playing';
    lives = 3;
    invuln = 120;
    updateLivesIcons();
    enemies = [];
    ebullets = [];
    overlay.classList.remove('show');
    paused = false;
    lastTime = performance.now();
    acc = 0;
  }

  // ---------- disegno ----------
  function drawShip() {
    const x = ship.x, y = ship.y;
    if (shieldT > 0) {
      ctx.strokeStyle = 'rgba(70,224,255,.85)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#46e0ff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(x, y + 12, 26 + Math.sin(frame * 0.2) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    const flick = invuln > 0 && (frame >> 2) % 2 === 0;
    if (flick) return;
    const fl = Math.sin(frame * .5) * 3;
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 14);
    ctx.lineTo(x, y + 22 + fl);
    ctx.lineTo(x + 5, y + 14);
    ctx.fill();
    ctx.fillStyle = '#46e0ff';
    ctx.fillRect(x - 13, y + 10, 26, 14);
    ctx.beginPath();
    ctx.moveTo(x - 7, y + 10);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 7, y + 10);
    ctx.fill();
    ctx.fillStyle = '#1fa8cc';
    ctx.beginPath();
    ctx.moveTo(x - 13, y + 14);
    ctx.lineTo(x - 22, y + 24);
    ctx.lineTo(x - 13, y + 24);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 13, y + 14);
    ctx.lineTo(x + 22, y + 24);
    ctx.lineTo(x + 13, y + 24);
    ctx.fill();
    ctx.fillStyle = '#eafcff';
    ctx.fillRect(x - 3, y + 4, 6, 5);
  }

  function drawEnemy(e) {
    if (e.explode > 0) return;
    const sway = e.wiggle ? Math.sin((frame + e.t0) * 0.05) * 25 : 0;
    const x = e.x + sway;
    ctx.fillStyle = e.c1;
    ctx.fillRect(x, e.y + e.h / 3, e.w, e.h / 3);
    ctx.beginPath();
    ctx.moveTo(x - 4, e.y + e.h / 2);
    ctx.lineTo(x - e.w * .5, e.y);
    ctx.lineTo(x, e.y + e.h / 3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + e.w + 4, e.y + e.h / 2);
    ctx.lineTo(x + e.w + e.w * .5, e.y);
    ctx.lineTo(x + e.w, e.y + e.h / 3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 2, e.y + e.h / 2);
    ctx.lineTo(x + e.w / 2, e.y + e.h / 3 + 1);
    ctx.lineTo(x + e.w - 2, e.y + e.h / 2);
    ctx.fill();
    ctx.fillStyle = e.c2;
    ctx.fillRect(x + e.w / 2 - 3, e.y + e.h / 3, 6, 4);
  }

  function drawBullet() {
    for (const b of bullets) {
      if (b.super) {
        ctx.fillStyle = '#ffe14d';
        ctx.shadowColor = '#ff8a00';
        ctx.shadowBlur = 12;
        ctx.fillRect(b.x - 4, b.y - 16, 8, 16);
        ctx.fillStyle = '#fff';
        ctx.fillRect(b.x - 1.5, b.y - 16, 3, 10);
      } else {
        ctx.fillStyle = '#ffe14d';
        ctx.shadowColor = '#ffe14d';
        ctx.shadowBlur = 6;
        ctx.fillRect(b.x - 1, b.y - 8, 2, 8);
      }
    }
    ctx.shadowBlur = 0;
  }

  function drawEbullets() {
    for (const b of ebullets) {
      ctx.fillStyle = '#ff5a5a';
      ctx.shadowColor = '#f00';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function drawPickups() {
    for (const p of pickups) {
      const pulse = Math.sin((frame + p.t0) * 0.15) * 3;
      let col, glow, txt;
      if (p.kind === 'P') { col = '#ff9d00'; glow = '#f60'; txt = 'P'; }
      else if (p.kind === 'B') { col = '#7dc8ff'; glow = '#07f'; txt = 'B'; }
      else if (p.kind === 'S') { col = '#ffe14d'; glow = '#ff8a00'; txt = 'S'; }
      else if (p.kind === 'H') { col = '#46e0ff'; glow = '#0ff'; txt = 'H'; }
      else if (p.kind === 'R') { col = '#ffde59'; glow = '#f90'; txt = 'R'; }
      else if (p.kind === 'M') { col = '#d45bff'; glow = '#a0f'; txt = 'M'; }
      else if (p.kind === 'spd') { col = '#7dff9d'; glow = '#0f0'; txt = '⚡'; }
      else { col = '#7dff7d'; glow = '#0f0'; txt = '♥'; }
      ctx.fillStyle = col;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10 + pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0a0518';
      ctx.font = 'bold 10px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(txt, p.x, p.y + 4);
    }
    ctx.textAlign = 'left';
  }

  // HUD: moltiplicatore combo + effetti attivi (scudo/rapid/ magnete)
  function drawEffects() {
    if (combo > 0) {
      const mult = comboMult();
      ctx.textAlign = 'right';
      ctx.font = 'bold 12px "Press Start 2P", monospace';
      ctx.fillStyle = mult >= 2 ? '#ffe14d' : '#7dff7d';
      ctx.shadowColor = mult >= 2 ? '#ff8a00' : '#0f0';
      ctx.shadowBlur = 8;
      ctx.fillText('COMBO x' + mult, W - 10, 70);
      ctx.shadowBlur = 0;
      const bw = 70, bx = W - 10 - bw, by = 76;
      ctx.fillStyle = 'rgba(255,255,255,.15)';
      ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle = mult >= 2 ? '#ffe14d' : '#7dff7d';
      ctx.fillRect(bx, by, bw * Math.min(1, comboT / 150), 4);
    }
    const eff = [];
    if (shieldT > 0) eff.push(['SCUDO', '#46e0ff', shieldT / 600]);
    if (rapidT > 0) eff.push(['RAPID', '#ffde59', rapidT / 600]);
    if (magnetT > 0) eff.push(['MAGNETE', '#d45bff', magnetT / 600]);
    let y = 52;
    ctx.textAlign = 'left';
    ctx.font = 'bold 8px "Press Start 2P", monospace';
    for (const e of eff) {
      ctx.fillStyle = e[1];
      ctx.fillText(e[0], 10, y);
      ctx.fillStyle = 'rgba(255,255,255,.15)';
      ctx.fillRect(10, y + 3, 60, 3);
      ctx.fillStyle = e[1];
      ctx.fillRect(10, y + 3, 60 * Math.max(0, e[2]), 3);
      y += 16;
    }
  }

  function drawBoss() {
    if (!boss || boss.explode > 0) return;
    const b = boss;
    const k = BOSS_KINDS[b.kind] || BOSS_KINDS[0];
    const bx = b.x, by = b.y;

    // dettagli per tipo (dietro il corpo)
    if (b.kind === 1) {
      ctx.strokeStyle = k.trim; ctx.lineWidth = 5;
      for (let s = -2; s <= 2; s++) {
        ctx.beginPath();
        ctx.moveTo(bx + s * 20, by + b.h - 6);
        ctx.lineTo(bx + s * 26, by + b.h + 12 + Math.sin(frame * 0.2 + s) * 5);
        ctx.stroke();
      }
    } else if (b.kind === 3) {
      ctx.strokeStyle = k.trim; ctx.lineWidth = 4;
      for (let s = -1; s <= 1; s += 2) {
        ctx.beginPath();
        ctx.moveTo(bx + s * (b.w / 2 - 4), by + b.h * 0.4);
        ctx.lineTo(bx + s * (b.w / 2 + 14), by + b.h * 0.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx + s * (b.w / 2 - 4), by + b.h * 0.7);
        ctx.lineTo(bx + s * (b.w / 2 + 14), by + b.h * 0.9);
        ctx.stroke();
      }
    }

    ctx.fillStyle = k.hull;
    ctx.beginPath();
    ctx.moveTo(bx - 16, by);
    ctx.lineTo(bx - b.w / 2, by + b.h * 0.55);
    ctx.lineTo(bx - 22, by + b.h);
    ctx.lineTo(bx, by + b.h - 8);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx + 16, by);
    ctx.lineTo(bx + b.w / 2, by + b.h * 0.55);
    ctx.lineTo(bx + 22, by + b.h);
    ctx.lineTo(bx, by + b.h - 8);
    ctx.fill();
    ctx.fillStyle = k.trim;
    ctx.fillRect(bx - b.w / 4, by, b.w / 2, b.h);
    ctx.beginPath();
    ctx.moveTo(bx - b.w / 4, by);
    ctx.lineTo(bx, by - b.h / 3);
    ctx.lineTo(bx + b.w / 4, by);
    ctx.fill();

    if (b.kind === 2) {
      // cannoni laterali
      ctx.fillStyle = k.trim;
      ctx.fillRect(bx - b.w / 2 - 6, by + b.h * 0.35, 8, b.h * 0.5);
      ctx.fillRect(bx + b.w / 2 - 2, by + b.h * 0.35, 8, b.h * 0.5);
    }

    ctx.fillStyle = k.core;
    ctx.shadowColor = k.glow;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(bx, by + b.h / 2, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.arc(bx, by + b.h / 2, 5, 0, Math.PI * 2);
    ctx.fill();
    const ring = 16 + Math.sin(frame * 0.2) * 3;
    ctx.strokeStyle = b.phase2 ? '#ff4040' : k.glow;
    ctx.globalAlpha = b.phase2 ? 0.9 : 0.5;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx, by + b.h / 2, ring, 0, Math.PI * 2);
    ctx.stroke();
    if (b.phase2) {
      ctx.strokeStyle = 'rgba(255,60,60,.7)';
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(bx, by + b.h / 2, ring + 7 + Math.sin(frame * 0.4) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (b.hitFlash > 0) {
      ctx.globalAlpha = (b.hitFlash / 6) * 0.6;
      ctx.fillStyle = '#fff';
      ctx.fillRect(bx - b.w / 2, by - 20, b.w, b.h + 20);
      ctx.globalAlpha = 1;
    }
  }

  function drawBanner() {
    if (banner.t <= 0) return;
    const fade = Math.min(1, banner.t / 20, (banner.max - banner.t) / 8);
    ctx.globalAlpha = Math.max(0, fade);
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#0ff';
    ctx.fillText(banner.txt, W / 2, H / 2 - 60);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- loop ----------
  function update() {
    if (paused || contMode) return;
    frame++;

    if (shake > 0) shake = Math.max(0, shake - 0.9);
    if (comboT > 0) { comboT--; if (comboT === 0) combo = 0; }
    if (shieldT > 0) shieldT--;
    if (rapidT > 0) rapidT--;
    if (magnetT > 0) magnetT--;

    if (hitFlash > 0) hitFlash--;
    if (flashWhite > 0) flashWhite--;
    if (banner.t > 0) banner.t--;
    if (boss && boss.hitFlash > 0) boss.hitFlash--;

    for (const s of stars) {
      s.y += s.v;
      if (s.y > H) { s.y = -2; s.x = Math.random() * W; }
    }

    if (invuln > 0) invuln--;

    const spd = speedBoost > 0 ? 8 : 5;
    if (keys['ArrowLeft'] || keys['KeyA']) ship.x -= spd;
    if (keys['ArrowRight'] || keys['KeyD']) ship.x += spd;
    if (keys['ArrowUp'] || keys['KeyW']) ship.y -= spd;
    if (keys['ArrowDown'] || keys['KeyS']) ship.y += spd;
    if (joyVec.x || joyVec.y) {
      ship.x += joyVec.x * spd;
      ship.y += joyVec.y * spd;
    }
    if (speedBoost > 0) speedBoost--;
    ship.x = Math.max(22, Math.min(W - 22, ship.x));
    ship.y = Math.max(64, Math.min(H - 22, ship.y));

    if (keys['Space']) {
      if (shootCooldown <= 0) { shoot(); shootCooldown = rapidT > 0 ? 7 : 14; }
    }
    if (shootCooldown > 0) shootCooldown--;

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      if (b.y < -20 || b.x < -10 || b.x > W + 10) bullets.splice(i, 1);
    }

    // ---------- boss ----------
    if (boss) {
      if (boss.explode > 0) {
        boss.explode--;
        if (boss.explode === 0) {
          const bonus = lives * 1000;
          if (bonus > 0) {
            addScore(bonus);
            popups.push({ x: W / 2, y: H / 2 - 40, txt: 'BONUS VITE +' + bonus, life: 60, max: 60 });
          }
          boss = null;
          startLevel(level + 1);
        }
      } else {
        if (boss.kind === 1) {
          boss.x = W / 2 + Math.sin(frame * 0.012) * (W / 2 - boss.w / 2 - 24);
          boss.y = 70 + Math.sin(frame * 0.024) * 22;
        } else if (boss.kind === 2) {
          boss.x = W / 2 + Math.sin(frame * 0.03) * (W / 2 - boss.w / 2 - 20);
          boss.y = 70 + Math.sin(frame * 0.05) * 18;
        } else if (boss.kind === 3) {
          boss.x = W / 2 + Math.sin(frame * 0.04) * (W / 2 - boss.w / 2 - 24);
          boss.y = 90 + Math.abs(Math.sin(frame * 0.02)) * 60;
        } else {
          boss.x = W / 2 + Math.sin(frame * 0.018) * (W / 2 - boss.w / 2 - 24);
          boss.y = 70 + Math.sin(frame * 0.03) * 14;
        }
        // Fase 2: a meta' vita il boss si "incattivisce"
        if (!boss.phase2 && boss.hp <= boss.maxHp * 0.5) {
          boss.phase2 = true;
          boss.fireTimer = 22;
          setBanner('!! FASE 2 !!', 60);
          addShake(12); vibrate(50);
          explode(boss.x, boss.y + boss.h / 2, ['#fff', '#ff5252', '#ffe14d']);
        }

        boss.fireTimer--;
        if (boss.fireTimer <= 0) {
          bossFire();
          if (boss.phase2) {
            const n = 8;
            for (let k = 0; k < n; k++) {
              const a = Math.PI * 2 * (k / n) + frame * 0.05;
              ebullets.push({ x: boss.x, y: boss.y + boss.h / 2, vx: Math.cos(a) * 1.9, vy: Math.sin(a) * 1.9, r: 4 });
            }
          }
          const iv = (BOSS_KINDS[boss.kind] || BOSS_KINDS[0]).iv * (boss.phase2 ? 0.62 : 1);
          boss.fireTimer = Math.max(boss.phase2 ? 20 : 30, Math.round(iv) - level * 2);
        }

        for (let j = bullets.length - 1; j >= 0; j--) {
          const b = bullets[j];
          const bw = b.super ? 9 : 2, bh = b.super ? 18 : 8;
          if (b.x + bw > boss.x - boss.w / 2 && b.x - bw < boss.x + boss.w / 2 && b.y > boss.y && b.y < boss.y + boss.h) {
            bullets.splice(j, 1);
            const dx = b.x - boss.x, dy = b.y - (boss.y + boss.h / 2);
            const inCore = dx * dx + dy * dy < 16 * 16;
            damageBoss((b.super ? 3 : 1) * (inCore ? 3 : 1), b.x, b.y);
          }
        }
      }
    }

    // proiettili nemici vs nave
    for (let i = ebullets.length - 1; i >= 0; i--) {
      const b = ebullets[i];
      b.x += b.vx; b.y += b.vy;
      if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) { ebullets.splice(i, 1); continue; }
      const hr = shipHit();
      if (invuln <= 0 && shieldT <= 0 && b.x + b.r > hr.x && b.x - b.r < hr.x + hr.w && b.y + b.r > hr.y && b.y - b.r < hr.y + hr.h) {
        ebullets.splice(i, 1);
        hitShip();
      }
    }

    // spawn ondata
    if (levelState === 'wave' && levelKilled < levelTotal) {
      if (spawnTimer <= 0) {
        if (Math.random() < 0.4) spawnSquad(); else spawnEnemy();
        spawnTimer = Math.max(20, 96 - level * 4);
      } else spawnTimer--;
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.explode > 0) {
        e.explode--;
        if (e.explode === 0) enemies.splice(i, 1);
        continue;
      }
      e.y += e.spd;
      if (e.y > H + 30) {
        enemies.splice(i, 1);
        if (levelState === 'wave') levelKilled++; // i nemici sfuggiti contano: l'ondata non diventa infinita
        continue;
      }

      if (e.dive) {
        if (!e.dived && e.y > 180) {
          e.dived = true;
          e.sx = e.x;
          e.spd = 3.0;
        }
        if (e.dived) {
          const target = ship.x;
          const dir = target > e.x ? 1 : -1;
          e.x += dir * 1.7;
          e.x = Math.max(8, Math.min(W - e.w - 8, e.x));
        }
      }

      if (e.zig) {
        e.x += Math.sin((frame + e.t0) * 0.09) * 1.9;
        e.x = Math.max(4, Math.min(W - e.w - 4, e.x));
      }

      if (e.shoot && e.y > 0 && e.y < H * 0.72) {
        e.shootT--;
        if (e.shootT <= 0) {
          e.shootT = 80 + Math.floor(Math.random() * 80);
          const a = Math.atan2(ship.y + 12 - e.y, ship.x - (e.x + e.w / 2));
          const sp = 2.6 + level * 0.08;
          ebullets.push({ x: e.x + e.w / 2, y: e.y + e.h, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4 });
        }
      }

      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        const sway = e.wiggle ? Math.sin((frame + e.t0) * 0.05) * 25 : 0;
        const ex = e.x + sway;
        const bw = b.super ? 9 : 2;
        if (b.x + bw > ex && b.x - bw < ex + e.w && b.y > e.y && b.y < e.y + e.h) {
          bullets.splice(j, 1);
          e.hp -= b.super ? 3 : 1;
          explode(b.x, b.y, ['#ffe14d', '#fff']);
          if (e.hp <= 0) {
            e.explode = 18;
            explode(ex + e.w / 2, e.y + e.h / 2, [e.c1, '#fff', '#ffe14d']);
            combo++;
            comboT = 150;
            const mult = comboMult();
            popups.push({ x: ex + e.w / 2, y: e.y, txt: '+' + (e.pts * mult) + (mult > 1 ? ' x' + mult : ''), life: 45, max: 45 });
            sndKill();
            addScore(e.pts * mult);
            levelKilled++;
            spawnPickup(ex + e.w / 2, e.y + e.h / 2);
            if (combo > 0 && combo % 5 === 0) { addShake(3); popups.push({ x: ex + e.w / 2, y: e.y - 16, txt: 'COMBO x' + comboMult(), life: 50, max: 50 }); }
          }
          break;
        }
      }
      if (e.explode > 0) continue;

      const ex2 = e.wiggle ? Math.sin((frame + e.t0) * 0.05) * 25 : 0;
      const cx = e.x + ex2;
      const hr = shipHit();
      if (invuln <= 0 && shieldT <= 0 && e.y + e.h > hr.y && e.y < hr.y + hr.h && cx + e.w > hr.x && cx < hr.x + hr.w) {
        enemies.splice(i, 1);
        hitShip();
      }
    }

    // ondata completata -> boss
    if (levelState === 'wave' && levelKilled >= levelTotal && enemies.length === 0) {
      spawnBoss();
    }

    // power-up
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.y += p.vy;
      if (p.y > H + 20) { pickups.splice(i, 1); continue; }
      if (magnetT > 0) {
        const dx = ship.x - p.x, dy = (ship.y + 12) - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 170) { p.x += dx / d * 4.5; p.y += dy / d * 4.5; }
      }
      const sx = ship.x - 22, sw = 44, sy = ship.y, sh = 26;
      if (p.x > sx && p.x < sx + sw && p.y > sy && p.y < sy + sh) {
        pickups.splice(i, 1);
        applyPickup(p);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }

    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.y -= 0.8;
      p.life--;
      if (p.life <= 0) popups.splice(i, 1);
    }
  }

  // ---------- scenografia per livello (dietro il gioco) ----------
  function drawDunes(baseY, color, amp) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 14) {
      ctx.lineTo(x, baseY - Math.sin(x * 0.012 + amp * 3) * 16 * amp);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  function drawSnow(prefix, count, rise) {
    for (let i = 0; i < count; i++) {
      const seed = i * 127.1;
      const x = (Math.sin(seed) * 0.5 + 0.5) * W;
      const speed = 0.6 + (i % 5) * 0.3;
      const y = ((Math.cos(seed * 1.7) * 0.5 + 0.5) * H + (rise ? -frame * speed : frame * speed)) % H;
      ctx.fillStyle = prefix + (0.35 + (i % 3) * 0.15) + ')';
      ctx.fillRect(x + Math.sin(frame * 0.03 + i) * 6, (y + H) % H, 2, 2);
    }
  }

  function drawIce(baseY) {
    ctx.fillStyle = 'rgba(150,215,255,.45)';
    ctx.beginPath();
    ctx.moveTo(0, H);
    let x = 0;
    while (x < W) {
      const w = 28 + ((x * 7) % 18);
      const h = 24 + Math.abs(Math.sin(x * 0.11)) * 66;
      ctx.lineTo(x, baseY - h);
      ctx.lineTo(x + w / 2, baseY - h - 12);
      ctx.lineTo(x + w, baseY);
      x += w;
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  function drawCity() {
    let x = -8, i = 0;
    while (x < W) {
      const w = 22 + ((i * 37) % 24);
      const h = 50 + ((i * 53) % 130);
      ctx.fillStyle = 'rgba(18,8,36,.85)';
      ctx.fillRect(x, H - h, w, h);
      ctx.fillStyle = 'rgba(255,215,120,.45)';
      for (let yy = H - h + 8; yy < H - 10; yy += 14) {
        for (let xx = x + 5; xx < x + w - 5; xx += 9) {
          if ((Math.floor(xx) + Math.floor(yy) + i) % 3 === 0) ctx.fillRect(xx, yy, 3, 5);
        }
      }
      x += w + 5;
      i++;
    }
  }

  function drawJungle() {
    // chioma in alto
    ctx.fillStyle = 'rgba(16,86,38,.85)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= W; x += 16) {
      ctx.lineTo(x, 26 + Math.sin(x * 0.045) * 18);
    }
    ctx.lineTo(W, 0);
    ctx.closePath();
    ctx.fill();
    // fronde che pendono
    ctx.strokeStyle = 'rgba(24,120,54,.7)';
    ctx.lineWidth = 5;
    for (let i = 0; i < 6; i++) {
      const x = W * (0.1 + i * 0.16);
      ctx.beginPath();
      ctx.moveTo(x, 8);
      ctx.quadraticCurveTo(x + 10, 60 + Math.sin(frame * 0.02 + i) * 6, x - 6, 96);
      ctx.stroke();
    }
    // alberi ai lati
    ctx.fillStyle = 'rgba(8,58,26,.92)';
    for (const s of [0.08, 0.92]) {
      const bx = W * s;
      ctx.beginPath();
      ctx.moveTo(bx - 30, H);
      ctx.lineTo(bx, H * 0.34);
      ctx.lineTo(bx + 30, H);
      ctx.fill();
    }
    // cespugli in basso
    drawDunes(H * 0.88, 'rgba(14,80,32,.8)', 0.6);
  }

  function drawNebula() {
    const cols = ['rgba(130,60,210,', 'rgba(60,120,210,', 'rgba(210,60,160,'];
    for (let i = 0; i < 3; i++) {
      const cx = W * (0.28 + i * 0.22), cy = H * (0.28 + i * 0.12);
      const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, H * 0.42);
      g.addColorStop(0, cols[i] + '.12)');
      g.addColorStop(1, cols[i] + '0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawPlanet() {
    ctx.fillStyle = 'rgba(185,125,225,.35)';
    ctx.beginPath();
    ctx.arc(W * 0.8, H * 0.17, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,180,255,.32)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(W * 0.8, H * 0.17, 52, 13, -0.4, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawVolcano() {
    const glow = 0.10 + (Math.sin(frame * 0.05) * 0.5 + 0.5) * 0.08;
    const g = ctx.createRadialGradient(W / 2, H, 10, W / 2, H, H * 0.65);
    g.addColorStop(0, 'rgba(255,80,20,' + glow + ')');
    g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.35, W, H * 0.65);
    ctx.fillStyle = 'rgba(30,10,8,.9)';
    ctx.beginPath();
    ctx.moveTo(W * 0.12, H);
    ctx.lineTo(W * 0.5, H * 0.6);
    ctx.lineTo(W * 0.88, H);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,120,40,' + (0.6 + Math.sin(frame * 0.1) * 0.3) + ')';
    ctx.beginPath();
    ctx.moveTo(W * 0.44, H * 0.62);
    ctx.lineTo(W * 0.56, H * 0.62);
    ctx.lineTo(W * 0.5, H * 0.575);
    ctx.fill();
  }

  function drawScenery() {
    const n = theme.name;
    if (n === 'DESERTO') {
      ctx.fillStyle = 'rgba(255,240,200,.8)';
      ctx.beginPath(); ctx.arc(W * 0.78, H * 0.16, 24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,205,150,.45)';
      ctx.beginPath(); ctx.arc(W * 0.64, H * 0.23, 12, 0, Math.PI * 2); ctx.fill();
      drawDunes(H * 0.78, 'rgba(120,80,30,.5)', 0.9);
      drawDunes(H * 0.87, 'rgba(90,58,20,.75)', 0.6);
    } else if (n === 'ARTICO') {
      for (let i = 0; i < 3; i++) {
        const yy = H * 0.1 + i * 24;
        ctx.fillStyle = 'rgba(120,255,220,' + (0.05 + i * 0.03) + ')';
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.quadraticCurveTo(W / 2, yy - 22 - Math.sin(frame * 0.02 + i) * 10, W, yy);
        ctx.lineTo(W, yy + 16);
        ctx.quadraticCurveTo(W / 2, yy - 4 - Math.sin(frame * 0.02 + i) * 10, 0, yy + 16);
        ctx.fill();
      }
      drawIce(H * 0.84);
      drawSnow('rgba(255,255,255,', 60);
    } else if (n === 'CITTA') {
      ctx.fillStyle = 'rgba(230,230,255,.75)';
      ctx.beginPath(); ctx.arc(W * 0.2, H * 0.14, 16, 0, Math.PI * 2); ctx.fill();
      drawCity();
    } else if (n === 'GIUNGLA') {
      drawJungle();
    } else if (n === 'SPAZIO') {
      drawNebula();
      drawPlanet();
    } else if (n === 'VULCANO') {
      drawVolcano();
      drawSnow('rgba(255,140,60,', 40, true);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, theme.top);
    g.addColorStop(1, theme.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    drawScenery();

    // Screen shake: trema la scena (non lo sfondo)
    const shx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const shy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    ctx.save();
    ctx.translate(shx, shy);

    for (const s of stars) {
      ctx.globalAlpha = Math.min(1, s.s * .6);
      ctx.fillStyle = s.b ? theme.star2 : theme.star;
      ctx.fillRect(s.x, s.y, 2, 2);
    }
    ctx.globalAlpha = 1;

    drawShip();
    for (const e of enemies) drawEnemy(e);
    drawBullet();
    drawEbullets();
    drawPickups();
    drawBoss();
    if (boss && boss.explode === 0) {
      const bw = 220, bx = (W - bw) / 2, by = 12;
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(bx - 2, by - 2, bw + 4, 14);
      ctx.fillStyle = '#330000';
      ctx.fillRect(bx, by, bw, 10);
      ctx.fillStyle = '#ff2222';
      ctx.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.maxHp), 10);
      ctx.font = 'bold 9px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ff9d9d';
      ctx.fillText('BOSS', 10, by + 9);
    }
    drawParticles();
    drawBanner();

    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.textAlign = 'center';
    for (const p of popups) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = '#ffe14d';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(p.txt, p.x, p.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

    ctx.restore();

    // HUD combo/effetti (senza shake)
    drawEffects();

    if (hitFlash > 0) {
      ctx.globalAlpha = (hitFlash / 18) * 0.35;
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    if (flashWhite > 0) {
      ctx.globalAlpha = (flashWhite / 14) * 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    if (paused) {
      ctx.fillStyle = 'rgba(5,0,20,.65)';
      ctx.fillRect(0, 0, W, H);
      ctx.font = 'bold 16px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0ff';
      ctx.shadowColor = '#0ff';
      ctx.shadowBlur = 10;
      ctx.fillText('PAUSA', W / 2, H / 2 - 8);
      ctx.shadowBlur = 0;
      ctx.font = '11px "Courier New", monospace';
      ctx.fillStyle = '#cfcfff';
      ctx.fillText('P o ❚❚ per continuare', W / 2, H / 2 + 18);
      ctx.textAlign = 'left';
    }
  }

  // ---------- loop (timestep fisso: indipendente dalla frequenza del monitor) ----------
  const STEP = 1000 / 60;
  let lastTime = 0, acc = 0;

  function loop(now) {
    if (state !== 'playing') return;
    acc += now - lastTime;
    lastTime = now;
    if (acc > 250) acc = 250;
    let steps = 0;
    while (acc >= STEP && steps < 6) {
      update();
      acc -= STEP;
      steps++;
    }
    draw();
    requestAnimationFrame(loop);
  }

  bind();
  setMuted(muted);
  fitCanvas();
  reset();
  overlay.classList.add('show');
  hiEl.textContent = pad(hiShown);
  showAttract();
  draw();

  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      fitCanvas();
      if (state !== 'playing') draw();
    }, 150);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  // debug hook (per test)
  window.__game = {
    get state() { return state; },
    get paused() { return paused; },
    get muted() { return muted; },
    get ship() { return Object.assign({}, ship); },
    get bullets() { return bullets.length; },
    get enemies() { return enemies.length; },
    get enemiesPos() { return enemies.map(function (e) { return { x: e.x + e.w / 2, y: e.y }; }); },
    get ebulletsPos() { return ebullets.map(function (e) { return { x: e.x, y: e.y, vx: e.vx, vy: e.vy }; }); },
    get score() { return score; },
    get lives() { return lives; },
    get frame() { return frame; },
    get level() { return level; },
    get levelState() { return levelState; },
    get levelTotal() { return levelTotal; },
    get levelKilled() { return levelKilled; },
    get superMissiles() { return superMissiles; },
    get weapon() { return weapon; },
    get bombs() { return bombs; },
    get speedBoost() { return speedBoost; },
    get joy() { return { x: joyVec.x, y: joyVec.y }; },
    get combo() { return combo; },
    get effects() { return { shield: shieldT, rapid: rapidT, magnet: magnetT, shake: shake }; },
    get W() { return W; },
    get H() { return H; },
    setMobile: function(b) { forceMobile = (b === undefined ? null : !!b); fitCanvas(); if (state !== 'playing') draw(); },
    get theme() { return theme.name; },
    get credits() { return credits; },
    get contMode() { return contMode; },
    get contSec() { return contSec; },
    get enteringName() { return enteringName; },
    get nameLetters() { return nameLetters.join(''); },
    get playerName() { return playerName; },
    get nameMode() { return nameMode; },
    get scores() { return scores.map(s => s.name + ':' + s.score).join(','); },
    get boss() { return boss ? Object.assign({}, boss) : null; },
    get ebullets() { return ebullets.length; },
    get pickups() { return pickups.length; },
    get banner() { return banner.txt; },
    fire: function() { shoot(); },
    spawn: function() { spawnEnemy(); },
    startBoss: function() { spawnBoss(); },
    hurtBoss: function(d) { if (boss) damageBoss(d || 1, boss.x, boss.y + boss.h / 2); },
    applyPower: function(k) { applyPickup({ x: ship.x, y: ship.y, kind: k }); },
    nextLevel: function() { startLevel(level + 1); },
    bomb: function() { pressBomb(); },
    addBomb: function() { bombs = Math.min(6, bombs + 1); updateBombHud(); },
    dropPickup: function(kind) { pickups.push({ x: ship.x, y: H / 2 - 100, kind: kind || 'S', vy: 1.3, t0: 0 }); },
    addSuper: function() { superMissiles = Math.min(12, superMissiles + 5); updateSuperHud(); },
    moveLeft: function() { ship.x -= 5; },
    moveRight: function() { ship.x += 5; },
    moveUp: function() { ship.y -= 5; },
    moveDown: function() { ship.y += 5; },
    coin: function() { pressCoin(); },
    setCredits: function(n) { credits = Math.max(0, Math.min(9, n)); updateMarquee(); },
    kill: function() { while (lives > 0) { lives--; } lives = 0; beginContinue(); },
    addPoints: function(n) { addScore(n); },
    menuName: function() { enterMenuName(); },
    confirmName: function() { if (enteringName) confirmName(); }
  };
})();
