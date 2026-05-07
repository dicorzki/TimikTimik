/**
 * RunPlan — Integration Patch
 * ============================================================
 * Tambahkan script ini TEPAT sebelum </body> di generator.html
 * dengan tag: <script type="module" src="integration_patch.js"></script>
 *
 * Yang dilakukan patch ini (TANPA menyentuh logic asli):
 * 1. Auth guard — redirect ke auth.html kalau belum login
 * 2. Tampilkan username + tombol back ke dashboard di header
 * 3. Sinkronisasi tema (dark/light) dengan index.html
 * 4. Hook generateProgram() road → simpan ke Supabase setelah generate
 * 5. Hook generateTrailProgram() → simpan ke Supabase setelah generate
 * 6. Sync current_week ke Supabase setiap kali user ganti tab minggu
 * 7. Sync session log (done/skip) ke Supabase real-time
 * 8. Load plan dari Supabase kalau dibuka via ?plan=UUID dari dashboard
 * ============================================================
 */

import {
  supabase,
  getSession,
  clearSession,
  savePlan,
  updatePlan,
  getSessionLogs,
  upsertSessionLog
} from './supabase_config.js';

// ── 1. AUTH GUARD ──────────────────────────────────────────
const _rpUser = getSession();
if (!_rpUser) {
  window.location.href = 'auth.html';
  throw new Error('not authenticated');
}

// ── 2. INJECT USER INFO + BACK BUTTON KE HEADER ───────────
(function injectHeaderUI() {
  const headerRight = document.querySelector('.header-right');
  if (!headerRight) return;

  // Hapus fix CSS numpuk yang lama (kalau masih ada)
  const oldFix = document.getElementById('header-mobile-fix');
  if (oldFix) oldFix.remove();

  // [FIX] Suntik CSS untuk Burger Menu Dropdown
  if (!document.getElementById('header-burger-fix')) {
    const styleFix = document.createElement('style');
    styleFix.id = 'header-burger-fix';
    styleFix.innerHTML = `
      .burger-btn { display: none; background: none; border: none; font-size: 22px; cursor: pointer; color: var(--text); padding: 0 4px; line-height: 1; }
      .nav-group { display: flex; align-items: center; gap: 12px; }
      @media (max-width: 14400px) {
        .back-to-dash { display: none !important; }
        .header-right { position: relative; gap: 12px !important; }
        .burger-btn { display: block; }
        .nav-group {
          display: none;
          align-items: center !important;
          position: absolute; top: 100%; right: 0; margin-top: 15px;
          background: var(--bg); border: 1px solid var(--border2);
          border-radius: 12px; padding: 16px;
          flex-direction: column; align-items: flex-end; gap: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
          z-index: 999; min-width: 160px;
        }
        [data-theme="dark"] .nav-group { box-shadow: 0 8px 24px rgba(0,0,0,0.6); }
        .nav-group.show { display: flex; }
      }
    `;
    document.head.appendChild(styleFix);
  }

  // Container untuk isi menu
  const navGroup = document.createElement('div');
  navGroup.className = 'nav-group';

  // Tombol back ke dashboard
  const backBtn = document.createElement('a');
  backBtn.href = 'index.html';
  backBtn.classList.add('back-to-dash');
  backBtn.title = 'Kembali ke Dashboard';
  backBtn.style.cssText = `
    display:inline-flex;align-items:center;gap:5px;
    padding:6px 12px;border-radius:100px;
    border:1.5px solid var(--border2);background:transparent;
    color:var(--text2);font-size:12px;font-weight:600;
    font-family:'Inter',sans-serif;text-decoration:none;
    transition:all .15s;flex-shrink:0;
  `;
  backBtn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
    Dashboard
  `;

  // Info user
  const userInfo = document.createElement('div');
  userInfo.style.cssText = 'font-size:12px;color:var(--text3);white-space:nowrap; font-family:"Inter",sans-serif;';
  userInfo.innerHTML = `Halo, <span style="color:var(--text);font-weight:600;">${_rpUser.username}</span>`;

  // Logout btn
  const logoutBtn = document.createElement('button');
  logoutBtn.textContent = 'Logout';
  logoutBtn.style.cssText = `
    background:rgba(255,0,0,0.08);color:#e06060;
    border:1px solid rgba(255,0,0,0.2);
    padding:6px 12px;border-radius:8px;
    cursor:pointer;font-size:11px;font-weight:600;
    font-family:'Inter',sans-serif;
  `;
  logoutBtn.onclick = () => { 
    const theme = localStorage.getItem('rp-theme');
    localStorage.clear();
    if (theme) localStorage.setItem('rp-theme', theme);
    clearSession(); window.location.href = 'auth.html'; 
  };

  // Tombol Burger
  const burgerBtn = document.createElement('button');
  burgerBtn.className = 'burger-btn';
  burgerBtn.innerHTML = '☰'; // Ikon Hamburger
  burgerBtn.onclick = (e) => {
    e.stopPropagation(); // Biar menunya nggak langsung nutup pas diklik
    navGroup.classList.toggle('show');
  };

  // Masukin elemen ke navGroup
  navGroup.appendChild(userInfo);
  navGroup.appendChild(backBtn);
  navGroup.appendChild(logoutBtn);

  // Cari tombol tema bawaan
  const themeBtn = document.getElementById('btn-theme');
  
  // Susun urutannya: [Isi Menu] -> [Tombol Tema] -> [Tombol Burger]
  if (themeBtn) {
    headerRight.insertBefore(navGroup, themeBtn);
  } else {
    headerRight.appendChild(navGroup);
  }
  headerRight.appendChild(burgerBtn);

  // Tutup menu otomatis kalau user nge-klik di luar area kotak menu
  document.addEventListener('click', (e) => {
    if (!navGroup.contains(e.target) && !burgerBtn.contains(e.target)) {
      navGroup.classList.remove('show');
    }
  });
})();

// ── 3. TEMA SYNC ───────────────────────────────────────────
// Generator punya initTheme sendiri yang sudah baca rp-theme dari localStorage.
// Tidak perlu override — key yang sama (rp-theme) sudah dipakai index.html.
// Cukup pastikan meta-theme juga ikut update.
(function watchTheme() {
  const metaTheme = document.getElementById('meta-theme');
  if (!metaTheme) return;
  const observer = new MutationObserver(() => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    metaTheme.content = isDark ? '#111110' : '#FAFAF8';
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();

// ── 4. SUPABASE SAVE — PLAN ID TRACKING ────────────────────
// Plan ID aktif yang sedang dibuka (dari URL param atau setelah generate baru)
let _activePlanId = null;

// Baca ?plan=UUID dari URL (dibuka dari dashboard)
const _urlPlanId = new URLSearchParams(window.location.search).get('plan');

// ── 5. LOAD PLAN DARI SUPABASE (jika dibuka via ?plan=UUID) ─
if (_urlPlanId) {
  (async function loadPlanFromSupabase() {
    try {
      const { data: plan, error } = await supabase
        .from('plans')
        .select('*')
        .eq('id', _urlPlanId)
        .eq('user_id', _rpUser.id)
        .single();

      if (error || !plan) {
        console.warn('Plan tidak ditemukan di Supabase, fallback ke localStorage');
        return;
      }

      _activePlanId = plan.id;

      // Tunggu sampai DOM + script generator selesai init
      // Pakai requestAnimationFrame dua kali untuk pastikan semua var global sudah ada
      requestAnimationFrame(() => requestAnimationFrame(() => {
        _hideModuleSelection();
        if (plan.type === 'trail') {
          _loadTrailPlan(plan);
        } else {
          _loadRoadPlan(plan);
        }
      }));
    } catch (err) {
      console.error('Load plan error:', err);
    }
  })();
} else {
  // [REVISI FIX] Sapu sisa form, TAPI lindungi mutlak data login & tema!
  Object.keys(localStorage).forEach(k => {
    const keyLower = k.toLowerCase();
    // Kalau nama key-nya ngandung unsur kata di bawah ini, JANGAN dihapus
    const isSafe = keyLower.includes('theme') || 
                   keyLower.includes('user') || 
                   keyLower.includes('auth') || 
                   keyLower.includes('session') || 
                   k.startsWith('sb-');
                   
    if (!isSafe) {
      localStorage.removeItem(k); // Hapus sisanya (data form lama dll)
    }
  });
  
  if (typeof state !== 'undefined') state.generated = false;
  if (typeof trailState !== 'undefined') trailState.generated = false;
}
function _loadRoadPlan(plan) {
  // Isi state road (variabel global di generator.html)
  if (typeof state === 'undefined') return;

  state.filosofi    = plan.filosofi    || 'higdon';
  state.dist        = plan.dist        || '5k';
  state.level       = plan.level       || 'pemula';
  state.paceMin     = plan.pace_min    || 7;
  state.paceSec     = plan.pace_sec    || 0;
  state.raceDateStr = plan.race_date   || '';
  state.name        = plan.race_name   || '';
  state.age         = 30; // tidak disimpan di schema, default
  state.currentWeek = plan.current_week || 0;
  state.pausedWeeks = plan.paused_weeks  || [];
  state.program     = plan.program;
  state.generated   = true;

  // Restore chip selections dan filosofi card
  if (typeof restoreChip === 'function') {
    restoreChip('dist-chips', state.dist);
    restoreChip('level-chips', state.level);
  }
  const cards = document.querySelectorAll('.filosofi-card');
  cards.forEach(c => {
    c.classList.toggle('active', c.getAttribute('data-filosofi') === state.filosofi);
  });

  // Restore form inputs
  const nameEl  = document.getElementById('runner-name');
  const pminEl  = document.getElementById('pace-min');
  const psecEl  = document.getElementById('pace-sec');
  const rdEl    = document.getElementById('race-date');
  if (nameEl) nameEl.value = state.name;
  if (pminEl) pminEl.value = state.paceMin;
  if (psecEl) psecEl.value = state.paceSec;
  if (rdEl && state.raceDateStr) rdEl.value = state.raceDateStr;

  // Sembunyikan restore banner (ini dari Supabase, bukan localStorage)
  const restoreBanner = document.getElementById('restore-banner');
  if (restoreBanner) restoreBanner.style.display = 'none';

  if (typeof renderOutput === 'function') renderOutput();

  // Load session logs dari Supabase dan apply ke UI
  _loadAndApplySessionLogs(_activePlanId);
}

function _loadTrailPlan(plan) {
  if (typeof trailState === 'undefined') return;

  // 1. Switch ke modul trail DULUAN.
  // Ini penting karena switchToTrailModul() otomatis baca localStorage
  // dan akan nimpa state cloud kita kalau dipanggil di akhir.
  if (typeof switchToTrailModul === 'function') {
    switchToTrailModul();
  }

  // 2. BARU kita masukin data asli dari Supabase ke state.
  // Jadi data dari cloud ini yang menang.
  trailState.name          = plan.race_name     || '';
  trailState.level         = plan.level         || 'trail_pemula';
  trailState.filosofi      = plan.filosofi      || 'jornet';
  trailState.raceDistKm    = plan.race_dist_km  || 38.5;
  trailState.raceElevGain  = plan.race_elev_gain || 2812;
  trailState.raceCOT       = 900;
  trailState.raceName      = plan.race_name     || '';
  trailState.targetMinutes = plan.target_minutes || 600;
  trailState.raceDate      = plan.race_date     || '';
  trailState.program       = plan.program;
  trailState.currentWeek   = plan.current_week  || 0;
  trailState.pausedWeeks   = plan.paused_weeks  || [];

  // 3. Update form input UI di sebelah kiri biar angkanya pas
  const nameEl = document.getElementById('trail-name');
  const tHoursEl = document.getElementById('trail-target-hours');
  if (nameEl && trailState.name) nameEl.value = trailState.name;
  if (tHoursEl && trailState.targetMinutes) tHoursEl.value = Math.round(trailState.targetMinutes / 60);
  if (typeof window._setTrailDate === 'function' && trailState.raceDate) {
    window._setTrailDate(trailState.raceDate);
  }

  // 4. Render output paksa ke layar!
  if (typeof renderTrailOutput === 'function') {
    renderTrailOutput();
  }

  // 5. Load data centang selesai/skip
  _loadAndApplySessionLogs(_activePlanId);
}

// ── 6. HOOK generateProgram() ROAD → SIMPAN KE SUPABASE ────
// Setelah generateProgram() asli selesai (ia memanggil renderOutput),
// kita wrap dengan proxy tanpa mengubah implementasinya.
(function hookRoadGenerate() {
  // Tunggu sampai init() selesai
  const originalInit = typeof init === 'function' ? init : null;

  // Kita tidak bisa override init() yang sudah terdefinisi dengan var,
  // jadi kita pasang event listener pada tombol generate setelah DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function() {
    const btnGenerate = document.getElementById('btn-generate');
    if (!btnGenerate) return;

    // Tambah click listener KEDUA — dijalankan setelah listener original
    btnGenerate.addEventListener('click', async function() {
      // Tunggu satu tick agar generateProgram() asli selesai dulu
      await new Promise(r => setTimeout(r, 50));

      if (typeof state === 'undefined' || !state.generated || !state.program) return;

      _hideModuleSelection();

      try {
        const planData = _buildRoadPlanData();
        if (_activePlanId) {
          // Update existing
          await updatePlan(_activePlanId, planData);
        } else {
          // Insert baru
          const saved = await savePlan(_rpUser.id, planData);
          _activePlanId = saved.id;
          // Update URL tanpa reload halaman
          window.history.replaceState({}, '', `generator.html?plan=${_activePlanId}`);
        }
        _showSyncToast('✓ Program tersimpan ke cloud');
      } catch (err) {
        console.error('Save road plan error:', err);
        _showSyncToast('⚠ Gagal simpan ke cloud — tersimpan lokal');
      }
    });
  }, { once: true });
})();

// ── 7. HOOK generateTrailProgram() → SIMPAN KE SUPABASE ────
(function hookTrailGenerate() {
  document.addEventListener('DOMContentLoaded', function() {
    const btnTrailGen = document.getElementById('btn-generate-trail');
    // btn-generate-trail dibuat secara dinamis saat switchToTrailModul(),
    // jadi kita pakai event delegation ke body
    document.body.addEventListener('click', async function(e) {
      const btn = e.target.closest('#btn-generate-trail');
      if (!btn) return;

      await new Promise(r => setTimeout(r, 100));

      if (typeof trailState === 'undefined' || !trailState.program) return;

      _hideModuleSelection();

      try {
        const planData = _buildTrailPlanData();
        if (_activePlanId) {
          await updatePlan(_activePlanId, planData);
        } else {
          const saved = await savePlan(_rpUser.id, planData);
          _activePlanId = saved.id;
          window.history.replaceState({}, '', `generator.html?plan=${_activePlanId}`);
        }
        _showSyncToast('✓ Program trail tersimpan ke cloud');
      } catch (err) {
        console.error('Save trail plan error:', err);
        _showSyncToast('⚠ Gagal simpan — tersimpan lokal');
      }
    });
  }, { once: true });
})();

// ── 8. SYNC CURRENT WEEK KE SUPABASE ──────────────────────
// Intercept klik week-tab via event delegation
document.addEventListener('click', async function(e) {
  const weekTab = e.target.closest('.week-tab');
  if (!weekTab || !_activePlanId) return;

  const weekIdx = parseInt(weekTab.getAttribute('data-week'), 10);
  if (isNaN(weekIdx)) return;

  try {
    await updatePlan(_activePlanId, { current_week: weekIdx });
  } catch (err) {
    // silent — localStorage masih jadi backup
  }
});

// ── 9. SYNC SESSION LOG (DONE/SKIP) KE SUPABASE ──────────
// Event delegation untuk tombol .day-status-btn
document.addEventListener('click', async function(e) {
  const statusBtn = e.target.closest('.day-status-btn');
  if (!statusBtn || !_activePlanId) return;

  const key = statusBtn.getAttribute('data-key'); // format: "rp-status-wX-dX" atau "trail-X-X"
  if (!key) return;

  // Parse week dan day index dari key
  const match = key.match(/w?(\d+)-?d?(\d+)/) || key.match(/(\d+)-(\d+)/);
  if (!match) return;

  const weekIdx = parseInt(match[1], 10);
  const dayIdx  = parseInt(match[2], 10);

  // Baca status terbaru dari localStorage (sudah diset oleh handler asli)
  await new Promise(r => setTimeout(r, 30));
  let status = null;
  try { status = localStorage.getItem(key) || null; } catch(e) {}

  // Baca catatan jika ada
  const noteKey = key.replace('rp-status-', 'rp-note-').replace(/^trail-/, 'trail-note-');
  let note = null;
  try { note = localStorage.getItem(noteKey) || null; } catch(e) {}

  try {
    await upsertSessionLog(_activePlanId, _rpUser.id, weekIdx, dayIdx, status, note);
  } catch (err) {
    // silent
  }
});

// Sync catatan (note textarea)
document.addEventListener('input', async function(e) {
  const ta = e.target.closest('.day-note-input');
  if (!ta || !_activePlanId) return;

  const noteKey = ta.getAttribute('data-notekey');
  if (!noteKey) return;

  const match = noteKey.match(/w?(\d+)-?d?(\d+)/) || noteKey.match(/(\d+)-(\d+)/);
  if (!match) return;

  const weekIdx = parseInt(match[1], 10);
  const dayIdx  = parseInt(match[2], 10);

  const statusKey = noteKey.replace('rp-note-', 'rp-status-').replace('trail-note-', 'trail-');
  let status = null;
  try { status = localStorage.getItem(statusKey) || null; } catch(e) {}

  // Debounce — tunggu 800ms setelah berhenti mengetik
  clearTimeout(ta._syncTimer);
  ta._syncTimer = setTimeout(async () => {
    try {
      await upsertSessionLog(_activePlanId, _rpUser.id, weekIdx, dayIdx, status, ta.value || null);
    } catch (err) {}
  }, 800);
});

// ── 10. LOAD & APPLY SESSION LOGS KE UI ───────────────────
async function _loadAndApplySessionLogs(planId) {
  if (!planId) return;
  try {
    const logs = await getSessionLogs(planId);
    
    // [TAMBAHAN FIX] Bersihkan sisa-sisa data dari program lain di localStorage
    Object.keys(localStorage).forEach(k => {
      // Hapus semua key yang berhubungan sama status & note biar gak bocor antar program
      if (k.startsWith('rp-status-') || k.startsWith('rp-note-') || k.startsWith('trail-')) {
        localStorage.removeItem(k);
      }
    });

    // Apply ke localStorage agar UI asli bisa membacanya sesuai program saat ini
    Object.entries(logs).forEach(([key, val]) => {
      const [wIdx, dIdx] = key.split('-');
      // Road keys
      const statusKey = `rp-status-w${wIdx}-d${dIdx}`;
      const noteKey   = `rp-note-w${wIdx}-d${dIdx}`;
      // Trail keys
      const trailStatusKey = `trail-${wIdx}-${dIdx}`;
      const trailNoteKey   = `trail-note-${wIdx}-${dIdx}`;

      if (val.status) {
        try { localStorage.setItem(statusKey, val.status); } catch(e) {}
        try { localStorage.setItem(trailStatusKey, val.status); } catch(e) {}
      }
      if (val.note) {
        try { localStorage.setItem(noteKey, val.note); } catch(e) {}
        try { localStorage.setItem(trailNoteKey, val.note); } catch(e) {}
      }
    });
    // Re-render minggu aktif agar status done/skip terlihat
    if (typeof renderWeekContent === 'function' && typeof state !== 'undefined' && state.program) {
      const paceEasySec = (typeof paceToSec === 'function') ? paceToSec(state.paceMin, state.paceSec) : 420;
      const zones = (typeof calcPaceZones === 'function') ? calcPaceZones(paceEasySec, state.filosofi) : {};
      renderWeekContent(state.currentWeek, zones);
    }
    if (typeof renderTrailWeekContent === 'function' && typeof trailState !== 'undefined' && trailState.program) {
      renderTrailWeekContent(trailState.currentWeek);
    }
  } catch (err) {
    console.warn('Load session logs error:', err);
  }
}

// ── 11. BUILDERS — buat objek data yang siap masuk Supabase ─
function _buildRoadPlanData() {
  const filosLabel = {
    higdon: 'Hal Higdon', galloway: 'Jeff Galloway', daniels: 'Jack Daniels'
  }[state.filosofi] || state.filosofi;

  const distLabel = {
    '5k':'5K', '10k':'10K', 'hm':'Half Marathon', 'fm':'Full Marathon'
  }[state.dist] || state.dist.toUpperCase();

  return {
    type:         'road',
    filosofi:     state.filosofi,
    dist:         state.dist,
    level:        state.level,
    race_name:    `${distLabel} — ${filosLabel}`,
    race_date:    state.raceDateStr || null,
    pace_min:     state.paceMin,
    pace_sec:     state.paceSec,
    program:      state.program,
    current_week: state.currentWeek || 0,
    paused_weeks: state.pausedWeeks || []
  };
}

function _buildTrailPlanData() {
  return {
    type:           'trail',
    filosofi:       trailState.filosofi,
    dist:           null,
    level:          trailState.level,
    race_name:      trailState.raceName || 'Trail Run',
    race_date:      trailState.raceDate || null,
    target_minutes: trailState.targetMinutes || 600,
    race_dist_km:   trailState.raceDistKm   || 0,
    race_elev_gain: trailState.raceElevGain || 0,
    program:        trailState.program,
    current_week:   trailState.currentWeek  || 0,
    paused_weeks:   trailState.pausedWeeks  || []
  };
}

// ── 12. TOAST NOTIFIKASI ────────────────────────────────────
let _toastTimer = null;
function _showSyncToast(msg) {
  let toast = document.getElementById('rp-sync-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'rp-sync-toast';
    toast.style.cssText = `
      position:fixed;bottom:20px;left:50%;
      transform:translateX(-50%) translateY(120%);
      background:var(--text);color:var(--bg);
      padding:9px 18px;border-radius:100px;
      font-size:13px;font-weight:500;
      font-family:'Inter',sans-serif;
      z-index:9999;transition:transform .3s cubic-bezier(0.34,1.56,0.64,1);
      white-space:nowrap;pointer-events:none;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(120%)';
  }, 2800);
}

// Fungsi buat ngumpetin pilihan modul dan form input pas program udah jadi
function _hideModuleSelection() {
  // 1. Sembunyikan kotak "Pilih Modul" besar di bagian atas
  const modulSection = document.querySelector('.modul-section');
  if (modulSection) {
    modulSection.style.display = 'none';
  }

  // 2. Sembunyikan tab kecil Road/Trail di dalam kartu hasil program
  const modulTabsOutput = document.getElementById('modul-tabs-output');
  if (modulTabsOutput) {
    modulTabsOutput.style.display = 'none';
  }

  // 3. Sembunyikan Panel Kiri (Form Profil, Target Race, dll)
  const panelLeft = document.querySelector('.panel-left');
  if (panelLeft) {
    panelLeft.style.display = 'none';
  }

  // 4. Ubah layout Main biar Panel Kanan (Hasil Program) jadi melar Full Width
  const mainContainer = document.querySelector('.main');
  if (mainContainer) {
    mainContainer.style.display = 'block'; // Matiin grid bawaan yang ngebagi 2 kolom
  }
}