// supabase_config.js
// Ganti dua nilai di bawah ini dengan kredensial dari Supabase Dashboard → Settings → API

const SUPABASE_URL = 'https://ilvauvdsmufiocgvczgq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_g423umHae_GjC_z6zPjVJg_ZjrnwRxT';

// Inisialisasi Supabase client (pakai CDN, tidak perlu npm)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// AUTH HELPERS
// ============================================================

// Hash password sederhana (SHA-256) — cukup untuk project pribadi
// Untuk produksi skala besar, gunakan bcrypt di server
export async function hashPassword(password) {
    const encoded = new TextEncoder().encode(password);
    const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hashBuf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Simpan session ke localStorage (ringan, cukup untuk app pribadi)
export function saveSession(user) {
    localStorage.setItem('rp_user', JSON.stringify({
        id: user.id,
        username: user.username
    }));
}

export function getSession() {
    try {
        return JSON.parse(localStorage.getItem('rp_user'));
    } catch {
        return null;
    }
}

export function clearSession() {
    localStorage.removeItem('rp_user');
}

// Guard — panggil di awal setiap halaman yang butuh login
export function requireAuth() {
    const user = getSession();
    if (!user) {
        window.location.href = 'auth.html';
        return null;
    }
    return user;
}

// ============================================================
// PLAN HELPERS
// ============================================================

export async function getPlans(userId) {
    const { data, error } = await supabase
        .from('plans')
        .select('id, type, filosofi, dist, level, race_name, race_date, current_week, program, paused_weeks, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function savePlan(userId, planData) {
    const { data, error } = await supabase
        .from('plans')
        .insert({ user_id: userId, ...planData })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updatePlan(planId, updates) {
    const { error } = await supabase
        .from('plans')
        .update(updates)
        .eq('id', planId);
    if (error) throw error;
}

export async function deletePlan(planId) {
    const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', planId);
    if (error) throw error;
}

// ============================================================
// SESSION LOG HELPERS (status done/skip + catatan tiap sesi)
// ============================================================

export async function getSessionLogs(planId) {
    const { data, error } = await supabase
        .from('session_logs')
        .select('week_idx, day_idx, status, note')
        .eq('plan_id', planId);
    if (error) throw error;
    // Return sebagai map: "weekIdx-dayIdx" → {status, note}
    const map = {};
    (data || []).forEach(row => {
        map[`${row.week_idx}-${row.day_idx}`] = { status: row.status, note: row.note };
    });
    return map;
}

export async function upsertSessionLog(planId, userId, weekIdx, dayIdx, status, note) {
    const { error } = await supabase
        .from('session_logs')
        .upsert({
            plan_id: planId,
            user_id: userId,
            week_idx: weekIdx,
            day_idx: dayIdx,
            status: status || null,
            note: note || null
        }, { onConflict: 'plan_id,week_idx,day_idx' });
    if (error) throw error;
}