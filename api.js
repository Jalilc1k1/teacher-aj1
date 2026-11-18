// Связь приложения с базой данных Supabase. Интерфейс: api('/путь', тело) — как раньше.
let _lessons = null;
const _tg = () => window.Telegram && Telegram.WebApp;
function tgId() {
  const u = _tg() && Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.user;
  if (u) return String(u.id);
  const d = localStorage.getItem('devUser'); return d ? 'dev:' + d.toLowerCase() : null;
}
async function rpc(fn, args) {
  const h = { 'Content-Type': 'application/json', apikey: SUPABASE_KEY };
  if (SUPABASE_KEY.startsWith('eyJ')) h.Authorization = 'Bearer ' + SUPABASE_KEY;
  let r;
  try { r = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: h, body: JSON.stringify(args || {}) }); }
  catch (e) { throw Object.assign(new Error('Нет связи с базой данных. Проверьте интернет.'), { code: 'network' }); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const m = j.message || j.error || 'Ошибка'; throw Object.assign(new Error(m === 'not_registered' ? 'Сначала зарегистрируйтесь' : m), { code: m, status: r.status }); }
  return j;
}
async function loadLessons() { if (!_lessons) { const r = await fetch('lessons.json'); _lessons = await r.json(); } return _lessons; }
const adminKey = () => localStorage.getItem('adminKey') || '';
const SHOP = { heart: { name: 'Одна жизнь', price: 10 }, hearts_full: { name: 'Все жизни', price: 40 }, boost: { name: 'Двойной опыт на 1 час', price: 30 }, freeze: { name: 'Заморозка серии', price: 25 } };
const AVATARS = { '🦉': 0, '🐱': 20, '🦊': 20, '🐼': 30, '🦁': 30, '🐸': 30, '🦄': 50, '🐲': 60, '🚀': 80, '👑': 100 };

async function api(path, b) {
  b = b || {}; const p_tg = tgId(); let m;
  if (path === '/me') {
    const tu = (_tg() && Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.user) || {};
    const info = { first: tu.first_name || '', last: tu.last_name || '', username: tu.username || '' };
    const dev = !(_tg() && Telegram.WebApp.initData);
    if (!p_tg) return { user: null, tg: info, dev };
    const r = await rpc('me', { p_tg }); return { user: r.user, tg: info, dev };
  }
  if (path === '/register') return rpc('register', { p_tg, p_nick: b.nick || '', p_first: b.first || '', p_last: b.last || '' });
  if (path === '/lessons') {
    const [L, pr] = await Promise.all([loadLessons(), rpc('progress_get', { p_tg })]);
    const levels = L.levels.map(l => ({ ...l, chapters: [] })); let next = 0;
    for (const x of L.lessons) {
      const lv = levels[x.level - 1]; const st = pr.stars[x.id] || 0;
      let ch = lv.chapters[x.chapter - 1]; if (!ch) ch = lv.chapters[x.chapter - 1] = { n: x.chapter, title: x.chapter_title, lessons: [] };
      if (!next && !st) next = x.id;
      ch.lessons.push({ id: x.id, title: x.title, kind: x.kind, stars: st });
    }
    return { levels, next: next || 300, teacher: pr.teacher };
  }
  if ((m = path.match(/^\/lesson\/(\d+)$/))) {
    await rpc('check_start', { p_tg, p_lesson: +m[1] });
    const L = await loadLessons(); const l = L.lessons[+m[1] - 1];
    return { id: l.id, title: l.title, chapter: l.chapter_title, level: l.level_name, exercises: l.exercises };
  }
  if (path === '/heart-lost') return rpc('heart_lost', { p_tg });
  if (path === '/complete') return rpc('complete_lesson', { p_tg, p_lesson: +b.lessonId, p_mistakes: +b.mistakes || 0 });
  if (path === '/leaderboard') return rpc('leaderboard', { p_tg });
  if (path === '/settings') return rpc('set_settings', { p_tg, p_theme: b.theme || null, p_avatar: b.avatar || null });
  if (path === '/shop') return { items: SHOP, avatars: AVATARS };
  if (path === '/buy') return rpc('buy', { p_tg, p_item: String(b.item || '') });
  if (path === '/tasks') return rpc('tasks_list', { p_tg });
  if ((m = path.match(/^\/tasks\/(\d+)\/submit$/))) return rpc('task_submit', { p_tg, p_task: +m[1], p_text: b.text || '' });
  if (path === '/claim-teacher') { const r = await rpc('claim_teacher', { p_tg, p_key: b.key }); localStorage.setItem('adminKey', b.key); return r; }
  // --- учитель ---
  const p_key = adminKey();
  if (path === '/admin/stats') {
    const s = await rpc('admin_stats', { p_key }); const L = await loadLessons();
    s.hard = s.hard.map(h => { const l = L.lessons[h.id - 1]; return { ...h, level_name: l.level_name, chapter_title: l.chapter_title, title: l.title }; });
    s.byLevel = s.byLevel.map(x => ({ ...x, name: L.levels[x.level - 1].name })); return s;
  }
  if (path === '/admin/users') return rpc('admin_users', { p_key });
  if (path === '/admin/gift') return rpc('admin_gift', { p_key, p_user: +b.userId, p_gems: +b.gems || 0, p_xp: +b.xp || 0, p_hearts: !!b.hearts });
  if (path === '/admin/role') return rpc('admin_role', { p_key, p_user: +b.userId, p_role: b.role });
  if (path === '/admin/task') return rpc('admin_task', { p_key, p_title: b.title || '', p_body: b.body || '', p_xp: +b.xp || 50 });
  if (path === '/admin/submissions') return rpc('admin_submissions', { p_key });
  if (path === '/admin/grade') return rpc('admin_grade', { p_key, p_id: +b.id, p_score: +b.score || 0, p_feedback: b.feedback || '' });
  throw new Error('Неизвестный запрос: ' + path);
}
