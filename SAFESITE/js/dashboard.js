// ============================================================
// js/dashboard.js — Dashboard Logic + PPE Detection
// ============================================================

// ---- State ----
let stream            = null;
let detectionInterval = null;
let cameraActive      = false;

const ppeSettings = {
  hardhat: true,
  vest:    true,
  goggles: false,
  gloves:  false,
  boots:   false,
  mask:    false,
};

const stats = {
  total: 0, compliant: 0, violations: 0,
  hardhat: 0, vest: 0, noHardhat: 0, noVest: 0,
};

const detectionLog = [];

// ---- Called by firebase-init after auth confirmed ----
window.initDashboard = function(user) {
  document.getElementById('userEmailDisplay').textContent = user.email;
  document.getElementById('userAvatar').textContent = user.email[0].toUpperCase();
  loadCameras();
};

// ---- Clock ----
function tick() {
  const now = new Date();
  document.getElementById('clockDisplay').textContent =
    now.toLocaleTimeString('en-PH', { hour12: false });
  document.getElementById('dateDisplay').textContent =
    now.toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}
setInterval(tick, 1000);
tick();

// ============================================================
// CAMERA
// ============================================================
async function loadCameras() {
  try {
    const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
    tmp.getTracks().forEach(t => t.stop());

    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(d => d.kind === 'videoinput');

    const sel = document.getElementById('cameraSelect');
    sel.innerHTML = '<option value="">— Select Camera —</option>';
    cameras.forEach((cam, i) => {
      const opt = document.createElement('option');
      opt.value = cam.deviceId;
      opt.textContent = cam.label || `Camera ${i + 1}`;
      sel.appendChild(opt);
    });

    if (cameras.length === 1) sel.value = cameras[0].deviceId;
    addLog('info', `Found ${cameras.length} camera(s) available`);
    showToast(`${cameras.length} camera(s) found`, 'ok');
  } catch (err) {
    addLog('fail', 'Camera permission denied — please allow camera access');
    showToast('Camera permission needed', 'err');
  }
}

window.startCamera = async function() {
  const deviceId = document.getElementById('cameraSelect').value;
  if (!deviceId) { showToast('Please select a camera first', 'warn'); return; }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });

    const video = document.getElementById('videoEl');
    video.srcObject = stream;
    await video.play();

    cameraActive = true;

    document.getElementById('videoPlaceholder').style.display = 'none';
    document.getElementById('recBadge').style.display = 'block';
    document.getElementById('camStatusBadge').textContent = '● LIVE';
    document.getElementById('camStatusBadge').className = 'cam-status active';
    document.getElementById('liveStatus').textContent = 'MONITORING';
    document.querySelector('.live-dot').classList.add('active');
    document.getElementById('videoWrap').classList.add('scanning');
    document.getElementById('btnStart').style.display = 'none';
    document.getElementById('btnStop').style.display = 'block';

    startDetection();
    addLog('info', 'Camera started — PPE detection active');
    showToast('Camera live! Detection running.', 'ok');
  } catch (err) {
    showToast('Camera error: ' + err.message, 'err');
    addLog('fail', 'Camera failed: ' + err.message);
  }
};

window.stopCamera = function() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (detectionInterval) { clearInterval(detectionInterval); detectionInterval = null; }

  cameraActive = false;

  const video = document.getElementById('videoEl');
  video.srcObject = null;

  const canvas = document.getElementById('detectionCanvas');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

  document.getElementById('videoPlaceholder').style.display = 'flex';
  document.getElementById('recBadge').style.display = 'none';
  document.getElementById('camStatusBadge').textContent = '● OFFLINE';
  document.getElementById('camStatusBadge').className = 'cam-status inactive';
  document.getElementById('liveStatus').textContent = 'OFFLINE';
  document.querySelector('.live-dot').classList.remove('active');
  document.getElementById('videoWrap').classList.remove('scanning');
  document.getElementById('btnStart').style.display = 'block';
  document.getElementById('btnStop').style.display = 'none';
  document.getElementById('detChips').innerHTML = '';

  addLog('info', 'Camera stopped');
};

// ============================================================
// PPE DETECTION
//
// 🔧 TO INTEGRATE YOUR OWN ML MODEL:
// Replace the simulateDetection() function below.
// Your model should return an array of detection objects:
// [
//   {
//     x: 120,          // bounding box left (pixels on canvas)
//     y: 45,           // bounding box top
//     w: 80,           // width
//     h: 180,          // height
//     hasHardhat: true,
//     hasVest: true,
//     confidence: 0.93
//   },
//   ...
// ]
// Then call: drawDetections(canvas, yourResults);
// ============================================================

function simulateDetection(canvas) {
  // Simulated detections — replace with real ML model inference
  const count = Math.floor(Math.random() * 3) + 1;
  const results = [];
  for (let i = 0; i < count; i++) {
    const w = canvas.width  * (0.10 + Math.random() * 0.12);
    const h = w * 2.4;
    const x = 20 + Math.random() * (canvas.width  - w - 40);
    const y = 10 + Math.random() * (canvas.height - h - 20);
    results.push({
      x, y, w, h,
      hasHardhat:  ppeSettings.hardhat  ? Math.random() > 0.28 : true,
      hasVest:     ppeSettings.vest     ? Math.random() > 0.22 : true,
      confidence:  0.72 + Math.random() * 0.25,
    });
  }
  return results;
}

function drawDetections(canvas, detections) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  detections.forEach(d => {
    const compliant = d.hasHardhat && d.hasVest;
    const color = compliant ? '#10b981' : '#ef4444';
    const glow  = compliant ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)';

    // Main bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;
    ctx.strokeRect(d.x, d.y, d.w, d.h);
    ctx.shadowBlur = 0;

    // Corner brackets
    const cs = 16;
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    const corners = [
      [d.x,       d.y,        1,  1],
      [d.x + d.w, d.y,       -1,  1],
      [d.x,       d.y + d.h,  1, -1],
      [d.x + d.w, d.y + d.h, -1, -1],
    ];
    corners.forEach(([cx, cy, sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy + sy * cs);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + sx * cs, cy);
      ctx.stroke();
    });

    // Label bar
    const pct   = Math.round(d.confidence * 100);
    const label = `${compliant ? '✓ COMPLIANT' : '✗ VIOLATION'} ${pct}%`;
    ctx.font = 'bold 11px "Share Tech Mono", monospace';
    const tw = ctx.measureText(label).width + 16;
    ctx.fillStyle = color + 'cc';
    ctx.fillRect(d.x, d.y - 22, tw, 21);
    ctx.fillStyle = compliant ? '#003322' : '#330011';
    ctx.fillText(label, d.x + 8, d.y - 6);

    // PPE icon annotations
    const icons = [];
    if (d.hasHardhat)                          icons.push('🪖');
    if (d.hasVest)                             icons.push('🦺');
    if (!d.hasHardhat && ppeSettings.hardhat)  icons.push('⛔H');
    if (!d.hasVest    && ppeSettings.vest)     icons.push('⛔V');

    ctx.font = '13px serif';
    icons.forEach((ic, idx) => {
      ctx.fillText(ic, d.x + d.w + 5, d.y + 18 + idx * 18);
    });
  });
}

function startDetection() {
  const video  = document.getElementById('videoEl');
  const canvas = document.getElementById('detectionCanvas');

  detectionInterval = setInterval(() => {
    if (!cameraActive) return;

    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 360;

    // ---- Replace simulateDetection() with your model here ----
    const detections = simulateDetection(canvas);
    // ----------------------------------------------------------

    drawDetections(canvas, detections);
    updateStats(detections);
    updateChips(detections);
    logDetections(detections);
    saveToFirebase(detections);
  }, 2000);
}

function updateStats(detections) {
  detections.forEach(d => {
    stats.total++;
    const ok = d.hasHardhat && d.hasVest;
    if (ok) stats.compliant++;
    else    stats.violations++;
    if (d.hasHardhat)                         stats.hardhat++;
    if (d.hasVest)                            stats.vest++;
    if (!d.hasHardhat && ppeSettings.hardhat) stats.noHardhat++;
    if (!d.hasVest    && ppeSettings.vest)    stats.noVest++;
  });

  document.getElementById('statTotal').textContent     = stats.total;
  document.getElementById('statCompliant').textContent = stats.compliant;
  document.getElementById('statViolations').textContent = stats.violations;
  document.getElementById('bkHardhat').textContent     = stats.hardhat;
  document.getElementById('bkVest').textContent        = stats.vest;
  document.getElementById('bkNoHardhat').textContent   = stats.noHardhat;
  document.getElementById('bkNoVest').textContent      = stats.noVest;

  const rate = stats.total > 0 ? Math.round((stats.compliant / stats.total) * 100) : 0;
  document.getElementById('rateLabel').textContent     = rate + '%';
  document.getElementById('rateBar').style.width       = rate + '%';
}

function updateChips(detections) {
  const violators = detections.filter(d => !d.hasHardhat || !d.hasVest);
  const chips = document.getElementById('detChips');
  chips.innerHTML = `
    <div class="chip blue">👁 ${detections.length} PERSON${detections.length !== 1 ? 'S' : ''}</div>
    <div class="chip green">✓ ${detections.length - violators.length} COMPLIANT</div>
    ${violators.length > 0 ? `<div class="chip red">⚠ ${violators.length} VIOLATION${violators.length !== 1 ? 'S' : ''}</div>` : ''}
  `;
}

function logDetections(detections) {
  const violators = detections.filter(d => !d.hasHardhat || !d.hasVest);
  if (violators.length > 0) {
    const missing = [];
    if (violators.some(v => !v.hasHardhat)) missing.push('Hard Hat');
    if (violators.some(v => !v.hasVest))    missing.push('Safety Vest');
    addLog('fail', `⚠ ${violators.length} worker(s) missing: ${missing.join(', ')}`);
  } else {
    addLog('pass', `✓ ${detections.length} worker(s) — All PPE compliant`);
  }
}

// ============================================================
// FIREBASE SAVE
// ============================================================
async function saveToFirebase(detections) {
  try {
    const { collection, addDoc, serverTimestamp } = window._fns;
    const violators = detections.filter(d => !d.hasHardhat || !d.hasVest);
    if (violators.length > 0) {
      await addDoc(collection(window._db, 'incidents'), {
        timestamp:  serverTimestamp(),
        violations: violators.length,
        total:      detections.length,
        missingPPE: [
          ...(!violators[0].hasHardhat ? ['Hard Hat'] : []),
          ...(!violators[0].hasVest    ? ['Safety Vest'] : []),
        ].join(', '),
        operator: window._auth.currentUser?.email,
      });
    }
  } catch (e) { /* silently ignore if Firestore not yet configured */ }
}

// ============================================================
// PPE TOGGLES
// ============================================================
window.togglePPE = function(type) {
  ppeSettings[type] = !ppeSettings[type];
  const el = document.getElementById('tog-' + type);
  el.classList.toggle('on', ppeSettings[type]);
  addLog('info', `${type} detection ${ppeSettings[type] ? 'ENABLED ✓' : 'disabled'}`);
};

// ============================================================
// LOG
// ============================================================
function addLog(type, msg) {
  const time = new Date().toLocaleTimeString('en-PH', { hour12: false });
  detectionLog.unshift({ type, msg, time });
  if (detectionLog.length > 200) detectionLog.pop();

  const list = document.getElementById('logList');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerHTML = `<div class="log-time">${time}</div><div class="log-msg">${msg}</div>`;
  list.insertBefore(entry, list.firstChild);
  while (list.children.length > 30) list.removeChild(list.lastChild);
}

window.clearLog = function() {
  document.getElementById('logList').innerHTML = '';
  detectionLog.length = 0;
  addLog('info', 'Log cleared');
};

// ============================================================
// EMAIL REPORT
// ============================================================
window.sendReport = async function() {
  const email    = document.getElementById('reportEmail').value.trim();
  const statusEl = document.getElementById('sendStatus');
  statusEl.className = 'send-status';

  if (!email || !email.includes('@')) {
    statusEl.textContent = '⚠ Enter a valid email address.';
    statusEl.className = 'send-status err';
    return;
  }

  const rate = stats.total > 0 ? Math.round((stats.compliant / stats.total) * 100) : 0;
  const now  = new Date().toLocaleString('en-PH');

  const subject = encodeURIComponent(`[SafeSite] PPE Compliance Report — ${new Date().toLocaleDateString('en-PH')}`);
  const body    = encodeURIComponent(`
SafeSite PPE Detection Report
==============================
Generated : ${now}
Operator  : ${window._auth.currentUser?.email || 'N/A'}

--- SUMMARY ---
Total Workers Entered : ${stats.total}
PPE Compliant         : ${stats.compliant}
Violations            : ${stats.violations}
Compliance Rate       : ${rate}%

--- BREAKDOWN ---
Workers WITH Hard Hat : ${stats.hardhat}
Workers WITH Vest     : ${stats.vest}
Workers WITHOUT Hard Hat : ${stats.noHardhat}
Workers WITHOUT Vest     : ${stats.noVest}

--- RECENT LOG (last 15 entries) ---
${detectionLog.slice(0, 15).map(l => `[${l.time}] ${l.msg}`).join('\n')}

---
Sent by SafeSite PPE Detection System
  `.trim());

  window.open(`mailto:${email}?subject=${subject}&body=${body}`);

  statusEl.textContent = '✅ Email client opened — check your mail app and click Send.';
  statusEl.className = 'send-status ok';
  showToast('Report ready to send to ' + email, 'ok');

  // Save report record to Firestore
  try {
    const { collection, addDoc, serverTimestamp } = window._fns;
    await addDoc(collection(window._db, 'reports'), {
      timestamp:      serverTimestamp(),
      sentTo:         email,
      totalWorkers:   stats.total,
      compliant:      stats.compliant,
      violations:     stats.violations,
      complianceRate: rate,
      sentBy:         window._auth.currentUser?.email,
    });
  } catch (e) {}
};

// ============================================================
// LOGOUT
// ============================================================
window.doLogout = async function() {
  stopCamera();
  try {
    const { signOut } = window._fns;
    await signOut(window._auth);
    window.location.href = 'index.html';
  } catch (err) {
    showToast('Logout failed', 'err');
  }
};

// ============================================================
// TOAST
// ============================================================
function showToast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3500);
}
