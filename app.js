/* 点名考勤 PWA —— 数据全部存本机 localStorage，不上传服务器 */
var KEY = 'rcpwa.v1';
var S = load();
var V = { name: 'home', q: '', batchId: null, rollQ: '', histTab: 'list', editTab: 'drag', ledgerSort: 'out', ledgerDir: -1, selMode: false, selIds: {} };

function load() {
  var base = { theme: 'light', random: false, lists: [], activeId: null, roll: null, glass: 0.55, sound: true, soundTheme: 'clear', outAlt: false };
  try {
    var raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') {
      for (var k in base) { if (raw[k] === undefined) raw[k] = base[k]; }
      if (!Array.isArray(raw.lists)) raw.lists = [];
      return raw;
    }
  } catch (e) {}
  return base;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('存储失败，空间可能不足'); }
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function pad2(n) { return n < 10 ? '0' + n : '' + n; }
var xlsxState = 0;
function ensureXLSX(cb) {
  if (window.XLSX) { cb(); return; }
  if (xlsxState === 2) { cb(); return; }
  if (xlsxState === 1) {
    var poll = setInterval(function () { if (xlsxState === 2) { clearInterval(poll); cb(); } }, 100);
    return;
  }
  xlsxState = 1;
  var s = document.createElement('script');
  s.src = 'vendor/xlsx.full.min.js';
  s.onload = function () { xlsxState = 2; cb(); };
  s.onerror = function () { xlsxState = 0; toast('Excel 解析组件加载失败，请联网重试'); };
  document.head.appendChild(s);
}
function today() {
  var d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function stamp(ts) {
  var d = new Date(ts);
  return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
function list() {
  for (var i = 0; i < S.lists.length; i++) { if (S.lists[i].id === S.activeId) return S.lists[i]; }
  return null;
}
function stLabel(st) { return st === 'in' ? '到' : st === 'out' ? '缺席' : st === 'leave' ? '请假' : '未记录'; }
function rollAll(r) { return r.all && r.all.length ? r.all : (r.order || []); }

var toastTimer = null;
function toast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.remove('on'); }, 1700);
}

var lastView = null;
function applyGlass() {
  document.documentElement.style.setProperty('--glass-a', S.glass);
}
var audioCtx = null;
var sndKeys = ['in0', 'in1', 'in2', 'in3', 'in4', 'out', 'out-alt', 'leave'];
var snd = { ready: false, files: {}, ok: {} };
function ensureSnd() {
  if (snd.ready) return;
  snd.ready = true;
  sndKeys.forEach(function (k) {
    var a = new Audio('sounds/' + k + '.mp3');
    a.preload = 'auto';
    a.addEventListener('canplay', function () { snd.ok[k] = true; });
    a.addEventListener('error', function () { snd.ok[k] = false; });
    try { a.load(); } catch (e) {}
    snd.files[k] = a;
  });
}
function playSnd(k, onFail) {
  sndKeys.forEach(function (x) {
    var a = snd.files[x];
    if (a && x !== k) { try { a.pause(); a.currentTime = 0; } catch (e) {} }
  });
  var a = snd.files[k];
  if (!a) return false;
  try {
    a.currentTime = 0;
    var p = a.play();
    if (p && p.catch) { p.catch(function () { if (onFail) onFail(); }); }
    return true;
  } catch (e) { return false; }
}
function synth(type) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  var th = S.soundTheme || 'clear';
  var t = audioCtx.currentTime;
  function tone(f0, f1, dur, wave, vol, delay) {
    delay = delay || 0;
    var o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(f0, t + delay);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + delay + dur);
    g.gain.setValueAtTime(0.0001, t + delay);
    g.gain.exponentialRampToValueAtTime(vol, t + delay + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t + delay); o.stop(t + delay + dur + 0.03);
  }
  if (type === 'in') {
    if (th === 'soft') { tone(660, 660, .14, 'sine', .10); tone(880, 880, .2, 'sine', .10, .12); }
    else if (th === 'wood') { tone(520, 520, .12, 'triangle', .14); tone(700, 700, .18, 'triangle', .12, .1); }
    else if (th === 'retro') { tone(660, 660, .08, 'square', .08); tone(880, 880, .08, 'square', .08, .08); tone(1100, 1100, .1, 'square', .08, .16); }
    else { tone(880, 1318, .18, 'sine', .15); tone(1318, 1760, .2, 'sine', .12, .12); }
  } else if (type === 'out') {
    if (th === 'soft') { tone(300, 180, .3, 'sine', .10); }
    else if (th === 'wood') { tone(240, 160, .28, 'triangle', .14); }
    else if (th === 'retro') { tone(200, 120, .3, 'square', .10); tone(150, 90, .3, 'square', .08, .06); }
    else { tone(392, 392, .18, 'triangle', .12); tone(311, 311, .18, 'triangle', .12, .09); tone(262, 262, .3, 'triangle', .12, .18); }
  } else {
    if (th === 'soft') { tone(520, 780, .2, 'sine', .10); }
    else if (th === 'wood') { tone(660, 520, .2, 'triangle', .12); }
    else if (th === 'retro') { tone(440, 660, .16, 'square', .08); tone(660, 880, .18, 'square', .08, .12); }
    else { tone(523, 523, .12, 'triangle', .12); tone(659, 659, .12, 'triangle', .12, .1); tone(784, 1046, .22, 'triangle', .13, .2); }
  }
}
var inStreak = 0;
function soundKeyFor(type) {
  if (type === 'in') return 'in' + Math.min(inStreak, 4);
  if (type === 'out' && S.outAlt) return 'out-alt';
  return type;
}
function synthType(key) {
  if (key.indexOf('in') === 0) return 'in';
  if (key === 'out-alt') return 'out';
  return key;
}
function beep(type) {
  beepKey(soundKeyFor(type));
}
function beepKey(key) {
  try {
    if (!S.sound) return;
    ensureSnd();
    var t = synthType(key);
    if (!playSnd(key, function () { synth(t); })) synth(t);
  } catch (e) {}
}
try {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureSnd);
  else ensureSnd();
} catch (e) {}
function render() {
  document.body.setAttribute('data-theme', S.theme === 'dark' ? 'dark' : 'light');
  applyGlass();
  var app = document.getElementById('app');
  var keepScroll = V.name === lastView;
  var scEls = app.querySelectorAll('.wrap, .homecenter');
  var saved = [];
  for (var si = 0; si < scEls.length; si++) saved.push(scEls[si].scrollTop);
  var html = '';
  if (V.name === 'roll') html = viewRoll();
  else if (V.name === 'summary') html = viewSummary();
  else if (V.name === 'lists') html = viewLists();
  else if (V.name === 'members') html = viewMembers();
  else if (V.name === 'history') html = viewHistory();
  else if (V.name === 'batch') html = viewBatch();
  else if (V.name === 'edit') html = viewEdit();
  else if (V.name === 'settings') html = viewSettings();
  else html = viewHome();
  app.innerHTML = html;
  if (keepScroll) {
    var scEls2 = app.querySelectorAll('.wrap, .homecenter');
    for (var sj = 0; sj < scEls2.length && sj < saved.length; sj++) scEls2[sj].scrollTop = saved[sj];
  }
  lastView = V.name;
  bind();
}

function header(title, sub, right) {
  return `<div class="hd"><div class="hdt"><h1>${esc(title)}</h1>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>
    <div class="hdacts">${right || ''}</div></div>`;
}
function backBtn(act) {
  return `<button class="iconbtn back" data-act="${act}" aria-label="返回"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
}
function gearBtn() {
  return `<button class="iconbtn" data-act="goSettings" aria-label="设置"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm0 0v-1M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.7 6.7l1.4 1.4M15.9 15.9l1.4 1.4M6.7 17.3l1.4-1.4M15.9 8.1l1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>`;
}
function swapIcon() {
  return `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M8 7h12m0 0l-3-3m3 3l-3 3M16 17H4m0 0l3 3m-3-3l3-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/* ---------------- 趣味与动效 ---------------- */
function fishSvg() {
  return `<svg class="mascot" viewBox="0 0 64 64" aria-hidden="true"><path d="M8 32C16 20 36 19 46 29L56 21V43L46 35C36 45 16 44 8 32Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="36" cy="28.5" r="2.2" fill="currentColor"/></svg>`;
}
function fullQuip(id) {
  var lines = ['这轮漂亮，一个都没少。', '全员到齐，可以收工了。', '今天的出勤，稳。', '点名完成，继续保持。'];
  var s = String(id || ''), n = 0;
  for (var i = 0; i < s.length; i++) n += s.charCodeAt(i);
  return lines[n % lines.length];
}
function streakCount(L) {
  if (!L || !Array.isArray(L.batches)) return 0;
  var n = 0;
  for (var i = 0; i < L.batches.length; i++) {
    var c = batchStats(L.batches[i]);
    if (c.in > 0 && c.out === 0 && c.leave === 0 && c.none === 0) n++;
    else break;
  }
  return n;
}
function countUp() {
  var els = document.querySelectorAll('.stat b');
  if (!els.length) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  els.forEach(function (el) {
    var target = parseInt(el.textContent, 10) || 0;
    if (reduce || target === 0) return;
    var t0 = performance.now(), dur = 520;
    el.textContent = '0';
    function step(t) {
      var p = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * e));
      if (p < 1) requestAnimationFrame(step); else el.textContent = String(target);
    }
    requestAnimationFrame(step);
  });
}
function confetti(n) {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var cv = document.createElement('canvas');
  cv.className = 'confetti';
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var W = window.innerWidth, H = window.innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  document.body.appendChild(cv);
  var ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  var cols = ['#1f6b4e', '#a83a28', '#2c5a85', '#e0b34c', '#23211c'];
  var ps = [];
  for (var i = 0; i < n; i++) {
    ps.push({
      x: W / 2 + (Math.random() - .5) * W * .4,
      y: H * .42 + (Math.random() - .5) * 40,
      vx: (Math.random() - .5) * 7,
      vy: -(4 + Math.random() * 7),
      g: .3 + Math.random() * .12,
      w: 3 + Math.random() * 4,
      h: 6 + Math.random() * 6,
      c: cols[(Math.random() * cols.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - .5) * .3
    });
  }
  var t0 = performance.now(), dur = 1900;
  function frame(t) {
    var el = t - t0;
    if (el > dur) { cv.remove(); return; }
    ctx.clearRect(0, 0, W, H);
    for (var j = 0; j < ps.length; j++) {
      var p = ps[j];
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - el / dur);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ---------------- 首页 ---------------- */
function viewHome() {
  var L = list();
  var body = '';
  if (!L) {
    body = `<div class="homecenter">
      <div class="emptycard">
        ${fishSvg()}
        <div class="k">还没有名单</div>
        <div class="n">先建一套名单</div>
        <div class="meta">一套名单对应一个班或场合，可建多套随时切换</div>
      </div>
      <div class="homeacts"><button class="btn btn-main" data-act="newList">新建名单</button>
      <button class="btn btn-line" data-act="importHome">从 Excel 导入名册</button></div>
    </div>`;
  } else {
    var rounds = L.batches ? L.batches.length : 0;
    var resume = '';
    if (S.roll && S.roll.listId === L.id) {
      var r = S.roll;
      var done = Object.keys(r.res || {}).length;
      resume = `<div class="resume"><p>本轮未完成：${esc(r.batchName)}　已完成 ${done} / ${rollAll(r).length}</p>
        <div class="row"><button class="mini primary" data-act="resumeRoll">继续本轮</button>
        <button class="mini danger" data-act="dropRoll">放弃本轮</button></div></div>`;
    }
    var last = L.batches && L.batches.length ? L.batches[0] : null;
    var lastHtml = '';
    if (last) {
      var lc = batchStats(last);
      var absent = [];
      (last.records || []).forEach(function (x) { if (x.st === 'out') absent.push(x.name); });
      var tail = absent.length
        ? '缺席：' + esc(absent.slice(0, 4).join('、')) + (absent.length > 4 ? ' 等 ' + absent.length + ' 人' : '')
        : (lc.none ? lc.none + ' 人未记录' : '全员到齐，漂亮');
      lastHtml = `<button class="lastcard" data-act="openLast" data-id="${last.id}">
        <div class="lc-top"><span>上一轮</span><span>${last.createdAt ? stamp(last.createdAt) : ''} ›</span></div>
        <div class="lc-stats"><b class="in">${lc.in}</b><span>到</span><b class="out">${lc.out}</b><span>缺</span><b class="leave">${lc.leave}</b><span>假</span>${lc.none ? `<em>${lc.none} 未记录</em>` : ''}</div>
        <div class="lc-names">${tail}</div>
      </button>`;
    }
    var st = streakCount(L);
    var streakHtml = st >= 2 ? `<div class="streak">连续 ${st} 轮全勤</div>` : '';
    body = `<div class="homecenter">
      <div class="listlabel">当前名单</div>
      <div class="listnamewrap">
        <div class="listname">${esc(L.name)}</div>
        <button class="swapbtn" data-act="swapList" aria-label="更换名单">${swapIcon()}</button>
      </div>
      <div class="listmeta">${L.members.length} 人 · 已点 ${rounds} 轮</div>
      ${streakHtml}
      ${resume}
      <button class="roundbtn" data-act="startRoll" aria-label="开始点名">
        <svg class="play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>
        <span class="rbt">开始点名</span>
        <span class="rbs">轻点开始 · 可随时暂停</span>
      </button>
      <div class="gestures" aria-hidden="true">
        <span class="gchip in">→ 到</span><span class="gchip out">← 缺席</span><span class="gchip leave">↓ 请假</span>
      </div>
      ${lastHtml}
    </div>
    <div class="homebottom">
      <button class="hbtn" data-act="goLists"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>名单管理</button>
      <button class="hbtn" data-act="goHistory"><svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v4l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>历史记录</button>
    </div>`;
  }
  return header('点名考勤', '', gearBtn()) + body;
}

/* ---------------- 名单快速切换 ---------------- */
function showSwapDialog() {
  var m = mask();
  var rows = S.lists.map(function (l) {
    var cur = l.id === S.activeId;
    return `<button class="swapitem ${cur ? 'cur' : ''}" data-swap="${l.id}">
      <span class="si-n">${esc(l.name)}</span>
      <span class="si-m">${l.members.length} 人</span>
      ${cur ? '<span class="si-tag">当前</span>' : ''}
    </button>`;
  }).join('');
  m.hidden = false;
  m.innerHTML = `<div class="dlg">
    <h3>切换名单</h3>
    <div class="swapwrap">${rows || '<div class="muted">暂无名单</div>'}</div>
    <div class="btns">
      <button class="btn btn-line" data-dlg="cancel">取消</button>
      <button class="btn btn-main" data-dlg="new">新建名单</button>
    </div></div>`;
  m.querySelector('[data-dlg="cancel"]').onclick = closeDialog;
  m.querySelector('[data-dlg="new"]').onclick = function () {
    closeDialog();
    var nl = createList(); V.name = 'members'; V.q = ''; render();
    toast('已新建名单「' + nl.name + '」，先添加人员');
  };
  m.querySelectorAll('[data-swap]').forEach(function (b) {
    b.onclick = function () {
      S.activeId = b.getAttribute('data-swap'); save();
      closeDialog(); render(); toast('已切换名单');
    };
  });
}

/* ---------------- 点名 ---------------- */
function viewRoll() {
  var r = S.roll, L = list();
  if (!r || !L) return viewHome();
  if (!r.order.length) { setTimeout(finalizeRoll, 0); return '<div class="tip" style="padding-top:40px">正在结算…</div>'; }
  var m = memberById(r.order[r.idx]);
  var pct = r.order.length ? (r.idx / r.order.length * 100) : 0;
  var remain = r.order.length - r.idx;
  var undoBtn = `<button class="iconbtn" data-act="undoMark" aria-label="撤销"${r.idx > 0 ? '' : ' disabled'}><svg viewBox="0 0 24 24" width="20" height="20"><path d="M9 13l-4-4 4-4M5 9h9a5 5 0 010 10h-2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
  var exitBtn = `<button class="iconbtn" data-act="exitRoll" aria-label="退出"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>`;
  var prog = r.order.length ? ((r.idx + 1) / r.order.length * 100) : 0;
  function peek(i) {
    var mi = r.order[r.idx + i];
    return mi ? `<div class="stackcard s${i}"><span>${esc(memberById(mi).name)}</span></div>` : '';
  }
  return `${header('正在点名', r.batchName, undoBtn + exitBtn)}
    <div class="track"><i style="width:${pct}%"></i></div>
    <div class="rollq">
      <input id="rollq" aria-label="搜索成员" placeholder="搜姓名/学号，点结果跳转" value="${esc(V.rollQ)}">
      <div id="rollhits" class="rollhits" hidden></div>
    </div>
    <div class="deck">
      <div class="stack">${peek(2)}${peek(1)}</div>
      <div class="card3d enter" id="card" data-tint="">
        <div class="cardtop"><span>#${pad2(r.idx + 1)}</span><span>${r.idx + 1} / ${r.order.length}</span></div>
        <div class="cardbar"><i style="width:${prog}%"></i></div>
        <div class="nm">${esc(m.name)}</div>
        ${m.note ? `<div class="nt">${esc(m.note)}</div>` : ''}
        <div class="sidline">${esc(m.sid || '—')}</div>
        <div class="ft"><span>本轮第 ${r.idx + 1} 位</span><span>余 ${remain} 人</span></div>
      </div>
    </div>
    <div class="gestures" aria-hidden="true">
      <span class="gchip in">→ 到</span><span class="gchip out">← 缺席</span><span class="gchip leave">↓ 请假</span>
    </div>
    <div class="acts">
      <button class="btn btn-out" data-mark="out">缺席</button>
      <button class="btn btn-leave" data-mark="leave">请假</button>
      <button class="btn btn-in" data-mark="in">到了</button>
    </div>`;
}
function memberById(id) {
  var L = list();
  if (!L) return { name: '', sid: '', note: '' };
  for (var i = 0; i < L.members.length; i++) { if (L.members[i].id === id) return L.members[i]; }
  return { name: '(已删除)', sid: '', note: '' };
}
function rollCounts(r) {
  var c = { in: 0, out: 0, leave: 0 };
  for (var k in (r.res || {})) { if (c[r.res[k]] !== undefined) c[r.res[k]]++; }
  return c;
}

/* 手势：拖动跟随 + 实时配色 + 松手判定 */
function bindRoll() {
  var card = document.getElementById('card');
  if (!card) return;
  var sx = 0, sy = 0, dx = 0, dy = 0, on = false;
  card.addEventListener('pointerdown', function (e) {
    on = true; sx = e.clientX; sy = e.clientY; dx = 0; dy = 0;
    card.classList.remove('enter', 'fly');
    card.style.transition = 'none';
    try { card.setPointerCapture(e.pointerId); } catch (err) {}
  });
  card.addEventListener('pointermove', function (e) {
    if (!on) return;
    dx = e.clientX - sx; dy = e.clientY - sy;
    if (Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) > 8) {
      card.setAttribute('data-tint', dx > 0 ? 'in' : 'out');
      card.style.transform = 'translate(' + dx + 'px,' + (dy * .1) + 'px) rotate(' + (dx / 80) + 'deg) scale(1.03)';
    } else if (dy > 8) {
      card.setAttribute('data-tint', 'leave');
      card.style.transform = 'translate(0,' + dy + 'px) scale(1.03)';
    } else {
      card.setAttribute('data-tint', '');
      card.style.transform = 'translate(' + dx * .3 + 'px,' + dy * .3 + 'px)';
    }
  });
  function end(e) {
    if (!on) return;
    on = false;
    card.style.transition = '';
    var st = '';
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx > 70) st = 'in'; else if (dx < -70) st = 'out';
    } else if (dy > 70) st = 'leave';
    card.setAttribute('data-tint', '');
    if (st) mark(st);
    else { card.style.transform = ''; }
    dx = 0; dy = 0;
  }
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', function () {
    on = false; card.style.transition = ''; card.style.transform = ''; card.setAttribute('data-tint', '');
  });
}

/* 点名中的搜索 / 跳转 */
function bindRollSearch() {
  var inp = document.getElementById('rollq');
  var hits = document.getElementById('rollhits');
  if (!inp || !hits) return;
  function doSearch() {
    var r = S.roll, L = list();
    if (!r || !L) return;
    var q = inp.value.trim();
    V.rollQ = q;
    var rows = [];
    for (var i = 0; i < r.order.length; i++) {
      if (i < r.idx) continue;
      var m = memberById(r.order[i]);
      if (!q || m.name.indexOf(q) >= 0 || (m.sid || '').indexOf(q) >= 0) {
        rows.push({ i: i, m: m });
        if (rows.length >= 8) break;
      }
    }
    if (q && rows.length) {
      hits.innerHTML = rows.map(function (x) {
        return `<button class="hit" data-jump="${x.i}"><span class="hn">${esc(x.m.name)}</span><span class="hs">${esc(x.m.sid)}</span><span class="hi">第 ${x.i + 1} 位</span></button>`;
      }).join('');
      hits.hidden = false;
    } else { hits.hidden = true; hits.innerHTML = ''; }
  }
  inp.oninput = doSearch;
  inp.onfocus = doSearch;
  hits.onclick = function (e) {
    var btn = e.target.closest('[data-jump]');
    if (!btn) return;
    var r = S.roll;
    r.idx = Number(btn.getAttribute('data-jump'));
    V.rollQ = '';
    save(); render();
  };
}

/* 记一个人，飞出去再换下一张（带防连点锁） */
var busy = false;
function mark(st) {
  var r = S.roll;
  if (!r || busy) return;
  busy = true;
  var card = document.getElementById('card');
  r.res[r.order[r.idx]] = st;
  save();
  function next() {
    r.idx++;
    busy = false;
    if (r.idx >= r.order.length) { finalizeRoll(); return; }
    save(); render();
  }
  if (!card) { next(); return; }
  card.classList.add('fly');
  if (st === 'in') { card.style.transform = 'translateX(120%) rotate(6deg) scale(.96)'; }
  else if (st === 'out') { card.style.transform = 'translateX(-120%) rotate(-6deg) scale(.96)'; }
  else { card.style.transform = 'translateY(-115%) scale(.96)'; }
  card.style.opacity = '0';
  beep(st);
  inStreak = (st === 'in') ? inStreak + 1 : 0;
  try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
  setTimeout(next, 190);
}

/* 撤销上一步 */
function undoMark() {
  var r = S.roll;
  if (!r || busy) return;
  if (r.idx <= 0) { toast('已经是第一位了'); return; }
  r.idx--;
  var was = r.res[r.order[r.idx]];
  delete r.res[r.order[r.idx]];
  if (was === 'in') inStreak = Math.max(0, inStreak - 1); else inStreak = 0;
  save(); render();
}

function finalizeRoll() {
  var r = S.roll, L = list();
  if (!r || !L) { V.name = 'home'; render(); return; }
  var all = rollAll(r);
  var records = [];
  for (var i = 0; i < all.length; i++) {
    var m = memberById(all[i]);
    records.push({ mid: all[i], name: m.name, sid: m.sid, note: m.note || '', st: r.res[all[i]] || '' });
  }
  var batch = { id: r.batchId, name: r.batchName, createdAt: Date.now(), records: records };
  if (!Array.isArray(L.batches)) L.batches = [];
  L.batches.unshift(batch);
  var cs = batchStats(batch);
  if (cs.in > 0 && cs.out === 0 && cs.leave === 0 && cs.none === 0) V.party = batch.id;
  S.roll = null;
  save();
  try { if (navigator.vibrate) navigator.vibrate([10, 36, 14]); } catch (e) {}
  V.name = 'summary'; V.batchId = batch.id;
  render();
}

/* ---------------- 本轮结算 ---------------- */
function batchById(id) {
  var L = list();
  if (!L || !Array.isArray(L.batches)) return null;
  for (var i = 0; i < L.batches.length; i++) { if (L.batches[i].id === id) return L.batches[i]; }
  return null;
}
function batchStats(b) {
  var c = { in: 0, out: 0, leave: 0, none: 0 };
  var rs = (b && b.records) || [];
  for (var i = 0; i < rs.length; i++) {
    var st = rs[i].st;
    if (c[st] !== undefined) c[st]++; else c.none++;
  }
  return c;
}
function viewSummary() {
  var b = batchById(V.batchId);
  if (!b) return viewHome();
  var c = batchStats(b);
  var outNames = [], leaveNames = [], noneNames = [];
  b.records.forEach(function (x) {
    if (x.st === 'out') outNames.push(x.name);
    else if (x.st === 'leave') leaveNames.push(x.name + (x.note ? '（' + x.note + '）' : ''));
    else if (!x.st) noneNames.push(x.name);
  });
  var full = c.in > 0 && c.out === 0 && c.leave === 0 && c.none === 0;
  var banner = full ? `<div class="celebrate">${fishSvg()}<div><div class="big">全勤 · 一个都没少</div><div class="muted">${c.in} 人到齐，本轮点名完成</div></div></div>` : '';
  return `${header('本轮结束', b.name, backBtn('homeFromSummary'))}
  <div class="wrap">
    ${banner}
    <div class="stats">
      <div class="stat in${c.in ? '' : ' zero'}"><b>${c.in}</b><span>到了</span></div>
      <div class="stat out${c.out ? '' : ' zero'}"><b>${c.out}</b><span>缺席</span></div>
      <div class="stat leave${c.leave ? '' : ' zero'}"><b>${c.leave}</b><span>请假</span></div>
    </div>
    ${outNames.length ? `<div class="sec"><div class="t"><span>缺席 ${outNames.length} 人</span></div>
      <div class="chips">${outNames.map(function (n) { return `<span class="chip">${esc(n)}</span>`; }).join('')}</div></div>` : ''}
    ${leaveNames.length ? `<div class="sec"><div class="t"><span>请假 ${leaveNames.length} 人</span></div>
      <div class="chips">${leaveNames.map(function (n) { return `<span class="chip leave">${esc(n)}</span>`; }).join('')}</div></div>` : ''}
    ${noneNames.length ? `<div class="sec"><div class="t"><span>未记录 ${noneNames.length} 人</span></div>
      <div class="chips">${noneNames.map(function (n) { return `<span class="chip gray">${esc(n)}</span>`; }).join('')}</div></div>` : ''}
    <div class="sec"><button class="btn btn-line" data-act="showExport" style="width:100%">导出 / 分享</button></div>
    <div class="sec"><button class="btn btn-line" data-act="goEdit" style="width:100%">调整结果（拖拽改）</button></div>
    <div class="sec"><button class="btn btn-main" data-act="homeFromSummary" style="width:100%">回到首页</button></div>
    ${full ? `<div class="fishline">${fishSvg()}<span>${fullQuip(b.id)}</span></div>` : ''}
  </div>`;
}

function summaryText(b) {
  var L = list();
  var c = batchStats(b);
  var lines = [];
  lines.push((L ? L.name : '点名') + ' · ' + b.name);
  lines.push('到 ' + c.in + ' ｜ 缺席 ' + c.out + ' ｜ 请假 ' + c.leave + (c.none ? ' ｜ 未记录 ' + c.none : ''));
  var o = [], l = [];
  b.records.forEach(function (x) {
    if (x.st === 'out') o.push(x.name);
    if (x.st === 'leave') l.push(x.name);
  });
  lines.push('缺席：' + (o.length ? o.join('、') : '无'));
  lines.push('请假：' + (l.length ? l.join('、') : '无'));
  return lines.join('\n');
}
function tableText(b) {
  var lines = ['序号\t姓名\t学号\t状态\t备注'];
  b.records.forEach(function (x, i) {
    lines.push([i + 1, x.name, x.sid, stLabel(x.st), x.note || ''].join('\t'));
  });
  return lines.join('\n');
}
function copyText(text, ok) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () { toast(ok); }, function () { fallbackCopy(text, ok); });
  } else fallbackCopy(text, ok);
}
function fallbackCopy(text, ok) {
  var ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try { document.execCommand('copy'); toast(ok); } catch (e) { toast('复制失败，请长按选择'); }
  document.body.removeChild(ta);
}

/* ---------------- 一键出图（PNG，完整名单） ---------------- */
function genImage(action) {
  var b = batchById(V.batchId);
  if (!b) return;
  var L = list();
  var c = batchStats(b);
  var W = 1240, pad = 48;
  var rowH = 44, headH = 300, footH = 40;
  var H = headH + (b.records.length + 1) * rowH + footH;
  var cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  var ctx = cv.getContext('2d');

  ctx.fillStyle = '#f7f5f0'; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#1b1b1a';
  ctx.font = '700 52px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillText((L ? L.name : '点名'), pad, 66);
  ctx.fillStyle = '#65615a';
  ctx.font = '400 28px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillText(b.name + ' · ' + stamp(b.createdAt), pad, 122);

  var sw = (W - pad * 2 - 20) / 3;
  var sy = 150, sh = 112;
  var stats = [
    { k: '到了', v: c.in, c: '#2c7256', bg: '#e1efe7' },
    { k: '缺席', v: c.out, c: '#ac4f38', bg: '#f6e3dc' },
    { k: '请假', v: c.leave, c: '#2f5d8a', bg: '#e2ebf4' }
  ];
  stats.forEach(function (s, i) {
    var x = pad + i * (sw + 10);
    ctx.fillStyle = s.bg;
    roundRect(ctx, x, sy, sw, sh, 14); ctx.fill();
    ctx.fillStyle = s.c;
    ctx.font = '700 46px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(String(s.v), x + 24, sy + 40);
    ctx.font = '400 24px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(s.k, x + 24, sy + 84);
  });

  var ty = headH - 34;
  ctx.fillStyle = '#1b1b1a';
  ctx.fillRect(pad, ty, W - pad * 2, 3);
  var cols = [
    { x: pad, w: 76, t: '序号', a: 'left' },
    { x: pad + 86, w: 300, t: '姓名', a: 'left' },
    { x: pad + 400, w: 230, t: '学号', a: 'left' },
    { x: pad + 640, w: 120, t: '状态', a: 'left' },
    { x: pad + 770, w: W - pad - pad - 770, t: '备注', a: 'left' }
  ];
  ctx.fillStyle = '#65615a';
  ctx.font = '600 24px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
  cols.forEach(function (col) { ctx.fillText(col.t, col.x, headH - rowH / 2); });

  var stColor = { in: '#2c7256', out: '#ac4f38', leave: '#2f5d8a' };
  function clip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }
  b.records.forEach(function (x, i) {
    var y = headH + rowH / 2 + i * rowH;
    if (i % 2 === 0) { ctx.fillStyle = '#f0ece3'; ctx.fillRect(0, y - rowH / 2, W, rowH); }
    ctx.font = '400 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#9a948a'; ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), cols[0].x + cols[0].w / 2, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1b1b1a';
    ctx.font = '500 27px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(clip(x.name, 9), cols[1].x, y);
    ctx.font = '400 25px ui-monospace,Menlo,monospace';
    ctx.fillStyle = '#65615a';
    ctx.fillText(x.sid || '', cols[2].x, y);
    ctx.fillStyle = stColor[x.st] || '#9a948a';
    ctx.font = '600 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(stLabel(x.st), cols[3].x, y);
    ctx.fillStyle = '#65615a';
    ctx.font = '400 24px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(clip(x.note, 13), cols[4].x, y);
    ctx.textAlign = 'left';
  });

  var fname = '点名_' + b.name + '.png';
  if (action === 'share' && navigator.share) {
    cv.toBlob(function (blob) {
      if (!blob) { toast('生成失败'); return; }
      var file = new File([blob], fname, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: '点名结果' }).catch(function () {});
      } else { downloadBlob(blob, fname); }
    }, 'image/png');
  } else {
    cv.toBlob(function (blob) { if (blob) downloadBlob(blob, fname); else toast('生成失败'); }, 'image/png');
  }
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function downloadBlob(blob, fname) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = fname;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  toast('图片已生成，请查看下载');
}

/* ---------------- 名单管理 ---------------- */
function viewLists() {
  var rows = S.lists.map(function (l) {
    var cur = l.id === S.activeId;
    var rounds = l.batches ? l.batches.length : 0;
    return `<div class="lrow"><div class="main">
        <div class="t1">${esc(l.name)}${cur ? ' <span class="tagcur">当前</span>' : ''}</div>
        <div class="t2">${l.members.length} 人 · 已点 ${rounds} 轮</div>
      </div><div class="ops">
        ${cur ? '' : `<button class="mini" data-act="switchList" data-id="${l.id}">切换</button>`}
        <button class="mini" data-act="renameList" data-id="${l.id}">改名</button>
        <button class="mini" data-act="editMembers" data-id="${l.id}">成员</button>
        <button class="mini danger" data-act="delList" data-id="${l.id}">删</button>
      </div></div>`;
  }).join('');
  return header('名单管理', '可建多套，随时切换', backBtn('goHome')) +
    `<div class="wrap">${rows || '<div class="tip" style="padding-top:14px">还没有名单</div>'}
      <div style="height:12px"></div>
      <button class="btn btn-main" data-act="newList">新建名单</button>
    </div>
    <div class="bottom"><button class="mini" data-act="goHome">返回首页</button>
      <button class="mini" data-act="goSettings">设置</button></div>`;
}

/* ---------------- 成员编辑 ---------------- */
function viewMembers() {
  var L = list();
  if (!L) return viewHome();
  var q = V.q || '';
  var sel = V.selMode ? (V.selIds || {}) : null;
  var rows = L.members.map(function (m, i) {
    var hide = q && (m.name.indexOf(q) < 0 && m.sid.indexOf(q) < 0);
    var cb = sel ? `<label class="mcheck"><input type="checkbox" data-mid="${m.id}" ${sel[m.id] ? 'checked' : ''}></label>` : '';
    return `<div class="mrow ${sel ? 'sel' : ''}" data-row="${i}" style="${hide ? 'display:none' : ''}">
      ${cb}<div class="idx">${i + 1}</div>
      <div class="f">
        <input class="nm-i" data-mi="${i}" data-f="name" value="${esc(m.name)}" placeholder="姓名" aria-label="第 ${i + 1} 位姓名">
        <input class="sid-i" data-mi="${i}" data-f="sid" value="${esc(m.sid)}" placeholder="学号" aria-label="第 ${i + 1} 位学号">
        <input class="note-i" data-mi="${i}" data-f="note" value="${esc(m.note)}" placeholder="备注（可留空）" aria-label="第 ${i + 1} 位备注">
      </div>
    </div>`;
  }).join('');
  var tool = sel
    ? `<div class="selbar">
        <button class="mini" data-act="selAll">全选</button>
        <button class="mini" data-act="selNone">全不选</button>
        <button class="mini danger" data-act="delSel">删除</button>
        <button class="mini" data-act="selCancel">取消</button>
      </div>`
    : `<div class="row" style="gap:8px;margin-top:10px">
        <button class="mini" data-act="importMembers" style="flex:1">从 Excel 导入</button>
        <button class="mini" data-act="importPaste" style="flex:1">粘贴导入</button>
        <button class="mini" data-act="selStart" style="flex:1">选择</button>
      </div>`;
  return header(L.name + ' · 成员', L.members.length + ' 人', backBtn('goLists')) +
    `<div class="wrap">
      <input id="search" aria-label="搜索成员" value="${esc(q)}" placeholder="搜姓名或学号" style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:11px;background:var(--card);color:var(--ink);font-size:15px">
      ${sel ? `<div class="selhint">已选 <span id="selCount">${Object.keys(sel).length}</span> 人</div>` : ''}
      ${sel ? '' : `<div class="addbox" style="margin-top:12px">
        <div class="fields">
          <input id="addName" aria-label="新成员姓名" placeholder="姓名（必填）">
          <input id="addSid" aria-label="新成员学号" placeholder="学号">
          <input id="addNote" aria-label="新成员备注" placeholder="备注（如：走读、转专业）">
        </div>
        <button class="btn btn-line" data-act="addMember">添加到名单</button>
      </div>`}
      ${tool}
      <div style="margin-top:14px" class="muted">${sel ? '勾选要删的人，点「删除」；点「取消」退出。' : '直接改输入框即可修改，改动自动保存'}</div>
      ${rows || '<div class="tip" style="padding-top:12px">名单还是空的，先添加人员，或用「从 Excel 导入」一次性导入名册</div>'}
    </div>`;
}

/* ---------------- 名册导入（xlsx / csv / json / 粘贴） ---------------- */
function pickRosterFile() {
  var fi = document.createElement('input');
  fi.type = 'file';
  fi.accept = '.xlsx,.xls,.csv,.txt,.json,application/json,text/csv';
  fi.onchange = function () {
    var f = fi.files && fi.files[0];
    if (!f) return;
    var name = (f.name || '').toLowerCase();
    if (name.indexOf('.xlsx') >= 0 || name.indexOf('.xls') >= 0) {
      toast('正在加载 Excel 解析组件…');
      ensureXLSX(function () {
        var r = new FileReader();
        r.onload = function () {
          try {
            var wb = XLSX.read(new Uint8Array(r.result), { type: 'array' });
            var ws = wb.Sheets[wb.SheetNames[0]];
            var rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
            var text = rows.map(function (row) {
              return row.map(function (c) { return String(c == null ? '' : c); }).join('\t');
            }).join('\n');
            var parsed = parseImport(text);
            if (!parsed) { toast('没解析到成员，确认表里有「姓名/学号」列'); return; }
            showImportConfirm(parsed);
          } catch (err) { toast('解析失败：' + (err && err.message ? err.message : '未知')); }
        };
        r.readAsArrayBuffer(f);
      });
      return;
    }
    var fr = new FileReader();
    fr.onload = function () {
      var parsed = parseImport(String(fr.result));
      if (!parsed) { toast('无法识别该文件，请用 Excel/CSV/JSON'); return; }
      showImportConfirm(parsed);
    };
    fr.readAsText(f);
  };
  fi.click();
}
function showPasteDialog() {
  var m = mask();
  m.hidden = false;
  m.innerHTML = `<div class="dlg">
    <h3>粘贴导入成员</h3>
    <div class="muted" style="margin-bottom:8px">每行一人，格式：姓名 学号 备注（用 Tab 或逗号隔开），也可直接贴 Excel 复制的内容。</div>
    <textarea id="dlgText" rows="7" placeholder="金果\t0243946\t走读"></textarea>
    <div class="btns">
      <button class="btn btn-line" data-dlg="cancel">取消</button>
      <button class="btn btn-main" data-dlg="ok">解析导入</button>
    </div></div>`;
  m.querySelector('[data-dlg="cancel"]').onclick = closeDialog;
  m.querySelector('[data-dlg="ok"]').onclick = function () {
    var text = document.getElementById('dlgText').value;
    var parsed = parseImport(text);
    closeDialog();
    if (!parsed) { toast('没解析到成员，检查格式'); return; }
    showImportConfirm(parsed);
  };
}
function parseImport(text) {
  text = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!text) return null;
  if (text[0] === '[' || text[0] === '{') {
    try {
      var d = JSON.parse(text);
      if (Array.isArray(d)) { var m = normMembers(d); return m.length ? { members: m } : null; }
      if (d && Array.isArray(d.members)) { var m2 = normMembers(d.members); return m2.length ? { members: m2, name: d.name } : null; }
      if (d && Array.isArray(d.lists)) return { backup: d };
      return null;
    } catch (e) {}
  }
  var m3 = parseTable(text);
  return m3 && m3.length ? { members: m3 } : null;
}
function normMembers(arr) {
  var out = [];
  (arr || []).forEach(function (x) {
    if (!x || typeof x !== 'object') return;
    var name = String(x.name != null ? x.name : (x.姓名 || '')).trim();
    var sid = String(x.sid != null ? x.sid : (x.学号 || '')).trim();
    var note = String(x.note != null ? x.note : (x.备注 || '')).trim();
    if (note === '1') note = '';
    if (!name && !sid) return;
    out.push({ name: name || '（无姓名）', sid: sid, note: note });
  });
  return out;
}
function parseTable(text) {
  var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
  if (!lines.length) return null;
  var delim = lines[0].indexOf('\t') >= 0 ? '\t' : (lines[0].split(',').length >= 2 ? ',' : ' ');
  function split(l) { return l.split(delim).map(function (s) { return s.trim().replace(/^"|"$/g, ''); }); }
  var head = split(lines[0]).map(function (h) { return h.toLowerCase().replace(/\s/g, ''); });
  var hasHeader = /name|姓名|sid|学号|xm|xh/.test(head.join(''));
  var cols = hasHeader ? head : ['姓名', '学号', '备注'];
  var start = hasHeader ? 1 : 0;
  var out = [];
  for (var i = start; i < lines.length; i++) {
    var c = split(lines[i]);
    if (!c.length || c.join('') === '') continue;
    function pick(names) { for (var k = 0; k < cols.length; k++) { if (names.indexOf(cols[k]) >= 0) return c[k] || ''; } return ''; }
    var name = pick(['姓名', 'name', 'xm']);
    var sid = pick(['学号', 'sid', 'xh']);
    var note = pick(['备注', 'note', 'bz']);
    if (note === '1') note = '';
    if (!name && !sid) continue;
    out.push({ name: name, sid: sid, note: note });
  }
  return out;
}
function showImportConfirm(parsed) {
  if (parsed.backup) {
    if (!confirm('这是完整备份文件，导入会覆盖当前全部名单和记录，确定？')) return;
    S = parsed.backup;
    if (!S.theme) S.theme = 'light';
    if (!S.activeId && S.lists.length) S.activeId = S.lists[0].id;
    save(); V.name = 'home'; render(); toast('已恢复 ' + S.lists.length + ' 套名单');
    return;
  }
  var members = parsed.members;
  var L = list();
  var preview = members.slice(0, 5).map(function (m) { return m.name + (m.sid ? '（' + m.sid + '）' : ''); }).join('、');
  var m = mask();
  m.hidden = false;
  m.innerHTML = `<div class="dlg">
    <h3>导入 ${members.length} 人${parsed.name ? ' · ' + esc(parsed.name) : ''}</h3>
    <div class="muted">预览：${esc(preview)}${members.length > 5 ? ' 等' : ''}</div>
    <div class="muted" style="margin-top:6px">当前名单「${esc(L ? L.name : '')}」已有 ${L ? L.members.length : 0} 人。</div>
    <div class="btns three">
      <button class="btn btn-line" data-dlg="cancel">取消</button>
      <button class="btn btn-line" data-dlg="append">追加</button>
      <button class="btn btn-main" data-dlg="replace">覆盖替换</button>
    </div></div>`;
  m.querySelector('[data-dlg="cancel"]').onclick = closeDialog;
  m.querySelector('[data-dlg="append"]').onclick = function () { closeDialog(); mergeMembers(members, false, parsed.name); };
  m.querySelector('[data-dlg="replace"]').onclick = function () { closeDialog(); mergeMembers(members, true, parsed.name); };
}
function mergeMembers(members, replace, name) {
  var L = list();
  if (!L) return;
  if (name && (replace || !L.members.length)) L.name = name;
  if (replace) L.members = [];
  members.forEach(function (mm) {
    L.members.push({ id: uid(), name: mm.name, sid: mm.sid, note: mm.note });
  });
  save();
  V.name = 'members'; V.q = '';
  render();
  toast(replace ? '已覆盖为 ' + members.length + ' 人' : '已追加 ' + members.length + ' 人');
}

/* ---------------- 历史记录 + 累计台账 ---------------- */
function viewHistory() {
  var L = list();
  if (!L) return viewHome();
  var tab = V.histTab || 'list';
  var opts = S.lists.map(function (l) {
    return `<option value="${l.id}" ${l.id === L.id ? 'selected' : ''}>${esc(l.name)}</option>`;
  }).join('');
  var content = tab === 'ledger' ? ledgerHtml() : historyListHtml(L);
  var toggle = tab === 'ledger'
    ? `<div class="row" style="margin-top:10px"><span class="muted">累计台账</span><button class="mini" data-act="histTab" data-v="list">← 返回历史记录</button></div>`
    : `<div class="row" style="margin-top:10px"><span class="muted">历史记录</span><button class="mini" data-act="histTab" data-v="ledger">累计台账</button></div>`;
  return header('历史记录', L.name, backBtn('goHome')) +
    `<div class="wrap">
      <select id="histList" style="width:100%;margin-top:8px;padding:10px 12px;border:1px solid var(--line);border-radius:11px;background:var(--card);color:var(--ink);font-size:15px">${opts}</select>
      ${toggle}
      ${content}
    </div>
    <div class="bottom"><button class="mini" data-act="goHome">返回首页</button>
      <button class="mini" data-act="startRoll">再点一轮</button></div>`;
}
function historyListHtml(L) {
  var bs = L.batches || [];
  var rows = bs.map(function (b) {
    var c = batchStats(b);
    return `<div class="lrow"><div class="main">
      <div class="t1">${esc(b.name)}</div>
      <div class="t2">${stamp(b.createdAt)}　到 ${c.in} · 缺 ${c.out} · 请 ${c.leave}${c.none ? ' · 未记 ' + c.none : ''}</div>
    </div><div class="ops">
      <button class="mini" data-act="openBatch" data-id="${b.id}">查看/改</button>
      <button class="mini danger" data-act="delBatch" data-id="${b.id}">删</button>
    </div></div>`;
  }).join('');
  return rows || '<div class="tip" style="padding-top:14px">还没有点名记录</div>';
}
function ledgerHtml() {
  var L = list();
  var rows = ledgerData();
  function th(col, label) {
    var on = V.ledgerSort === col;
    return `<button class="th ${on ? 'on' : ''}" data-sort="${col}">${label}${on ? (V.ledgerDir < 0 ? ' ↓' : ' ↑') : ''}</button>`;
  }
  var html = rows.map(function (r) {
    var total = r.out + r.leave;
    return `<div class="lrow led"><div class="main">
        <div class="t1">${esc(r.name)}</div>
        <div class="t2">${esc(r.sid)}</div>
      </div>
      <div class="lednums">
        <span class="lo">${r.out}</span>
        <span class="ll">${r.leave}</span>
        <span class="lt ${total ? '' : 'zero'}">${total}</span>
      </div></div>`;
  }).join('');
  return `<div class="ledhead">
        <div style="width:auto;flex:1">姓名 / 学号</div>
        ${th('out', '缺席')}${th('leave', '请假')}
      </div>
      ${html || '<div class="tip" style="padding-top:14px">名单为空</div>'}
      <div class="row" style="gap:8px;margin-top:12px">
        <button class="mini" data-act="copyLedger" style="flex:1">复制台账（表格）</button>
        <button class="mini" data-act="copyLedgerText" style="flex:1">复制台账（文字）</button>
      </div>`;
}
function ledgerData() {
  var L = list();
  var agg = {};
  var order = [];
  if (L) {
    L.members.forEach(function (m) { agg[m.id] = { name: m.name, sid: m.sid, out: 0, leave: 0 }; order.push(m.id); });
    (L.batches || []).forEach(function (b) {
      (b.records || []).forEach(function (x) {
        var key = x.mid || (x.sid ? 'sid:' + x.sid : 'nm:' + x.name);
        if (!agg[key]) { agg[key] = { name: x.name, sid: x.sid, out: 0, leave: 0 }; order.push(key); }
        if (x.st === 'out') agg[key].out++;
        else if (x.st === 'leave') agg[key].leave++;
      });
    });
  }
  var rows = order.map(function (k) { return agg[k]; });
  var col = V.ledgerSort, dir = V.ledgerDir;
  rows.sort(function (a, b) {
    var d = 0;
    if (col === 'name') d = (a.name || '').localeCompare(b.name || '', 'zh');
    else d = (a[col] || 0) - (b[col] || 0);
    if (d === 0) d = (b.out + b.leave) - (a.out + a.leave);
    return d * dir;
  });
  return rows;
}
function ledgerText() {
  var rows = ledgerData();
  var lines = ['姓名\t学号\t缺席\t请假\t合计'];
  rows.forEach(function (r) {
    lines.push([r.name, r.sid, r.out, r.leave, r.out + r.leave].join('\t'));
  });
  return lines.join('\n');
}
function ledgerPlain() {
  var rows = ledgerData();
  var L = list();
  var top = rows.filter(function (r) { return r.out + r.leave > 0; });
  var lines = [];
  lines.push((L ? L.name : '名单') + ' 累计缺勤台账');
  lines.push('（缺席 / 请假 / 合计）');
  top.forEach(function (r, i) {
    lines.push((i + 1) + '. ' + r.name + '　缺席 ' + r.out + ' · 请假 ' + r.leave + ' · 合计 ' + (r.out + r.leave));
  });
  if (!top.length) lines.push('暂无缺勤记录');
  return lines.join('\n');
}

/* ---------------- 单轮详情（可改） ---------------- */
function viewBatch() {
  var b = batchById(V.batchId);
  if (!b) { V.name = 'history'; return viewHistory(); }
  var rows = b.records.map(function (x, i) {
    return `<div class="srow" data-st="${x.st}">
      <div><div class="nm">${esc(x.name)}</div><div class="meta">${esc(x.sid)}${x.note ? ' · ' + esc(x.note) : ''}</div></div>
      <div class="seg3">
        <button data-act="setStatus" data-i="${i}" data-v="in" class="${x.st === 'in' ? 'on' : ''}">到</button>
        <button data-act="setStatus" data-i="${i}" data-v="out" class="${x.st === 'out' ? 'on' : ''}">缺</button>
        <button data-act="setStatus" data-i="${i}" data-v="leave" class="${x.st === 'leave' ? 'on' : ''}">假</button>
      </div></div>`;
  }).join('');
  var c = batchStats(b);
  return header(b.name, stamp(b.createdAt) + '　到 ' + c.in + ' · 缺 ' + c.out + ' · 请 ' + c.leave,
    backBtn('goHistory')) +
    `<div class="wrap">
      <div class="row" style="gap:8px;margin-top:6px">
        <button class="mini" data-act="renameBatch" style="flex:1">改名</button>
        <button class="mini" data-act="copyBatch" style="flex:1">复制表格</button>
        <button class="mini" data-act="genImage" data-v="download" style="flex:1">生成图片</button>
        <button class="mini danger" data-act="delThisBatch" style="flex:1">删除本轮</button>
      </div>
      <div style="margin-top:12px">${rows}</div>
      <div style="height:14px"></div>
    </div>`;
}

/* ---------------- 调整结果（拖拽改 + 逐条改） ---------------- */
function viewEdit() {
  var b = batchById(V.batchId);
  if (!b) { V.name = 'summary'; return viewSummary(); }
  var tab = V.editTab || 'drag';
  var listHtml = b.records.map(function (x, i) {
    return `<div class="srow" data-st="${x.st}">
      <div><div class="nm">${esc(x.name)}</div><div class="meta">${esc(x.sid)}${x.note ? ' · ' + esc(x.note) : ''}</div></div>
      <div class="seg3">
        <button data-act="setStatus" data-i="${i}" data-v="in" class="${x.st === 'in' ? 'on' : ''}">到</button>
        <button data-act="setStatus" data-i="${i}" data-v="out" class="${x.st === 'out' ? 'on' : ''}">缺</button>
        <button data-act="setStatus" data-i="${i}" data-v="leave" class="${x.st === 'leave' ? 'on' : ''}">假</button>
      </div></div>`;
  }).join('');
  return header('调整结果', b.name, backBtn('backToSummary')) +
    `<div class="wrap">
      ${editDrag(b)}
      <div class="tip" style="padding:12px 0 0">按住名字拖到目标区域即可改状态。</div>
    </div>
    <div class="bottom"><button class="mini" data-act="backToSummary">返回结算</button>
      <button class="mini" data-act="copyBatch">复制表格</button></div>`;
}
function editDrag(b) {
  var zones = [
    { k: 'in', label: '到了', cls: 'in' },
    { k: 'out', label: '缺席', cls: 'out' },
    { k: 'leave', label: '请假', cls: 'leave' },
    { k: '', label: '未记录', cls: 'none' }
  ];
  return zones.map(function (z) {
    var list = b.records.filter(function (x) { return x.st === z.k; });
    var chips = list.map(function (x) {
      return `<div class="dchip" data-mid="${esc(x.mid)}"><span class="dcn">${esc(x.name)}</span></div>`;
    }).join('');
    return `<div class="dropzone z-${z.cls}" data-zone="${z.k}">
      <div class="dz-head"><span class="dz-n">${z.label}</span><span class="dz-c">${list.length}</span></div>
      <div class="dz-body">${chips || '<div class="dz-empty">拖到这里</div>'}</div>
    </div>`;
  }).join('');
}
function bindEditDrag() {
  var chips = document.querySelectorAll('.dchip');
  if (!chips.length) return;
  var ghost = null;
  function zoneAt(x, y) {
    var el = document.elementFromPoint(x, y);
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.classList && el.classList.contains('dropzone')) return el.getAttribute('data-zone');
      el = el.parentElement;
    }
    return null;
  }
  function clearOver() {
    document.querySelectorAll('.dropzone.over').forEach(function (z) { z.classList.remove('over'); });
  }
  chips.forEach(function (chip) {
    chip.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      var mid = chip.getAttribute('data-mid');
      ghost = chip.cloneNode(true);
      ghost.classList.add('dragging');
      ghost.style.width = chip.offsetWidth + 'px';
      document.body.appendChild(ghost);
      function moveGhost(x, y) { ghost.style.left = (x - ghost.offsetWidth / 2) + 'px'; ghost.style.top = (y - 20) + 'px'; }
      moveGhost(e.clientX, e.clientY);
      function onMove(ev) {
        moveGhost(ev.clientX, ev.clientY);
        clearOver();
        var z = zoneAt(ev.clientX, ev.clientY);
        if (z !== null) {
          var zel = document.querySelector('.dropzone[data-zone="' + z + '"]');
          if (zel) zel.classList.add('over');
        }
      }
      function onUp(ev) {
        cleanup();
        var target = zoneAt(ev.clientX, ev.clientY);
        applyDrop(mid, target);
      }
      function onCancel() {
        cleanup();
      }
      function cleanup() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onCancel);
        if (ghost) { ghost.remove(); ghost = null; }
        clearOver();
      }
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onCancel);
    });
  });
}
function applyDrop(mid, target) {
  var b = batchById(V.batchId);
  if (!b) { render(); return; }
  var rec = null;
  for (var i = 0; i < b.records.length; i++) { if (b.records[i].mid === mid) { rec = b.records[i]; break; } }
  if (!rec) { render(); return; }
  var newSt = (target === null || target === undefined) ? rec.st : target;
  if (newSt !== rec.st) {
    rec.st = newSt;
    save();
    toast('已改为 ' + stLabel(newSt));
  }
  render();
}

/* ---------------- 设置 ---------------- */
function viewSettings() {
  return header('设置', '', backBtn('goHome')) +
    `<div class="wrap">
      <div class="setting-row"><div class="lb">页面风格</div>
        <div class="themes">
          <button data-act="setTheme" data-v="light" class="${S.theme !== 'dark' ? 'on' : ''}">纯白简约</button>
          <button data-act="setTheme" data-v="dark" class="${S.theme === 'dark' ? 'on' : ''}">深色护眼</button>
        </div></div>
      <div class="setting-row"><div class="lb">点名顺序<small>随机打乱每次都不一样</small></div>
        <div class="themes">
          <button data-act="setOrder" data-v="fixed" class="${S.random ? '' : 'on'}">名册顺序</button>
          <button data-act="setOrder" data-v="random" class="${S.random ? 'on' : ''}">随机</button>
        </div></div>
      <div class="setting-row" style="flex-direction:column;align-items:stretch;gap:8px">
        <div class="lb">玻璃透明度<small>拖动即时预览 · 越实文字越清晰，越透越空灵</small></div>
        <input type="range" id="glassRange" aria-label="玻璃透明度" min="35" max="80" value="${Math.round(S.glass * 100)}" style="width:100%">
      </div>
      <div class="setting-row"><div class="lb">提示音效<small>到 / 缺席 / 请假的短提示音</small></div>
        <div class="themes">
          <button data-act="setSound" data-v="1" class="${S.sound ? 'on' : ''}">开</button>
          <button data-act="setSound" data-v="0" class="${S.sound ? '' : 'on'}">关</button>
        </div></div>
      <div class="setting-row" style="flex-direction:column;align-items:stretch;gap:8px">
        <div class="lb">音效风格<small>自带合成音；也可放入 sounds/in.mp3 · out.mp3 · out-alt.mp3 · leave.mp3 用自定义音效</small></div>
        <div class="themes" style="flex-wrap:wrap">
          <button data-act="setSoundTheme" data-v="clear" class="${(S.soundTheme || 'clear') === 'clear' ? 'on' : ''}">清脆</button>
          <button data-act="setSoundTheme" data-v="wood" class="${S.soundTheme === 'wood' ? 'on' : ''}">木质</button>
          <button data-act="setSoundTheme" data-v="soft" class="${S.soundTheme === 'soft' ? 'on' : ''}">安静</button>
          <button data-act="setSoundTheme" data-v="retro" class="${S.soundTheme === 'retro' ? 'on' : ''}">复古</button>
        </div></div>
      <div class="setting-row"><div class="lb">缺席音<small>自定义 mp3 生效时可选</small></div>
        <div class="themes">
          <button data-act="setOutAlt" data-v="0" class="${S.outAlt ? '' : 'on'}">暖冬回城</button>
          <button data-act="setOutAlt" data-v="1" class="${S.outAlt ? 'on' : ''}">siuuuuu</button>
        </div></div>
      <div class="setting-row"><div class="lb">试听<small>依次播到 / 缺席 / 请假</small></div>
        <button class="mini" data-act="testSound">试听</button></div>
      <div class="setting-row"><div class="lb">数据备份<small>导出成文件存到手机上，换机可导入</small></div>
        <button class="mini" data-act="backup">导出</button></div>
      <div class="setting-row"><div class="lb">从备份恢复</div>
        <button class="mini" data-act="restore">导入</button></div>
      <div class="setting-row"><div class="lb">清空全部数据<small>名单和所有记录都会删除，不可恢复</small></div>
        <button class="mini danger" data-act="wipe">清空</button></div>
      <div class="tip" style="padding:14px 0 0">所有名单和点名记录只存在这台设备的浏览器里，不经过任何服务器。需要我帮你汇总时，用「复制表格」发给我就行。</div>
    </div>
    <div class="bottom"><button class="mini" data-act="goHome">返回首页</button>
      <button class="mini" data-act="goLists">名单管理</button></div>`;
}

/* ---------------- 弹窗：本轮命名 + 预设请假 ---------------- */
function mask() { return document.getElementById('mask'); }
function closeDialog() {
  var m = mask(); if (m) { m.hidden = true; m.innerHTML = ''; }
}
function showBatchDialog(L) {
  var m = mask();
  var def = L.name + '第' + ((L.batches ? L.batches.length : 0) + 1) + '次' + today();
  var members = L.members.map(function (mm) {
    return `<label class="pl-item">
      <span class="pl-n">${esc(mm.name)}</span>
      <span class="pl-s">${esc(mm.sid)}</span>
      <input type="checkbox" data-mid="${mm.id}">
    </label>`;
  }).join('');
  m.hidden = false;
  m.innerHTML = `<div class="dlg">
    <h3>本轮命名</h3>
    <input id="dlgName" value="${esc(def)}" placeholder="例如：团日第3次2026-11-11">
    <div class="preleave">
      <div class="pl-head"><span>预设请假（可选）</span><span id="plCount" class="plc">未选</span></div>
      <input id="plSearch" placeholder="搜姓名/学号，勾选的人自动记请假并跳过">
      <div class="pl-list">${members || '<div class="muted" style="padding:8px 0">名单为空</div>'}</div>
    </div>
    <div class="btns">
      <button class="btn btn-line" data-dlg="cancel">取消</button>
      <button class="btn btn-main" data-dlg="ok">开始点名</button>
    </div></div>`;
  var inp = document.getElementById('dlgName');
  setTimeout(function () { inp.focus(); inp.select(); }, 60);
  m.querySelector('[data-dlg="cancel"]').onclick = closeDialog;
  m.querySelector('[data-dlg="ok"]').onclick = function () {
    var v = (inp.value || '').trim() || def;
    var pre = {};
    m.querySelectorAll('input[type="checkbox"]:checked').forEach(function (cb) { pre[cb.getAttribute('data-mid')] = true; });
    closeDialog();
    beginRoll(L, v, pre);
  };
  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') m.querySelector('[data-dlg="ok"]').click();
  });
  var plSearch = document.getElementById('plSearch');
  var plCount = document.getElementById('plCount');
  function syncCount() {
    var n = m.querySelectorAll('input[type="checkbox"]:checked').length;
    plCount.textContent = n ? '已选 ' + n + ' 人' : '未选';
  }
  m.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
    cb.onchange = syncCount;
  });
  plSearch.oninput = function () {
    var q = plSearch.value.trim();
    m.querySelectorAll('.pl-item').forEach(function (row) {
      var nm = row.querySelector('.pl-n').textContent;
      var sid = row.querySelector('.pl-s').textContent;
      row.style.display = (!q || nm.indexOf(q) >= 0 || sid.indexOf(q) >= 0) ? '' : 'none';
    });
  };
}
function showExportDialog() {
  var m = mask();
  m.hidden = false;
  m.innerHTML = `<div class="dlg">
    <h3>导出 / 分享</h3>
    <div class="swapwrap">
      <button class="swapitem" data-ex="copyList"><span class="si-n">复制清单</span><span class="si-m">文字版</span></button>
      <button class="swapitem" data-ex="copyTable"><span class="si-n">复制表格</span><span class="si-m">可粘成 Excel</span></button>
      <button class="swapitem" data-ex="genImage" data-v="download"><span class="si-n">生成图片</span><span class="si-m">保存到相册</span></button>
      <button class="swapitem" data-ex="genImage" data-v="share"><span class="si-n">分享图片</span><span class="si-m">发给班委</span></button>
    </div>
    <div class="btns"><button class="btn btn-line" data-dlg="cancel">取消</button></div></div>`;
  m.querySelector('[data-dlg="cancel"]').onclick = closeDialog;
  m.querySelectorAll('[data-ex]').forEach(function (b) {
    b.onclick = function () {
      var ex = b.getAttribute('data-ex');
      closeDialog();
      if (ex === 'genImage') { genImage(b.getAttribute('data-v') || 'download'); return; }
      var bb = batchById(V.batchId);
      if (!bb) return;
      if (ex === 'copyList') copyText(summaryText(bb), '清单已复制');
      else copyText(tableText(bb), '表格已复制，可粘贴发给班委');
    };
  });
}
function showPrompt(title, value, cb) {
  var m = mask();
  m.hidden = false;
  m.innerHTML = `<div class="dlg">
    <h3>${esc(title)}</h3>
    <input id="dlgVal" value="${esc(value)}">
    <div class="btns">
      <button class="btn btn-line" data-dlg="cancel">取消</button>
      <button class="btn btn-main" data-dlg="ok">确定</button>
    </div></div>`;
  var inp = document.getElementById('dlgVal');
  setTimeout(function () { inp.focus(); inp.select(); }, 60);
  m.querySelector('[data-dlg="cancel"]').onclick = closeDialog;
  m.querySelector('[data-dlg="ok"]').onclick = function () {
    var v = (inp.value || '').trim();
    closeDialog();
    if (v) cb(v);
  };
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') m.querySelector('[data-dlg="ok"]').click(); });
}

function createList(name) {
  var n = 1;
  var nm = (name || '').trim();
  if (!nm) {
    while (S.lists.some(function (x) { return x.name === '名单' + n; })) n++;
    nm = '名单' + n;
  }
  var nl = { id: uid(), name: nm, members: [], batches: [] };
  S.lists.push(nl); S.activeId = nl.id; save();
  return nl;
}

function beginRoll(L, name, pre) {
  pre = pre || {};
  var ids = L.members.map(function (m) { return m.id; });
  if (!ids.length) { toast('名单为空，先添加人员'); return; }
  if (S.random) {
    for (var i = ids.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = ids[i]; ids[i] = ids[j]; ids[j] = t;
    }
  }
  var walk = ids.filter(function (id) { return !pre[id]; });
  var res = {};
  for (var k in pre) { if (pre[k]) res[k] = 'leave'; }
  S.roll = { listId: L.id, batchId: uid(), batchName: name, order: walk, all: ids, idx: 0, res: res, preLeave: pre };
  save();
  V.name = 'roll';
  render();
}

/* ---------------- 事件绑定 ---------------- */
function bind() {
  var apps = document.getElementById('app');
  apps.querySelectorAll('[data-act]').forEach(function (el) {
    el.onclick = function () { act(el.getAttribute('data-act'), el); };
  });
  apps.querySelectorAll('[data-mark]').forEach(function (el) {
    el.onclick = function () { mark(el.getAttribute('data-mark')); };
  });
  if (V.name === 'roll') { bindRoll(); bindRollSearch(); }
  if (V.name === 'members') {
    var s = document.getElementById('search');
    if (s) {
      s.oninput = function () {
        V.q = s.value.trim();
        var q = V.q;
        apps.querySelectorAll('.mrow').forEach(function (row) {
          var nm = row.querySelector('.nm-i').value, sid = row.querySelector('.sid-i').value;
          row.style.display = (!q || nm.indexOf(q) >= 0 || sid.indexOf(q) >= 0) ? '' : 'none';
        });
      };
    }
    apps.querySelectorAll('input[data-mi]').forEach(function (inp) {
      inp.onchange = function () {
        var L = list(); if (!L) return;
        var i = Number(inp.getAttribute('data-mi'));
        var f = inp.getAttribute('data-f');
        if (!L.members[i]) return;
        L.members[i][f] = inp.value.trim();
        save();
      };
    });
    if (V.selMode) {
      apps.querySelectorAll('.mcheck input').forEach(function (cb) {
        cb.onchange = function () {
          var mid = cb.getAttribute('data-mid');
          if (cb.checked) V.selIds[mid] = true; else delete V.selIds[mid];
          var c = document.getElementById('selCount');
          if (c) c.textContent = Object.keys(V.selIds).length;
        };
      });
    }
  }
  if (V.name === 'settings') {
    var gr = document.getElementById('glassRange');
    if (gr) gr.oninput = function () { S.glass = Number(gr.value) / 100; applyGlass(); save(); };
  }
  if (V.name === 'history') {
    var sel = document.getElementById('histList');
    if (sel) sel.onchange = function () { S.activeId = sel.value; save(); render(); };
    if ((V.histTab || 'list') === 'ledger') {
      apps.querySelectorAll('[data-sort]').forEach(function (el) {
        el.onclick = function () {
          var col = el.getAttribute('data-sort');
          if (V.ledgerSort === col) V.ledgerDir = -V.ledgerDir;
          else { V.ledgerSort = col; V.ledgerDir = col === 'name' ? 1 : -1; }
          render();
        };
      });
    }
  }
  if (V.name === 'edit' && (V.editTab || 'drag') === 'drag') bindEditDrag();
  if (V.name === 'summary') {
    countUp();
    if (V.party && V.party === V.batchId) { V.party = null; confetti(90); }
  }
}

function act(a, el) {
  var L = list();
  var id = el ? el.getAttribute('data-id') : null;
  switch (a) {
    case 'goHome': V.name = 'home'; V.q = ''; V.rollQ = ''; render(); break;
    case 'goLists': V.name = 'lists'; render(); break;
    case 'goSettings': V.name = 'settings'; render(); break;
    case 'goHistory': V.name = 'history'; V.histTab = 'list'; render(); break;
    case 'goMembers': { if (L) { V.name = 'members'; V.q = ''; render(); } break; }

    case 'newList': {
      var nl = createList(); V.name = 'members'; V.q = ''; render();
      toast('已建名单「' + nl.name + '」，先添加人员');
      break;
    }
    case 'swapList': { showSwapDialog(); break; }
    case 'switchList': { S.activeId = id; save(); render(); toast('已切换到该名单'); break; }
    case 'renameList': {
      var rl = S.lists.filter(function (x) { return x.id === id; })[0];
      if (!rl) break;
      showPrompt('修改名单名称', rl.name, function (v) {
        rl.name = v; save(); render(); toast('已改名');
      });
      break;
    }
    case 'editMembers': { S.activeId = id; save(); V.name = 'members'; V.q = ''; render(); break; }
    case 'delList': {
      var l = S.lists.filter(function (x) { return x.id === id; })[0];
      if (!l) break;
      if (!confirm('删除「' + l.name + '」？该名单下 ' + (l.batches ? l.batches.length : 0) + ' 轮记录会一起删除，不可恢复。')) break;
      S.lists = S.lists.filter(function (x) { return x.id !== id; });
      if (S.activeId === id) S.activeId = S.lists.length ? S.lists[0].id : null;
      if (S.roll && S.roll.listId === id) S.roll = null;
      save(); render();
      break;
    }

    case 'startRoll': { if (L) showBatchDialog(L); break; }
    case 'resumeRoll': { V.name = 'roll'; render(); break; }
    case 'dropRoll': {
      if (!confirm('放弃本轮？已点的记录会丢掉。')) break;
      S.roll = null; save(); render(); toast('已放弃本轮');
      break;
    }
    case 'exitRoll': { V.name = 'home'; render(); toast('本轮已保存，可随时继续'); break; }
    case 'undoMark': { undoMark(); break; }
    case 'homeFromSummary': { V.name = 'home'; render(); break; }
    case 'openLast': { V.name = 'summary'; V.batchId = id; render(); break; }
    case 'backToSummary': { V.name = 'summary'; render(); break; }
    case 'goEdit': { V.name = 'edit'; V.editTab = 'drag'; render(); break; }
    case 'editTab': { V.editTab = el.getAttribute('data-v'); render(); break; }
    case 'histTab': { V.histTab = el.getAttribute('data-v'); render(); break; }

    case 'copyList': { var bb = batchById(V.batchId); if (bb) copyText(summaryText(bb), '清单已复制'); break; }
    case 'copyTable': { var b2 = batchById(V.batchId); if (b2) copyText(tableText(b2), '表格已复制，可粘贴发给班委'); break; }
    case 'copyBatch': { var b3 = batchById(V.batchId); if (b3) copyText(tableText(b3), '表格已复制'); break; }
    case 'copyLedger': { copyText(ledgerText(), '台账表格已复制'); break; }
    case 'copyLedgerText': { copyText(ledgerPlain(), '台账文字已复制'); break; }
    case 'genImage': { genImage(el.getAttribute('data-v') || 'download'); break; }
    case 'showExport': { showExportDialog(); break; }

    case 'openBatch': { V.name = 'batch'; V.batchId = id; render(); break; }
    case 'renameBatch': {
      var rb = batchById(V.batchId);
      if (!rb) break;
      showPrompt('修改本轮名称', rb.name, function (v) { rb.name = v; save(); render(); toast('已改名'); });
      break;
    }
    case 'delBatch': {
      if (!L) break;
      if (!confirm('删除这一轮记录？不可恢复。')) break;
      L.batches = L.batches.filter(function (x) { return x.id !== id; });
      save(); render();
      break;
    }
    case 'delThisBatch': {
      if (!L) break;
      if (!confirm('删除这一轮记录？不可恢复。')) break;
      L.batches = L.batches.filter(function (x) { return x.id !== V.batchId; });
      save(); V.name = 'history'; render();
      break;
    }
    case 'setStatus': {
      var b4 = batchById(V.batchId);
      if (!b4) break;
      var i2 = Number(el.getAttribute('data-i'));
      b4.records[i2].st = el.getAttribute('data-v');
      save(); render();
      break;
    }

    case 'addMember': {
      if (!L) break;
      var nm = document.getElementById('addName').value.trim();
      if (!nm) { toast('姓名不能为空'); break; }
      L.members.push({
        id: uid(), name: nm,
        sid: document.getElementById('addSid').value.trim(),
        note: document.getElementById('addNote').value.trim()
      });
      save(); render(); toast('已添加 ' + nm);
      break;
    }
    case 'delMember': {
      if (!L) break;
      var i3 = Number(el.getAttribute('data-i'));
      var mm = L.members[i3];
      if (!mm) break;
      if (!confirm('从名单里删除「' + mm.name + '」？')) break;
      L.members.splice(i3, 1);
      if (S.roll && S.roll.listId === L.id) {
        S.roll.order = S.roll.order.filter(function (id) { return id !== mm.id; });
        if (S.roll.all) S.roll.all = S.roll.all.filter(function (id) { return id !== mm.id; });
        delete S.roll.res[mm.id];
        if (S.roll.order.length && S.roll.idx >= S.roll.order.length) S.roll.idx = S.roll.order.length - 1;
      }
      save(); render();
      break;
    }
    case 'selStart': { V.selMode = true; V.selIds = {}; render(); break; }
    case 'selCancel': { V.selMode = false; V.selIds = {}; render(); break; }
    case 'selAll': {
      if (L) { L.members.forEach(function (m) { V.selIds[m.id] = true; }); }
      render();
      break;
    }
    case 'selNone': { V.selIds = {}; render(); break; }
    case 'delSel': {
      if (!L) break;
      var ids = V.selIds || {};
      var arr = Object.keys(ids);
      if (!arr.length) { toast('没有勾选任何人'); break; }
      if (!confirm('删除选中的 ' + arr.length + ' 人？不可恢复。')) break;
      L.members = L.members.filter(function (m) { return !ids[m.id]; });
      if (S.roll && S.roll.listId === L.id) {
        S.roll.order = S.roll.order.filter(function (id) { return !ids[id]; });
        if (S.roll.all) S.roll.all = S.roll.all.filter(function (id) { return !ids[id]; });
        for (var dk = 0; dk < arr.length; dk++) delete S.roll.res[arr[dk]];
        if (S.roll.order.length && S.roll.idx >= S.roll.order.length) S.roll.idx = S.roll.order.length - 1;
      }
      save();
      V.selMode = false; V.selIds = {};
      render(); toast('已删除 ' + arr.length + ' 人');
      break;
    }
    case 'importMembers': { pickRosterFile(); break; }
    case 'importPaste': { showPasteDialog(); break; }
    case 'importHome': {
      createList(); V.name = 'members'; V.q = ''; render();
      setTimeout(pickRosterFile, 60);
      break;
    }

    case 'setTheme': { S.theme = el.getAttribute('data-v'); save(); render(); break; }
    case 'setOrder': { S.random = el.getAttribute('data-v') === 'random'; save(); render(); break; }
    case 'setSound': { S.sound = el.getAttribute('data-v') === '1'; save(); render(); break; }
    case 'setSoundTheme': { S.soundTheme = el.getAttribute('data-v'); save(); render(); synth('in'); break; }
    case 'setOutAlt': { S.outAlt = el.getAttribute('data-v') === '1'; save(); render(); beepKey(S.outAlt ? 'out-alt' : 'out'); break; }
    case 'testSound': {
      beepKey('in0');
      setTimeout(function () { beepKey(S.outAlt ? 'out-alt' : 'out'); }, 700);
      setTimeout(function () { beepKey('leave'); }, 1500);
      break;
    }

    case 'backup': {
      var fname = '点名备份_' + today() + '.json';
      var txt = JSON.stringify(S);
      var blob = new Blob([txt], { type: 'application/json' });
      var a2 = document.createElement('a');
      a2.href = URL.createObjectURL(blob); a2.download = fname;
      document.body.appendChild(a2); a2.click(); document.body.removeChild(a2);
      setTimeout(function () { URL.revokeObjectURL(a2.href); }, 2000);
      toast('备份已保存到下载目录');
      break;
    }
    case 'restore': {
      var fi = document.createElement('input');
      fi.type = 'file'; fi.accept = 'application/json,.json';
      fi.onchange = function () {
        var f = fi.files && fi.files[0];
        if (!f) return;
        var fr = new FileReader();
        fr.onload = function () {
          var d = null;
          try { d = JSON.parse(String(fr.result)); } catch (e) {}
          if (!d || !Array.isArray(d.lists)) { toast('这不是本工具的备份文件'); return; }
          if (!confirm('用备份覆盖当前数据？')) return;
          S = d;
          if (!S.theme) S.theme = 'light';
          if (!S.soundTheme) S.soundTheme = 'clear';
          if (!S.activeId && S.lists.length) S.activeId = S.lists[0].id;
          save(); render(); toast('已恢复 ' + S.lists.length + ' 套名单');
        };
        fr.readAsText(f);
      };
      fi.click();
      break;
    }
    case 'wipe': {
      if (!confirm('清空全部名单和记录？不可恢复。')) break;
      if (!confirm('再确认一次：清空后无法找回，确定吗？')) break;
      S = { theme: S.theme, random: false, lists: [], activeId: null, roll: null, glass: 0.55, sound: true, soundTheme: 'clear', outAlt: false };
      save(); V.name = 'home'; render(); toast('已清空');
      break;
    }
  }
}

/* 遮罩关闭 */
(function () {
  var m = mask();
  if (m) m.addEventListener('click', function (e) { if (e.target === m) closeDialog(); });
  document.addEventListener('click', function (e) {
    var h = document.getElementById('rollhits');
    if (h && !(e.target && e.target.closest && e.target.closest('.rollq'))) h.hidden = true;
  });
})();

render();
