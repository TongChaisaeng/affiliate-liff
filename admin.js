/* ===================== core ===================== */
const RUN = window.google && google.script && google.script.run;
const MOCK = !RUN;
const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
const baht = n => '฿' + Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const S = { page: 'home', boot: null, cache: {}, sel: new Set(), filt: {}, sort: { k: 'registered_at', d: -1 }, pageNo: 1, tab: {} };
const STAGE_TH = { lead: 'Lead', pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว ยังไม่เริ่ม', sampled: 'ขอตัวอย่างแล้ว', posted: 'โพสต์แล้ว', active: 'Active (มียอดขาย)', dormant: 'เคยขาย หายไป', rejected: 'ไม่ผ่าน', suspended: 'ระงับ', blocked: 'บล็อก OA' };
const STAGE_CLS = { pending: 'warn', active: 'good', dormant: 'bad', rejected: 'bad', suspended: 'bad', posted: 'info', sampled: 'info', approved: '' };
const REQ_TH = { requested: 'รออนุมัติ', approved: 'รอจัดส่ง', shipped: 'จัดส่งแล้ว', delivered: 'ได้รับของแล้ว', content_submitted: 'ส่งคลิปแล้ว', done: 'เสร็จ', rejected: 'ปฏิเสธ' };
const REQ_CLS = { requested: 'warn', approved: 'info', shipped: 'info', delivered: 'info', content_submitted: 'good', done: 'good', rejected: 'bad' };
const AV_COLORS = ['#007864', '#005A4B', '#2E6F95', '#8A5A00', '#6B4E9B', '#A23E48', '#3D7A3A', '#45606B'];
const avColor = s => { let h = 0; String(s).split('').forEach(c => { h = (h * 31 + c.charCodeAt(0)) % 997; }); return AV_COLORS[h % AV_COLORS.length]; };
const av = (name, size) => `<span class="av" style="background:${avColor(name)}${size ? `;width:${size}px;height:${size}px;font-size:${Math.round(size / 2.6)}px` : ''}">${esc(String(name || '?').trim().replace(/^[เแโใไ@]+/, '').charAt(0).toUpperCase() || '?')}</span>`;
const ICON = {
  msg: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  tag: '<svg viewBox="0 0 24 24"><path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/></svg>',
  ok: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  ref: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v6H4V6h6"/></svg>',
};

function call(action, body) {
  return new Promise((res, rej) => {
    if (MOCK) return setTimeout(() => { try { res(mockApi(action, body || {})); } catch (e) { rej(e); } }, 180);
    google.script.run
      .withSuccessHandler(s => { let r; try { r = JSON.parse(s); } catch (e) { return rej(new Error('ตอบกลับไม่ถูกต้อง')); } r.ok ? res(r.data) : rej(new Error(r.error)); })
      .withFailureHandler(e => rej(e instanceof Error ? e : new Error(String(e && e.message || e))))
      .adminApi(action, body ? JSON.stringify(body) : '');
  });
}
async function load(key, force) {
  if (!force && S.cache[key]) return S.cache[key];
  S.cache[key] = await call(key);
  return S.cache[key];
}
function toast(m, err) { const t = $('#toast'); t.textContent = m; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(t._h); t._h = setTimeout(() => t.className = 'toast', 3200); }
function loading() { app.innerHTML = '<div class="loading"><div class="spin"></div>กำลังโหลด…</div>'; }
async function act(btn, fn) {
  if (btn) { btn.disabled = true; btn._t = btn.innerHTML; btn.innerHTML = 'กำลังทำ…'; }
  try { return await fn(); } catch (e) { toast(e.message, true); } finally { if (btn && document.body.contains(btn)) { btn.disabled = false; btn.innerHTML = btn._t; } }
}
function go(page, opt) {
  S.page = page; S.sel.clear(); S.pageNo = 1;
  if (opt && opt.filt) S.filt = Object.assign({}, opt.filt); else if (!opt || !opt.keep) S.filt = {};
  if (opt && opt.tab) S.tab[page] = opt.tab;
  document.querySelectorAll('.side a[data-go]').forEach(a => a.classList.toggle('on', a.dataset.go === page));
  $('#side').classList.remove('show');
  closeDrawer();
  window.scrollTo(0, 0);
  (PAGES[page] || pageHome)();
}
function ph(title, acts) { return `<div class="ph"><h1>${esc(title)}</h1><div class="acts">${acts || ''}</div></div>`; }
function tabs(page, list) {
  const cur = S.tab[page] || list[0].k;
  return `<div class="tabs">${list.map(t => `<button data-tab="${t.k}" class="${t.k === cur ? 'on' : ''}">${esc(t.t)}${t.c !== undefined ? `<span class="c">(${t.c})</span>` : ''}</button>`).join('')}</div>`;
}
function bindTabs(page, rerender) { app.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { S.tab[page] = b.dataset.tab; S.sel.clear(); S.pageNo = 1; rerender(); })); }
function invalidate() { Array.from(arguments).forEach(k => delete S.cache[k]); }
function setBadges(h) {
  const t = h.todo || {};
  const set = (id, n) => { const e = $(id); e.hidden = !n; e.textContent = n; };
  set('#nb-creators', t.pending_creators); set('#nb-samples', (t.samples_to_approve || 0) + (t.samples_to_ship || 0));
  set('#nb-videos', t.videos_to_review); set('#nb-leads', t.prospects_new);
  const total = (t.pending_creators || 0) + (t.samples_to_approve || 0) + (t.samples_to_ship || 0) + (t.videos_to_review || 0);
  set('#bellc', total);
}

/* ===================== modal / drawer / menu ===================== */
function modal(title, body, actions) {
  const m = $('#modal');
  m.innerHTML = `<div class="mh"><span class="sp">${esc(title)}</span><button class="x" data-close>×</button></div><div class="mb">${body}</div><div class="mf">${actions || ''}</div>`;
  m.classList.add('show'); $('#mscrim').classList.add('show');
  m.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal));
  const f = m.querySelector('input, textarea, select'); if (f) setTimeout(() => f.focus(), 30);
  return m;
}
function closeModal() { $('#modal').classList.remove('show'); $('#mscrim').classList.remove('show'); }
$('#mscrim').addEventListener('click', closeModal);
function openDrawer(html) { const d = $('#drawer'); d.innerHTML = html; d.classList.add('show'); $('#scrim').classList.add('show'); d.querySelectorAll('[data-dclose]').forEach(b => b.addEventListener('click', closeDrawer)); return d; }
function closeDrawer() { $('#drawer').classList.remove('show'); $('#scrim').classList.remove('show'); }
$('#scrim').addEventListener('click', closeDrawer);
function popMenu(anchor, items) {
  closeMenu();
  const r = anchor.getBoundingClientRect();
  const m = document.createElement('div'); m.className = 'menu'; m.id = 'menu';
  m.innerHTML = items.map((it, i) => `<button data-i="${i}" class="${it.bad ? 'bad' : ''}">${esc(it.t)}</button>`).join('');
  document.body.appendChild(m);
  const w = m.offsetWidth;
  m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w + window.scrollX)) + 'px';
  m.style.top = (r.bottom + 4 + window.scrollY) + 'px';
  m.querySelectorAll('button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); closeMenu(); items[+b.dataset.i].fn(); }));
  setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
}
function closeMenu() { const m = $('#menu'); if (m) m.remove(); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeDrawer(); closeMenu(); } });
/* ===================== Home ===================== */
async function pageHome(force) {
  loading();
  try {
    const h = await load('home', force);
    setBadges(h);
    const k = h.kpi, t = h.todo;
    const pct = (a, b) => b ? Math.round((a - b) / b * 100) : null;
    const delta = (a, b) => { const p = pct(a, b); return p === null ? '<span class="faint">ไม่มีข้อมูลเดือนก่อน</span>' : `<span class="${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p)}%</span> <span class="faint">เทียบเดือนก่อน</span>`; };
    const maxF = Math.max(1, ...h.funnel.map(f => f.value));
    const todos = [
      { n: t.pending_creators, l: 'Creator รออนุมัติ', go: () => go('creators', { filt: { status: 'pending' } }) },
      { n: t.samples_to_approve, l: 'คำขอสินค้าตัวอย่าง รออนุมัติ', go: () => go('samples', { tab: 'requested' }) },
      { n: t.samples_to_ship, l: 'อนุมัติแล้ว รอจัดส่ง / ใส่เลขพัสดุ', go: () => go('samples', { tab: 'approved' }) },
      { n: t.videos_to_review, l: 'คลิปรอตรวจ (รีวิว + ภารกิจแคมเปญ)', go: () => go('videos', { tab: 'pending' }) },
      { n: t.content_overdue, l: 'เลยกำหนดส่งคลิป', go: () => go('samples', { tab: 'overdue' }), hot: true },
      { n: t.prospects_new, l: 'Creator ขายของเราแต่ยังไม่สมัคร', go: () => go('leads', { tab: 'prospects' }) },
    ];
    app.innerHTML = ph('Home', `<button class="btn line" id="refresh">${ICON.ref} อัปเดตข้อมูล</button><button class="btn" id="upload">${ICON.up} นำเข้ายอดขาย TikTok</button>`) +
      `<p class="muted" style="margin:0 0 16px">ภาพรวมเดือน ${esc(h.period)}</p>
      <div class="kpis">
        <div class="kpi"><div class="k">GMV เดือนนี้</div><div class="v">${baht(k.gmv)}</div><div class="d">${delta(k.gmv, k.gmv_last)}</div></div>
        <div class="kpi"><div class="k">Items sold</div><div class="v">${fmt(k.items)}</div><div class="d">${delta(k.items, k.items_last)}</div></div>
        <div class="kpi"><div class="k">Creator ที่มียอดขาย</div><div class="v">${fmt(k.selling)}</div><div class="d faint">จาก ${fmt(k.creators)} คนที่อนุมัติ</div></div>
        <div class="kpi"><div class="k">Creator อนุมัติแล้ว</div><div class="v">${fmt(k.creators)}</div><div class="d faint">สมาชิก Affiliate+</div></div>
        <div class="kpi"><div class="k">ผู้ติดตาม OA ใหม่</div><div class="v">${fmt(k.followers_7d)}</div><div class="d faint">7 วันล่าสุด</div></div>
        <div class="kpi"><div class="k">สมัครใหม่</div><div class="v">${fmt(k.signups_7d)}</div><div class="d faint">7 วันล่าสุด</div></div>
      </div>
      <div class="card"><h2>งานที่ต้องทำ</h2><div class="todo">${todos.map((x, i) => `<button data-todo="${i}" class="${x.hot && x.n ? 'hot' : ''}"><b>${fmt(x.n)}</b><span>${esc(x.l)}</span></button>`).join('')}</div></div>
      <div class="grid2">
        <div class="card"><h2>Funnel ของ Creator</h2><div class="funnel">${h.funnel.map(f => `<div class="fr" data-stage="${f.key}"><span>${esc(STAGE_TH[f.key] || f.label)}</span><div class="bar"><div style="width:${f.value / maxF * 100}%"></div></div><b class="num r" style="text-align:right">${fmt(f.value)}</b></div>`).join('')}</div></div>
        <div class="card"><h2>Top creators เดือนนี้<span class="sp"></span><button class="link" data-go2="creators">ดูทั้งหมด</button></h2>
          <div class="list">${h.top.length ? h.top.map((x, i) => `<div class="li"><span class="rk ${i ? '' : 'r1'}">${i + 1}</span>${av(x.name, 32)}<div class="sp"><b>${esc(x.name)}</b><div class="muted" style="font-size:12.5px">${x.tiktok ? '@' + esc(x.tiktok) : ''}</div></div><b class="num">${baht(x.gmv)}</b></div>`).join('') : '<div class="empty">ยังไม่มียอดขายเดือนนี้ — นำเข้ารายงานจาก TikTok Shop</div>'}</div>
          <h2 style="margin-top:18px">สมัครล่าสุด</h2>
          <div class="list">${h.recent.map(x => `<div class="li" data-open="${esc(x.id)}" style="cursor:pointer">${av(x.name, 32)}<div class="sp"><b>${esc(x.name)}</b><div class="muted" style="font-size:12.5px">${x.tiktok ? '@' + esc(x.tiktok) + ' · ' : ''}${esc(x.registered_at)}</div></div>${stageBadge(x.status)}</div>`).join('') || '<div class="empty">ยังไม่มีผู้สมัคร</div>'}</div>
        </div>
      </div>`;
    app.querySelectorAll('[data-todo]').forEach(b => b.addEventListener('click', () => todos[+b.dataset.todo].go()));
    app.querySelectorAll('[data-stage]').forEach(b => b.addEventListener('click', () => b.dataset.stage === 'lead' ? go('leads') : go('creators', { filt: { stage: b.dataset.stage } })));
    app.querySelectorAll('[data-go2]').forEach(b => b.addEventListener('click', () => go(b.dataset.go2)));
    app.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openCreator(b.dataset.open)));
    $('#refresh').addEventListener('click', e => act(e.currentTarget, async () => { S.cache.home = await call('refresh'); invalidate('creators'); toast('อัปเดต Funnel / Dashboard แล้ว'); pageHome(); }));
    $('#upload').addEventListener('click', uploadModal);
  } catch (e) { fail(e); }
}
function stageBadge(s) { return `<span class="badge ${STAGE_CLS[s] || ''}">${esc(STAGE_TH[s] || s || '-')}</span>`; }
function fail(e) {
  app.innerHTML = /สิทธิ์|บัญชี Google/.test(e.message)
    ? `<div class="deny card"><h2 style="justify-content:center">ไม่มีสิทธิ์เข้าใช้งาน</h2><p class="muted">${esc(e.message)}</p></div>`
    : `<div class="card empty">เกิดข้อผิดพลาด: ${esc(e.message)}<br><br><button class="btn line" onclick="go(S.page)">ลองใหม่</button></div>`;
}

/* ===================== Manage creators ===================== */
const FOLLOWER_RANGES = [['', 'ทั้งหมด'], ['0-1000', 'ต่ำกว่า 1K'], ['1000-10000', '1K – 10K'], ['10000-100000', '10K – 100K'], ['100000-1e12', '100K+']];
async function pageCreators(force) {
  if (!S.cache.creators || force) loading();
  try {
    const d = await load('creators', force);
    const rows = d.rows;
    const tagsAll = [...new Set(rows.flatMap(r => r.tags))].sort();
    const cats = [...new Set(rows.flatMap(r => String(r.categories).split(/[,|]/).map(s => s.trim()).filter(Boolean)))].sort();
    const srcs = [...new Set(rows.map(r => r.source).filter(Boolean))].sort();
    const tab = S.tab.creators || 'all';
    const f = S.filt;
    const opt = (list, cur, all) => `<option value="">${all || 'Select'}</option>` + list.map(x => { const v = Array.isArray(x) ? x[0] : x, t = Array.isArray(x) ? x[1] : x; return `<option value="${esc(v)}" ${String(cur || '') === String(v) && v !== '' ? 'selected' : ''}>${esc(t)}</option>`; }).join('');
    const fld = (label, name, inner) => `<div class="fld"><span>${label}</span><select name="${name}" class="${f[name] ? 'set' : ''}">${inner}</select><span class="chev">⌄</span></div>`;
    app.innerHTML = ph('Manage creators', `<button class="btn" id="upload">${ICON.up} Batch upload</button>`) +
      tabs('creators', [{ k: 'all', t: 'My creators', c: rows.length }, { k: 'pending', t: 'รออนุมัติ', c: rows.filter(r => r.status === 'pending').length }, { k: 'inactive', t: 'ไม่ผ่าน / ระงับ', c: rows.filter(r => r.status === 'rejected' || r.status === 'suspended').length }]) +
      `<div class="card"><div class="filters">
        <div class="fld wide"><span>Creator name</span><input name="q" placeholder="ค้นหาชื่อ หรือ @TikTok" value="${esc(f.q || '')}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#66736F" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></div>
        ${fld('Stage', 'stage', opt(Object.keys(STAGE_TH).filter(k => k !== 'lead' && k !== 'blocked').map(k => [k, STAGE_TH[k]]), f.stage))}
        ${fld('Creator tags', 'tag', opt(tagsAll, f.tag))}
        ${fld('Categories', 'cat', opt(cats, f.cat))}
        ${fld('Followers', 'fol', opt(FOLLOWER_RANGES.slice(1), f.fol))}
        ${fld('Source', 'src', opt(srcs, f.src))}
        ${fld('Campaign', 'prog', opt([...new Set(rows.flatMap(r => r.programs))], f.prog))}
        <div class="frow"><label class="chk"><input type="checkbox" name="nosale" ${f.nosale ? 'checked' : ''}> ยังไม่มียอดขาย</label><label class="chk"><input type="checkbox" name="noprog" ${f.noprog ? 'checked' : ''}> ไม่ได้เข้าร่วมแคมเปญ</label><span class="sp"></span><button class="link ${Object.keys(f).some(k => f[k]) ? '' : 'off'}" id="reset">Reset</button></div>
      </div></div>
      <div class="card"><div class="tools">
        <button class="btn sec" id="btag">${ICON.tag} Batch tag creators</button>
        <button class="btn sec" id="bmsg">${ICON.msg} Batch message</button>
        <button class="btn sec" id="bok">${ICON.ok} อนุมัติ</button>
        <button class="btn sec" id="bmore">${ICON.more}</button>
        <span class="sel" id="selc"></span>
      </div><div id="tbl"></div></div>`;
    const list = () => {
      const q = String(f.q || '').toLowerCase().replace(/^@/, '');
      let out = rows.filter(r =>
        (tab === 'all' || (tab === 'pending' ? r.status === 'pending' : (r.status === 'rejected' || r.status === 'suspended'))) &&
        (!q || r.name.toLowerCase().includes(q) || r.tiktok.includes(q) || r.display_name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)) &&
        (!f.stage || r.stage === f.stage || r.status === f.stage) && (!f.status || r.status === f.status) &&
        (!f.tag || r.tags.indexOf(f.tag) !== -1) && (!f.cat || String(r.categories).includes(f.cat)) && (!f.src || r.source === f.src) &&
        (!f.prog || r.programs.indexOf(f.prog) !== -1) && (!f.nosale || !r.gmv) && (!f.noprog || !r.programs.length) &&
        (!f.fol || (() => { const [a, b] = f.fol.split('-').map(Number); return r.followers >= a && r.followers < b; })()));
      const k = S.sort.k, dir = S.sort.d;
      out.sort((a, b) => (typeof a[k] === 'number' ? a[k] - b[k] : String(a[k]).localeCompare(String(b[k]))) * dir);
      return out;
    };
    const draw = () => {
      const all = list();
      const per = 50, pages = Math.max(1, Math.ceil(all.length / per));
      S.pageNo = Math.min(S.pageNo, pages);
      const view = all.slice((S.pageNo - 1) * per, S.pageNo * per);
      const th = (k, t, r) => `<th class="s ${r ? 'r' : ''} ${S.sort.k === k ? (S.sort.d > 0 ? 'asc' : 'desc') : ''}" data-sort="${k}">${t}</th>`;
      $('#tbl').innerHTML = all.length ? `<div class="twrap"><table class="t"><thead><tr>
          <th class="ck"><input type="checkbox" id="ckall" ${view.length && view.every(r => S.sel.has(r.id)) ? 'checked' : ''}></th>
          ${th('name', 'Creator name')}<th>Tags</th>${th('stage', 'Stage')}${th('followers', 'Followers', 1)}${th('samples', 'Samples', 1)}${th('videos', 'Videos', 1)}${th('gmv_month', 'GMV เดือนนี้', 1)}${th('gmv', 'GMV รวม', 1)}${th('items', 'Items sold', 1)}${th('points', 'แต้ม', 1)}${th('registered_at', 'สมัครเมื่อ')}<th class="act">Action</th>
        </tr></thead><tbody>${view.map(r => `<tr>
          <td class="ck"><input type="checkbox" data-ck="${esc(r.id)}" ${S.sel.has(r.id) ? 'checked' : ''}></td>
          <td><div class="who" data-open="${esc(r.id)}">${av(r.name || r.tiktok)}<div><b>${esc(r.tiktok ? r.tiktok : r.name)}</b><span>${esc(r.name)}${r.programs.length ? ' · 🔥' + r.programs.length : ''}</span></div></div></td>
          <td>${r.tags.length ? r.tags.map(x => `<span class="tag">${esc(x)}</span>`).join('') : '<span class="faint">-</span>'}</td>
          <td>${stageBadge(r.status === 'approved' ? r.stage : r.status)}</td>
          <td class="r num">${fmt(r.followers)}</td>
          <td class="r num"><span class="num-link">${r.samples}</span>${r.samples_open ? `<div class="faint" style="font-size:12px">ค้าง ${r.samples_open}</div>` : ''}</td>
          <td class="r num"><span class="num-link">${r.videos}</span></td>
          <td class="r num">${baht(r.gmv_month)}</td>
          <td class="r num">${baht(r.gmv)}</td>
          <td class="r num">${fmt(r.items)}</td>
          <td class="r num">${fmt(r.points)}</td>
          <td class="muted num">${esc(r.registered_at)}</td>
          <td class="act"><button class="ia" title="ส่งข้อความ LINE" data-msg="${esc(r.id)}" ${r.line ? '' : 'disabled'}>${ICON.msg}</button><button class="ia" title="ติด Tag" data-tag="${esc(r.id)}">${ICON.tag}</button><button class="ia" title="เพิ่มเติม" data-more="${esc(r.id)}">${ICON.more}</button></td>
        </tr>`).join('')}</tbody></table></div>
        <div class="pager">${fmt(all.length)} คน${pages > 1 ? ` · หน้า ${S.pageNo}/${pages} <button class="btn line sm" id="pprev" ${S.pageNo < 2 ? 'disabled' : ''}>‹</button><button class="btn line sm" id="pnext" ${S.pageNo >= pages ? 'disabled' : ''}>›</button>` : ''}</div>`
        : `<div class="empty">${rows.length ? 'ไม่พบ Creator ตามตัวกรอง' : 'ยังไม่มี Creator — ชวนผ่าน LINE OA หรือดูหน้า Leads & prospects'}</div>`;
      $('#selc').textContent = S.sel.size ? `เลือกแล้ว ${S.sel.size} คน` : '';
      const tb = $('#tbl');
      tb.querySelectorAll('[data-sort]').forEach(h => h.addEventListener('click', () => { const k = h.dataset.sort; S.sort = { k, d: S.sort.k === k ? -S.sort.d : -1 }; draw(); }));
      tb.querySelectorAll('[data-ck]').forEach(c => c.addEventListener('change', () => { c.checked ? S.sel.add(c.dataset.ck) : S.sel.delete(c.dataset.ck); $('#selc').textContent = S.sel.size ? `เลือกแล้ว ${S.sel.size} คน` : ''; }));
      const ca = $('#ckall'); if (ca) ca.addEventListener('change', () => { view.forEach(r => ca.checked ? S.sel.add(r.id) : S.sel.delete(r.id)); draw(); });
      tb.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openCreator(b.dataset.open)));
      tb.querySelectorAll('[data-msg]').forEach(b => b.addEventListener('click', () => messageModal([b.dataset.msg])));
      tb.querySelectorAll('[data-tag]').forEach(b => b.addEventListener('click', () => tagModal([b.dataset.tag], tagsAll)));
      tb.querySelectorAll('[data-more]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const r = rows.find(x => x.id === b.dataset.more); popMenu(b, creatorMenu(r)); }));
      const pp = $('#pprev'), pn = $('#pnext');
      if (pp) pp.addEventListener('click', () => { S.pageNo--; draw(); });
      if (pn) pn.addEventListener('click', () => { S.pageNo++; draw(); });
    };
    draw();
    bindTabs('creators', pageCreators);
    let qt;
    app.querySelector('[name=q]').addEventListener('input', e => { clearTimeout(qt); qt = setTimeout(() => { f.q = e.target.value; S.pageNo = 1; draw(); }, 200); });
    app.querySelectorAll('.filters select').forEach(s => s.addEventListener('change', () => { f[s.name] = s.value; s.classList.toggle('set', !!s.value); S.pageNo = 1; draw(); $('#reset').classList.toggle('off', !Object.keys(f).some(k => f[k])); }));
    app.querySelectorAll('.filters input[type=checkbox]').forEach(c => c.addEventListener('change', () => { f[c.name] = c.checked; S.pageNo = 1; draw(); $('#reset').classList.toggle('off', !Object.keys(f).some(k => f[k])); }));
    $('#reset').addEventListener('click', () => { S.filt = {}; pageCreators(); });
    const need = () => { if (!S.sel.size) { toast('เลือก Creator ก่อน (ติ๊กช่องหน้าชื่อ)', true); return false; } return true; };
    $('#btag').addEventListener('click', () => need() && tagModal([...S.sel], tagsAll));
    $('#bmsg').addEventListener('click', () => need() && messageModal([...S.sel]));
    $('#bok').addEventListener('click', () => need() && statusModal([...S.sel], 'approved'));
    $('#bmore').addEventListener('click', e => { e.stopPropagation(); popMenu(e.currentTarget, [
      { t: 'ไม่อนุมัติ (แจ้งผลทาง LINE)', fn: () => need() && statusModal([...S.sel], 'rejected') },
      { t: 'ระงับบัญชี', fn: () => need() && statusModal([...S.sel], 'suspended'), bad: true },
      { t: 'ล้างการเลือก', fn: () => { S.sel.clear(); draw(); } },
    ]); });
    $('#upload').addEventListener('click', uploadModal);
  } catch (e) { fail(e); }
}
function creatorMenu(r) {
  const m = [{ t: 'ดูรายละเอียด', fn: () => openCreator(r.id) }];
  if (r.status !== 'approved') m.push({ t: 'อนุมัติ', fn: () => statusModal([r.id], 'approved') });
  if (r.status === 'pending') m.push({ t: 'ไม่อนุมัติ', fn: () => statusModal([r.id], 'rejected'), bad: true });
  if (r.status === 'approved') m.push({ t: 'ระงับบัญชี', fn: () => statusModal([r.id], 'suspended'), bad: true });
  if (r.tiktok) m.push({ t: 'เปิด TikTok @' + r.tiktok, fn: () => window.open('https://www.tiktok.com/@' + encodeURIComponent(r.tiktok), '_blank') });
  return m;
}
function afterCreatorChange() { invalidate('creators', 'home'); if (S.page === 'creators') pageCreators(true); }

function messageModal(ids) {
  const m = modal('ส่งข้อความ LINE ถึง ' + ids.length + ' คน', `<label class="f">ข้อความ</label><textarea class="in" id="mtext" maxlength="2000" placeholder="เช่น แคมเปญ 11.11 เริ่มแล้ว! เข้าร่วมในเมนู Boost รับค่าคอมเพิ่ม"></textarea><p class="muted" style="margin-bottom:0">ส่งผ่าน LINE OA ทันที (ใช้โควตาข้อความ ${ids.length} ข้อความ)</p>`,
    `<button class="btn line" data-close>ยกเลิก</button><button class="btn" id="msend">ส่งข้อความ</button>`);
  m.querySelector('#msend').addEventListener('click', e => act(e.currentTarget, async () => {
    const r = await call('message', { ids, text: m.querySelector('#mtext').value });
    closeModal(); toast(`ส่งแล้ว ${r.sent}/${r.total} คน`); invalidate('broadcasts');
  }));
}
function tagModal(ids, tagsAll) {
  const m = modal('ติด Tag ' + ids.length + ' คน', `<label class="f">เพิ่ม Tag (คั่นด้วย ,)</label><input class="in" id="tadd" placeholder="เช่น VIP, สายรีวิว, Boost1111">
    ${tagsAll && tagsAll.length ? `<p class="muted" style="margin:10px 0 6px">Tag ที่มีอยู่ (แตะเพื่อเพิ่ม)</p><div class="chips">${tagsAll.map(t => `<span class="chip" data-t="${esc(t)}">${esc(t)}</span>`).join('')}</div>
    <label class="f">เอา Tag ออก</label><select class="in" id="trm"><option value="">-</option>${tagsAll.map(t => `<option>${esc(t)}</option>`).join('')}</select>` : ''}`,
    `<button class="btn line" data-close>ยกเลิก</button><button class="btn" id="tsave">บันทึก</button>`);
  m.querySelectorAll('[data-t]').forEach(c => c.addEventListener('click', () => { const i = m.querySelector('#tadd'); const cur = i.value.split(',').map(s => s.trim()).filter(Boolean); if (cur.indexOf(c.dataset.t) === -1) cur.push(c.dataset.t); i.value = cur.join(', '); }));
  m.querySelector('#tsave').addEventListener('click', e => act(e.currentTarget, async () => {
    const add = m.querySelector('#tadd').value.split(',').map(s => s.trim()).filter(Boolean);
    const rm = m.querySelector('#trm') ? [m.querySelector('#trm').value].filter(Boolean) : [];
    if (!add.length && !rm.length) return toast('ใส่ Tag ก่อน', true);
    await call('tag', { ids, add, remove: rm }); closeModal(); toast('บันทึก Tag แล้ว'); afterCreatorChange();
  }));
}
function statusModal(ids, status) {
  const T = { approved: ['อนุมัติ ' + ids.length + ' คน', 'ระบบจะแจ้งผลทาง LINE พร้อมแต้มต้อนรับ และขั้นตอนเริ่มขายบน TikTok'], rejected: ['ไม่อนุมัติ ' + ids.length + ' คน', 'ระบบจะแจ้งผลทาง LINE (ใส่เหตุผลได้)'], suspended: ['ระงับ ' + ids.length + ' คน', 'ระบบจะแจ้งทาง LINE ว่าบัญชีถูกระงับชั่วคราว'] }[status];
  const m = modal(T[0], `<p class="muted">${T[1]}</p>${status !== 'approved' ? '<label class="f">เหตุผล (แสดงให้ Creator เห็น)</label><input class="in" id="snote">' : ''}`,
    `<button class="btn line" data-close>ยกเลิก</button><button class="btn ${status === 'approved' ? '' : 'danger'}" id="sgo">ยืนยัน</button>`);
  m.querySelector('#sgo').addEventListener('click', e => act(e.currentTarget, async () => {
    const n = m.querySelector('#snote');
    const r = await call('setStatus', { ids, status, note: n ? n.value : '' });
    closeModal(); toast('อัปเดตแล้ว ' + r.updated + ' คน'); S.sel.clear(); afterCreatorChange(); if ($('#drawer').classList.contains('show') && ids.length === 1) openCreator(ids[0]);
  }));
}

async function openCreator(id) {
  const d = openDrawer('<div class="loading"><div class="spin"></div>กำลังโหลด…</div>');
  try {
    const c = await call('creator', { id });
    const p = c.profile;
    const st = s => `<span class="badge ${REQ_CLS[s] || (s === 'approved' ? 'good' : s === 'rejected' ? 'bad' : 'warn')}">${esc(REQ_TH[s] || s)}</span>`;
    d.innerHTML = `<div class="dh">${av(p.name || p.tiktok, 48)}<div class="sp"><b style="font-size:17px">${esc(p.name)}</b><div class="muted">${p.tiktok ? `<a href="https://www.tiktok.com/@${esc(p.tiktok)}" target="_blank">@${esc(p.tiktok)}</a> · ` : ''}${esc(p.id)}</div></div>${stageBadge(p.status === 'approved' ? p.stage : p.status)}<button class="x" data-dclose>×</button></div>
      <div class="db">
        <div class="tools">${p.status !== 'approved' ? '<button class="btn sm" data-st="approved">อนุมัติ</button>' : ''}${p.status === 'pending' ? '<button class="btn danger sm" data-st="rejected">ไม่อนุมัติ</button>' : ''}${p.status === 'approved' ? '<button class="btn danger sm" data-st="suspended">ระงับ</button>' : ''}<button class="btn line sm" id="dmsg">${ICON.msg} ส่งข้อความ</button><button class="btn line sm" id="dtag">${ICON.tag} Tag</button></div>
        <div class="kv">
          <div>ผู้ติดตาม</div><div class="num">${fmt(p.followers)}</div>
          <div>TikTok Shop</div><div>${p.shop === 'selling' ? 'ติดตะกร้าขายอยู่แล้ว' : p.shop === 'new' ? 'ยังไม่เคย / เพิ่งเริ่ม' : esc(p.shop || '-')}</div>
          <div>แนวคอนเทนต์</div><div>${esc(p.categories || '-')}</div>
          <div>ช่องทางอื่น</div><div>${esc(p.other_channels || '-')}</div>
          <div>เบอร์โทร</div><div>${esc(p.phone || '-')}</div>
          <div>ที่อยู่จัดส่ง</div><div>${esc(p.address || '-')}</div>
          <div>แต้ม</div><div class="num">${fmt(p.points)}</div>
          <div>ที่มา</div><div>${esc([p.source, p.campaign && 'แคมเปญ ' + p.campaign, p.referred_by && 'ชวนโดย ' + p.referred_by].filter(Boolean).join(' · ') || '-')}</div>
          <div>สมัคร / อนุมัติ</div><div>${esc(p.registered_at)}${p.approved_at ? ' / ' + esc(p.approved_at) + (p.approved_by ? ' (' + esc(p.approved_by) + ')' : '') : ''}</div>
          <div>Tags</div><div>${p.tags.length ? p.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('') : '-'}</div>
        </div>
        <h3>โน้ตทีม</h3><textarea class="in" id="dnote" style="min-height:70px">${esc(p.note)}</textarea><div style="text-align:right;margin-top:6px"><button class="btn line sm" id="dsave">บันทึกโน้ต</button></div>
        <h3>ยอดขาย TikTok Shop</h3>${c.sales.length ? `<table class="mini"><tr><th>เดือน</th><th style="text-align:right">GMV</th><th style="text-align:right">Items</th></tr>${c.sales.map(s => `<tr><td>${esc(s.period)}</td><td style="text-align:right" class="num">${baht(s.gmv)}</td><td style="text-align:right" class="num">${fmt(s.items)}</td></tr>`).join('')}</table>` : '<p class="muted">ยังไม่มียอดขาย</p>'}
        <h3>สินค้าตัวอย่าง</h3>${c.samples.length ? `<table class="mini"><tr><th>สินค้า</th><th>สถานะ</th><th>พัสดุ</th><th>คลิป</th></tr>${c.samples.map(s => `<tr><td>${esc(s.product)}<div class="faint">${esc(s.requested_at)}</div></td><td>${st(s.status)}</td><td>${esc(s.tracking || '-')}</td><td>${s.content_url ? `<a href="${esc(s.content_url)}" target="_blank">ดูคลิป</a>` : '-'}</td></tr>`).join('')}</table>` : '<p class="muted">ยังไม่เคยขอ</p>'}
        <h3>คลิปภารกิจแคมเปญ</h3>${c.missions.length ? `<table class="mini">${c.missions.map(s => `<tr><td>${esc(s.program)}<div class="faint">${esc(s.date)}</div></td><td><a href="${esc(s.url)}" target="_blank">ดูคลิป</a></td><td>${st(s.status)}</td></tr>`).join('')}</table>` : '<p class="muted">-</p>'}
        <h3>ประวัติแต้ม</h3>${c.activities.length ? `<table class="mini">${c.activities.map(a => `<tr><td>${esc(a.type)}<div class="faint">${esc(a.date)}</div></td><td class="num" style="text-align:right">${a.points > 0 ? '+' : ''}${fmt(a.points)}</td><td>${a.verified ? '' : '<span class="badge warn">รอตรวจ</span>'}</td></tr>`).join('')}</table>` : '<p class="muted">-</p>'}
      </div>`;
    d.querySelectorAll('[data-dclose]').forEach(b => b.addEventListener('click', closeDrawer));
    d.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', () => statusModal([p.id], b.dataset.st)));
    d.querySelector('#dmsg').addEventListener('click', () => messageModal([p.id]));
    d.querySelector('#dtag').addEventListener('click', () => tagModal([p.id], (S.cache.creators ? [...new Set(S.cache.creators.rows.flatMap(r => r.tags))] : [])));
    d.querySelector('#dsave').addEventListener('click', e => act(e.currentTarget, async () => { await call('saveNote', { id: p.id, note: d.querySelector('#dnote').value }); toast('บันทึกโน้ตแล้ว'); }));
  } catch (e) { d.innerHTML = `<div class="dh"><span class="sp"></span><button class="x" data-dclose>×</button></div><div class="db empty">${esc(e.message)}</div>`; d.querySelector('[data-dclose]').addEventListener('click', closeDrawer); }
}
/* ===================== Samples ===================== */
async function pageSamples(force) {
  if (!S.cache.samples || force) loading();
  try {
    const d = await load('samples', force);
    const rows = d.rows;
    const T = [['requested', 'รออนุมัติ'], ['approved', 'รอจัดส่ง'], ['shipped', 'จัดส่งแล้ว'], ['content_submitted', 'ส่งคลิปแล้ว'], ['overdue', 'เลยกำหนดส่งคลิป'], ['done', 'เสร็จ'], ['rejected', 'ปฏิเสธ'], ['all', 'ทั้งหมด']];
    const match = (r, k) => k === 'all' || (k === 'overdue' ? r.overdue : k === 'shipped' ? (r.status === 'shipped' || r.status === 'delivered') : r.status === k);
    const tab = S.tab.samples || 'requested';
    const q = String(S.filt.q || '').toLowerCase();
    const view = rows.filter(r => match(r, tab) && (!q || [r.name, r.tiktok, r.product, r.request_id, r.tracking_no].join(' ').toLowerCase().includes(q)));
    app.innerHTML = ph('Samples') + tabs('samples', T.map(([k, t]) => ({ k, t, c: rows.filter(r => match(r, k)).length }))) +
      `<div class="card"><div class="tools"><div class="fld" style="flex:1;min-width:240px"><span>ค้นหา</span><input id="sq" placeholder="ชื่อ, @TikTok, สินค้า, เลขพัสดุ" value="${esc(S.filt.q || '')}"></div>
        ${tab === 'requested' ? `<button class="btn sec" id="sall">${ICON.ok} อนุมัติที่เลือก</button>` : ''}<span class="sel" id="selc"></span></div>
      ${view.length ? `<div class="twrap"><table class="t"><thead><tr>${tab === 'requested' ? '<th class="ck"><input type="checkbox" id="ckall"></th>' : ''}<th>Creator</th><th>สินค้า</th><th>ขอเมื่อ</th><th>สถานะ</th><th>พัสดุ</th><th>ส่งคลิปภายใน</th><th class="act">Action</th></tr></thead><tbody>
        ${view.map(r => `<tr>${tab === 'requested' ? `<td class="ck"><input type="checkbox" data-ck="${esc(r.request_id)}" ${S.sel.has(r.request_id) ? 'checked' : ''}></td>` : ''}
          <td><div class="who" data-open="${esc(r.id)}">${av(r.name || r.tiktok)}<div><b>${esc(r.tiktok || r.name)}</b><span>${esc(r.name)}</span></div></div></td>
          <td>${esc(r.product)}<div class="faint" style="font-size:12px">${esc(r.sku)} · ${esc(r.request_id)}</div></td>
          <td class="muted num">${esc(r.requested_at)}</td>
          <td><span class="badge ${REQ_CLS[r.status] || ''}">${esc(REQ_TH[r.status] || r.status)}</span>${r.note ? `<div class="faint" style="font-size:12px">${esc(r.note)}</div>` : ''}</td>
          <td>${r.tracking_no ? esc(r.carrier + ' ' + r.tracking_no) : '<span class="faint">-</span>'}${r.shipped_at ? `<div class="faint" style="font-size:12px">ส่ง ${esc(r.shipped_at)}</div>` : ''}</td>
          <td>${r.content_url ? `<a href="${esc(r.content_url)}" target="_blank">ดูคลิป</a>` : r.content_due ? `<span class="${r.overdue ? 'down' : ''}">${esc(r.content_due)}${r.overdue ? ' (เลยกำหนด)' : ''}</span>` : '<span class="faint">-</span>'}</td>
          <td class="act">${sampleActions(r)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ไม่มีรายการ</div>'}</div>`;
    bindTabs('samples', pageSamples);
    let qt; $('#sq').addEventListener('input', e => { clearTimeout(qt); qt = setTimeout(() => { S.filt.q = e.target.value; pageSamples().then(() => { const i = $('#sq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); }, 300); });
    app.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openCreator(b.dataset.open)));
    app.querySelectorAll('[data-sa]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const r = rows.find(x => x.request_id === b.dataset.id); sampleDo(r, b.dataset.sa, b); }));
    app.querySelectorAll('[data-ck]').forEach(c => c.addEventListener('change', () => { c.checked ? S.sel.add(c.dataset.ck) : S.sel.delete(c.dataset.ck); $('#selc').textContent = S.sel.size ? 'เลือก ' + S.sel.size : ''; }));
    const ca = $('#ckall'); if (ca) ca.addEventListener('change', () => { app.querySelectorAll('[data-ck]').forEach(c => { c.checked = ca.checked; ca.checked ? S.sel.add(c.dataset.ck) : S.sel.delete(c.dataset.ck); }); $('#selc').textContent = S.sel.size ? 'เลือก ' + S.sel.size : ''; });
    const sa = $('#sall'); if (sa) sa.addEventListener('click', e => act(e.currentTarget, async () => {
      if (!S.sel.size) return toast('เลือกคำขอก่อน', true);
      for (const id of [...S.sel]) await call('setSample', { request_id: id, status: 'approved' });
      toast('อนุมัติแล้ว ' + S.sel.size + ' รายการ'); S.sel.clear(); invalidate('home'); pageSamples(true);
    }));
  } catch (e) { fail(e); }
}
function sampleActions(r) {
  const b = (k, t, cls) => `<button class="btn ${cls || 'line'} sm" data-sa="${k}" data-id="${esc(r.request_id)}">${t}</button> `;
  if (r.status === 'requested') return b('approve', 'อนุมัติ', ' ') + b('reject', 'ปฏิเสธ', 'danger') + b('addr', 'ที่อยู่');
  if (r.status === 'approved') return b('ship', 'ใส่เลขพัสดุ', ' ') + b('addr', 'ที่อยู่');
  if (r.status === 'shipped') return b('delivered', 'ได้รับของแล้ว') + b('ship', 'แก้เลขพัสดุ');
  if (r.status === 'content_submitted') return `<button class="btn sm" onclick="go('videos',{tab:'pending'})">ตรวจคลิป</button>`;
  return b('addr', 'ที่อยู่');
}
function sampleDo(r, k, btn) {
  const save = async (status, extra) => { await call('setSample', Object.assign({ request_id: r.request_id, status }, extra || {})); invalidate('home', 'creators'); toast('อัปเดตแล้ว — แจ้ง Creator ทาง LINE'); closeModal(); pageSamples(true); };
  if (k === 'approve') return act(btn, () => save('approved'));
  if (k === 'delivered') return act(btn, () => save('delivered'));
  if (k === 'addr') return modal('ที่อยู่จัดส่ง', `<p style="user-select:all;white-space:pre-wrap;background:var(--bg);padding:12px;border-radius:8px">${esc(r.address || '-')}</p><p class="muted">สินค้า: ${esc(r.product)} × ${r.qty}</p>`, '<button class="btn" data-close>ปิด</button>');
  if (k === 'reject') {
    const m = modal('ปฏิเสธคำขอ', `<p class="muted">${esc(r.name)} · ${esc(r.product)}</p><label class="f">เหตุผล (แจ้ง Creator)</label><input class="in" id="rn" placeholder="เช่น สินค้าหมดชั่วคราว">`, '<button class="btn line" data-close>ยกเลิก</button><button class="btn danger" id="go">ปฏิเสธ</button>');
    return m.querySelector('#go').addEventListener('click', e => act(e.currentTarget, () => save('rejected', { note: m.querySelector('#rn').value })));
  }
  if (k === 'ship') {
    const m = modal('จัดส่งสินค้าตัวอย่าง', `<p class="muted">${esc(r.name)} · ${esc(r.product)}</p>
      <label class="f">ขนส่ง</label><select class="in" id="car">${['Kerry Express', 'Flash Express', 'J&T Express', 'ไปรษณีย์ไทย', 'Shopee Express', 'Lalamove', 'อื่นๆ'].map(c => `<option ${c === r.carrier ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <label class="f">เลขพัสดุ</label><input class="in" id="trk" value="${esc(r.tracking_no)}" placeholder="เช่น TH0123456789">
      <p class="muted" style="margin-bottom:0">ระบบจะส่งเลขพัสดุให้ Creator ทาง LINE และนับวันส่งคลิปตามที่ตั้งไว้</p>`,
      '<button class="btn line" data-close>ยกเลิก</button><button class="btn" id="go">บันทึก & แจ้ง Creator</button>');
    return m.querySelector('#go').addEventListener('click', e => act(e.currentTarget, () => {
      const t = m.querySelector('#trk').value.trim(); if (!t) { toast('ใส่เลขพัสดุ', true); return; }
      return save('shipped', { carrier: m.querySelector('#car').value, tracking_no: t });
    }));
  }
}

/* ===================== Creator videos ===================== */
async function pageVideos(force) {
  if (!S.cache.videos || force) loading();
  try {
    const d = await load('videos', force);
    const rows = d.rows;
    const tab = S.tab.videos || 'pending';
    const T = [['pending', 'รอตรวจ'], ['approved', 'ผ่าน'], ['rejected', 'ไม่ผ่าน'], ['all', 'ทั้งหมด']];
    const view = rows.filter(r => tab === 'all' || r.status === tab);
    app.innerHTML = ph('Creator videos') + tabs('videos', T.map(([k, t]) => ({ k, t, c: rows.filter(r => k === 'all' || r.status === k).length }))) +
      (view.length ? `<div class="vgrid">${view.map(v => `<div class="vc">
        <div class="who" data-open="${esc(v.id)}">${av(v.name || v.tiktok, 36)}<div><b>${esc(v.tiktok || v.name)}</b><span>${esc(v.date)}</span></div></div>
        <div><span class="badge ${v.kind === 'mission' ? 'dark' : 'info'}">${v.kind === 'mission' ? 'แคมเปญ' : 'รีวิวสินค้า'}</span> ${esc(v.title)}</div>
        <a class="url" href="${esc(v.url)}" target="_blank">${ICON.ext.replace('<svg', '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"')} ${esc(v.url)}</a>
        <div class="row"><span class="badge ${v.status === 'approved' ? 'good' : v.status === 'rejected' ? 'bad' : 'warn'}">${v.status === 'approved' ? 'ผ่าน' : v.status === 'rejected' ? 'ไม่ผ่าน' : 'รอตรวจ'}</span>${v.points ? `<span class="muted">${fmt(v.points)} แต้ม</span>` : ''}<span class="sp"></span>
        ${v.status === 'pending' ? `<button class="btn danger sm" data-rv="0" data-k="${esc(v.key)}" data-kind="${v.kind}">ไม่ผ่าน</button><button class="btn sm" data-rv="1" data-k="${esc(v.key)}" data-kind="${v.kind}">ผ่าน + ให้แต้ม</button>` : ''}</div>
      </div>`).join('')}</div>` : '<div class="card empty">ไม่มีคลิปในหมวดนี้</div>');
    bindTabs('videos', pageVideos);
    app.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openCreator(b.dataset.open)));
    app.querySelectorAll('[data-rv]').forEach(b => b.addEventListener('click', () => {
      const ok = b.dataset.rv === '1', key = b.dataset.k, kind = b.dataset.kind;
      const send = async reason => { await call(kind === 'mission' ? 'reviewMission' : 'reviewContent', kind === 'mission' ? { submission_id: key, approve: ok, reason } : { request_id: key, approve: ok, reason }); invalidate('home', 'creators', 'samples'); closeModal(); toast(ok ? 'ผ่านแล้ว — เพิ่มแต้มและแจ้ง Creator' : 'แจ้ง Creator ให้ส่งใหม่แล้ว'); pageVideos(true); };
      if (ok) return act(b, () => send(''));
      const m = modal('คลิปไม่ผ่าน', '<label class="f">เหตุผล (แจ้ง Creator ให้แก้แล้วส่งใหม่)</label><input class="in" id="rr" placeholder="เช่น ไม่ได้ติดตะกร้าสินค้า / ไม่ใส่แฮชแท็ก">', '<button class="btn line" data-close>ยกเลิก</button><button class="btn danger" id="go">ยืนยัน</button>');
      m.querySelector('#go').addEventListener('click', e => act(e.currentTarget, () => send(m.querySelector('#rr').value)));
    }));
  } catch (e) { fail(e); }
}

/* ===================== Campaigns ===================== */
const CSTATE = { open: ['กำลังเปิด', 'good'], upcoming: ['ยังไม่เริ่ม', 'info'], ended: ['จบแล้ว', ''], inactive: ['ปิดอยู่', 'bad'] };
async function pageCampaigns(force) {
  if (!S.cache.campaigns || force) loading();
  try {
    const d = await load('campaigns', force);
    app.innerHTML = ph('Campaigns', `<button class="btn" id="cnew">${ICON.plus} สร้างแคมเปญ</button>`) +
      `<p class="muted" style="margin:0 0 16px">แคมเปญที่เปิดอยู่จะแสดงในเมนู Boost / แคมเปญ ของ LINE OA</p>` +
      (d.rows.length ? `<div class="camp">${d.rows.map((c, i) => `<div class="cc" data-c="${i}"><div class="hd ${c.state === 'inactive' ? 'off' : ''}"><span class="badge ${CSTATE[c.state][1]}" style="float:right">${CSTATE[c.state][0]}</span><b>${esc(c.title)}</b><span>${esc(c.program_id)} · ${esc(c.start_date)} – ${esc(c.end_date)} · ค่าคอมเพิ่ม ${esc(c.extra_commission || '-')}</span></div>
        <div class="bd"><div><b>${fmt(c.members)}</b>เข้าร่วม</div><div><b>${fmt(c.videos)}</b>คลิป</div><div><b>${baht(c.gmv).replace('.00', '')}</b>GMV</div><div><b>${fmt(c.completed)}</b>ถึงเป้า</div></div></div>`).join('')}</div>` : '<div class="card empty">ยังไม่มีแคมเปญ</div>');
    app.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => campaignDrawer(d.rows[+b.dataset.c])));
    $('#cnew').addEventListener('click', () => campaignDrawer(null));
  } catch (e) { fail(e); }
}
function campaignDrawer(c) {
  const v = k => esc(c ? c[k] : '');
  const F = (k, t, type, ph) => `<label class="f">${t}</label><input class="in" name="${k}" type="${type || 'text'}" value="${v(k)}" placeholder="${ph || ''}">`;
  const d = openDrawer(`<div class="dh"><div class="sp"><b style="font-size:17px">${c ? esc(c.title) : 'สร้างแคมเปญใหม่'}</b><div class="muted">${c ? esc(c.program_id) : 'แคมเปญจะเปิดให้ Creator เข้าร่วมใน LINE OA'}</div></div><button class="x" data-dclose>×</button></div>
    <div class="db">
      ${c && c.list.length ? `<h3 style="margin-top:0">ผู้เข้าร่วม (${c.list.length})</h3><table class="mini"><tr><th>#</th><th>Creator</th><th style="text-align:right">คลิป</th><th style="text-align:right">GMV</th></tr>${c.list.map((m, i) => `<tr><td>${i + 1}</td><td>${esc(m.tiktok ? '@' + m.tiktok : m.name)}${m.completed ? ' <span class="badge good">ถึงเป้า</span>' : ''}</td><td style="text-align:right">${fmt(m.videos)}</td><td style="text-align:right" class="num">${baht(m.gmv)}</td></tr>`).join('')}</table>` : ''}
      <h3>${c ? 'แก้ไขแคมเปญ' : 'รายละเอียด'}</h3>
      <form id="cf">
        ${c ? '' : F('new_id', 'รหัสแคมเปญ (อังกฤษ/ตัวเลข)', 'text', 'เช่น XMAS2026')}
        ${F('title', 'ชื่อแคมเปญ *', 'text', 'Boost up 12.12')}
        ${F('headline', 'หัวข้อย่อย', 'text', 'เข้าร่วมโปรแกรม รับค่าคอมเพิ่มช่วงแคมเปญ')}
        <div class="grid3">${F('extra_commission', 'ค่าคอมเพิ่ม', 'text', '+5%')}${F('start_date', 'เริ่ม', 'date')}${F('end_date', 'สิ้นสุด', 'date')}</div>
        <div class="grid3">${F('hashtag', 'แฮชแท็กภารกิจ', 'text', '#DentisteBoost')}${F('video_target', 'คลิปเป้าหมาย', 'number')}${F('points_per_video', 'แต้มต่อคลิป', 'number')}</div>
        <div class="grid3">${F('gmv_target', 'เป้ายอดขาย (บาท)', 'number')}${F('gmv_reward_points', 'แต้มเมื่อถึงเป้า', 'number')}${F('reward_note', 'รางวัลเพิ่มเติม', 'text')}</div>
        <label class="f">รายละเอียด / เงื่อนไข</label><textarea class="in" name="details">${v('details')}</textarea>
        <label class="f">ข้อความหลังเข้าร่วม (ส่งทาง LINE)</label><textarea class="in" name="join_message" style="min-height:70px">${v('join_message')}</textarea>
        <label class="chk" style="margin-top:12px"><input type="checkbox" name="active" ${!c || c.active ? 'checked' : ''}> เปิดใช้งาน (แสดงใน LINE OA)</label>
      </form>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px"><button class="btn line" data-dclose>ยกเลิก</button><button class="btn" id="csave">บันทึก</button></div>
    </div>`);
  d.querySelectorAll('[data-dclose]').forEach(b => b.addEventListener('click', closeDrawer));
  d.querySelector('#csave').addEventListener('click', e => act(e.currentTarget, async () => {
    const fd = new FormData(d.querySelector('#cf')); const body = {};
    fd.forEach((val, k) => { body[k] = val; });
    body.active = d.querySelector('[name=active]').checked;
    ['video_target', 'points_per_video', 'gmv_target', 'gmv_reward_points'].forEach(k => { body[k] = body[k] === '' ? '' : Number(body[k]); });
    if (c) body.program_id = c.program_id;
    await call('saveCampaign', body); toast('บันทึกแคมเปญแล้ว'); closeDrawer(); invalidate('broadcasts'); pageCampaigns(true);
  }));
}

/* ===================== Messages ===================== */
async function pageMessages(force) {
  if (!S.cache.broadcasts || force) loading();
  try {
    const d = await load('broadcasts', force);
    const stages = ['lead', 'approved', 'sampled', 'posted', 'active', 'dormant', 'pending'];
    app.innerHTML = ph('Messages') + `<div class="grid2" style="grid-template-columns:minmax(0,5fr) minmax(0,6fr)">
      <div class="card"><h2>ส่ง Broadcast ตามกลุ่ม</h2>
        <label class="f">หัวข้อ (สำหรับทีม)</label><input class="in" id="btitle" placeholder="เช่น แจ้งเปิดแคมเปญ 11.11">
        <label class="f">ข้อความ *</label><textarea class="in" id="bmsg" maxlength="5000" placeholder="พิมพ์ข้อความที่จะส่งทาง LINE OA"></textarea>
        <label class="f">รูปภาพ (URL https .jpg/.png ไม่บังคับ)</label><input class="in" id="bimg" placeholder="https://...">
        <label class="f">กลุ่มเป้าหมาย (Stage) — ไม่เลือก = สมาชิกที่อนุมัติทั้งหมด</label><div class="chips" id="bst">${stages.map(s => `<span class="chip" data-v="${s}">${esc(STAGE_TH[s])}</span>`).join('')}</div>
        <label class="f">เฉพาะผู้เข้าร่วมแคมเปญ</label><div class="chips" id="bpg">${d.programs.map(p => `<span class="chip" data-v="${esc(p.id)}">${esc(p.title)}</span>`).join('') || '<span class="faint">-</span>'}</div>
        <label class="f">เวลาส่ง</label><div class="frow"><label class="chk"><input type="radio" name="when" value="now" checked> ส่งทันที</label><label class="chk"><input type="radio" name="when" value="later"> ตั้งเวลา</label><input class="in" type="datetime-local" id="bat" style="max-width:230px" disabled></div>
        <div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn" id="bsend">${ICON.msg} ส่ง Broadcast</button></div>
        <p class="muted" style="margin-bottom:0;font-size:12.5px">ส่งผ่าน LINE OA ใช้โควตาข้อความตามจำนวนผู้รับ · ข้อความตั้งเวลาจะถูกส่งในรอบชั่วโมงถัดไป</p>
      </div>
      <div class="card"><h2>ประวัติการส่ง</h2>${d.rows.length ? `<div class="twrap"><table class="t" style="min-width:520px"><thead><tr><th>ข้อความ</th><th>กลุ่ม</th><th>สถานะ</th><th class="r">ผู้รับ</th></tr></thead><tbody>${d.rows.slice(0, 80).map(b => `<tr><td><b>${esc(b.title || '')}</b><div class="muted" style="font-size:12.5px;max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(b.message)}</div><div class="faint" style="font-size:12px">${esc(b.sent_at || b.scheduled_at)}</div></td><td style="font-size:12.5px">${esc([b.segment_stage, b.segment_program].filter(Boolean).join(' · ') || (String(b.id).indexOf('DM') === 0 ? 'เลือกรายคน' : 'สมาชิกทั้งหมด'))}</td><td><span class="badge ${b.status === 'sent' ? 'good' : b.status === 'failed' ? 'bad' : 'warn'}">${esc({ sent: 'ส่งแล้ว', scheduled: 'ตั้งเวลา', failed: 'ไม่สำเร็จ', draft: 'ร่าง' }[b.status] || b.status)}</span></td><td class="r num">${fmt(b.sent_count)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ยังไม่เคยส่ง</div>'}</div>
    </div>`;
    app.querySelectorAll('.chips .chip').forEach(c => c.addEventListener('click', () => c.classList.toggle('on')));
    app.querySelectorAll('[name=when]').forEach(r => r.addEventListener('change', () => { $('#bat').disabled = r.value !== 'later' || !r.checked; }));
    $('#bsend').addEventListener('click', e => {
      const msg = $('#bmsg').value.trim(); if (!msg) return toast('พิมพ์ข้อความก่อน', true);
      const later = app.querySelector('[name=when]:checked').value === 'later';
      if (later && !$('#bat').value) return toast('เลือกวันเวลาที่จะส่ง', true);
      const body = { title: $('#btitle').value, message: msg, image_url: $('#bimg').value.trim(), segment_stage: [...app.querySelectorAll('#bst .on')].map(c => c.dataset.v), segment_program: [...app.querySelectorAll('#bpg .on')].map(c => c.dataset.v), send_now: !later, scheduled_at: later ? new Date($('#bat').value).toISOString() : '' };
      const m = modal(later ? 'ยืนยันตั้งเวลาส่ง' : 'ยืนยันส่งทันที', `<p>ส่งถึง: <b>${esc(body.segment_stage.map(s => STAGE_TH[s]).join(', ') || 'สมาชิกที่อนุมัติทั้งหมด')}</b>${body.segment_program.length ? ' ในแคมเปญ ' + esc(body.segment_program.join(', ')) : ''}</p><p style="white-space:pre-wrap;background:var(--bg);padding:12px;border-radius:8px">${esc(msg)}</p>`, '<button class="btn line" data-close>ยกเลิก</button><button class="btn" id="go">ยืนยัน</button>');
      m.querySelector('#go').addEventListener('click', ev => act(ev.currentTarget, async () => { const r = await call('createBroadcast', body); closeModal(); toast(r.status === 'sent' ? 'ส่งแล้ว ' + r.sent_count + ' คน' : 'ตั้งเวลาส่งแล้ว'); pageMessages(true); }));
    });
  } catch (e) { fail(e); }
}

/* ===================== Leads & prospects ===================== */
const PROS_TH = { new: 'ใหม่', contacted: 'ติดต่อแล้ว', registered: 'สมัครแล้ว', ignored: 'ไม่สนใจ' };
async function pageLeads(force) {
  if (!S.cache.leads || force) loading();
  try {
    const d = await load('leads', force);
    const tab = S.tab.leads || 'prospects';
    app.innerHTML = ph('Leads & prospects') + tabs('leads', [{ k: 'prospects', t: 'Creator ขายของเรา แต่ยังไม่สมัคร', c: d.prospects.length }, { k: 'leads', t: 'ผู้ติดตาม LINE OA ที่ยังไม่สมัคร', c: d.leads.length }]) +
      (tab === 'prospects'
        ? `<div class="card"><p class="muted" style="margin-top:0">มาจากรายงาน TikTok Shop ที่นำเข้า — ชวนเข้า Dentiste Affiliate+ เพื่อรับสินค้าตัวอย่างและแคมเปญ</p>${d.prospects.length ? `<div class="twrap"><table class="t"><thead><tr><th>Creator</th><th class="r">ออเดอร์</th><th class="r">GMV</th><th>ขายครั้งแรก / ล่าสุด</th><th>สถานะ</th><th>โน้ต</th></tr></thead><tbody>${d.prospects.map((p, i) => `<tr>
          <td><div class="who" style="cursor:default">${av(p.tiktok, 36)}<div><b><a href="https://www.tiktok.com/@${esc(p.tiktok)}" target="_blank">@${esc(p.tiktok)}</a></b></div></div></td>
          <td class="r num">${fmt(p.orders)}</td><td class="r num">${baht(p.gmv)}</td><td class="muted num">${esc(p.first_seen)} / ${esc(p.last_order)}</td>
          <td><select class="in" style="min-width:130px" data-ps="${i}">${Object.keys(PROS_TH).map(k => `<option value="${k}" ${k === p.status ? 'selected' : ''}>${PROS_TH[k]}</option>`).join('')}</select></td>
          <td><input class="in" data-pn="${i}" value="${esc(p.note)}" placeholder="เช่น ทักแชท TikTok แล้ว"></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ยังไม่มี — นำเข้ารายงานยอดขายจาก TikTok Shop ก่อน</div>'}</div>`
        : `<div class="card">${d.leads.length ? `<div class="twrap"><table class="t"><thead><tr><th>ชื่อ LINE</th><th>ที่มา</th><th>ติดตามเมื่อ</th><th>สถานะ</th><th>ส่งข้อความกระตุ้นล่าสุด</th></tr></thead><tbody>${d.leads.map(l => `<tr><td><div class="who" style="cursor:default">${av(l.name, 36)}<div><b>${esc(l.name || '-')}</b></div></div></td><td>${esc(l.campaign ? 'แคมเปญ ' + l.campaign : l.ref_code ? 'ชวนโดย ' + l.ref_code : l.source || '-')}</td><td class="muted num">${esc(l.followed_at)}</td><td>${stageBadge(l.stage)}</td><td class="muted">${esc(l.nudged_at || '-')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ไม่มี Lead ค้าง</div>'}<p class="muted" style="margin-bottom:0;font-size:12.5px">ส่งข้อความหากลุ่มนี้ได้ที่ Messages → เลือก Stage "Lead"</p></div>`);
    bindTabs('leads', pageLeads);
    const upd = async (i, patch) => { try { await call('setProspect', Object.assign({ tiktok: d.prospects[i].tiktok }, patch)); Object.assign(d.prospects[i], patch); toast('บันทึกแล้ว'); invalidate('home'); } catch (e) { toast(e.message, true); } };
    app.querySelectorAll('[data-ps]').forEach(s => s.addEventListener('change', () => upd(+s.dataset.ps, { status: s.value })));
    app.querySelectorAll('[data-pn]').forEach(s => s.addEventListener('change', () => upd(+s.dataset.pn, { note: s.value })));
  } catch (e) { fail(e); }
}

/* ===================== Batch upload (TikTok export) ===================== */
function uploadModal() {
  const m = modal('Batch upload — รายงานยอดขาย TikTok Shop', `<p class="muted">Export รายงานคำสั่งซื้อ Affiliate จาก TikTok Shop (ไฟล์ .xlsx หรือ .csv) แล้วอัปโหลดที่นี่ ระบบจะจับคู่ @username กับ Creator ไม่นับออเดอร์ซ้ำ และอัปเดต GMV / Leaderboard / Bonus / แคมเปญ</p>
    <input type="file" id="ufile" accept=".csv,.xlsx,.xls" class="in"><p class="muted" id="uinfo" style="margin-bottom:0"></p>`,
    '<button class="btn line" data-close>ยกเลิก</button><button class="btn" id="ugo" disabled>นำเข้า</button>');
  let rows = null;
  m.querySelector('#ufile').addEventListener('change', async e => {
    const file = e.target.files[0]; rows = null; m.querySelector('#ugo').disabled = true;
    if (!file) return;
    try {
      rows = /\.csv$/i.test(file.name) ? parseCsv(await file.text()) : await parseXlsx(file);
      rows = rows.filter(r => r.some(v => String(v).trim() !== ''));
      m.querySelector('#uinfo').textContent = `อ่านได้ ${fmt(rows.length - 1)} แถว · คอลัมน์: ${(rows[0] || []).slice(0, 6).join(' | ')}${(rows[0] || []).length > 6 ? ' …' : ''}`;
      m.querySelector('#ugo').disabled = rows.length < 2;
    } catch (err) { m.querySelector('#uinfo').textContent = 'อ่านไฟล์ไม่ได้: ' + err.message; }
  });
  m.querySelector('#ugo').addEventListener('click', e => act(e.currentTarget, async () => {
    const r = await call('importOrders', { rows });
    closeModal(); S.cache = {};
    modal('นำเข้าเรียบร้อย', `<div class="kv"><div>แถวในไฟล์</div><div>${fmt(r.rows)}</div><div>ออเดอร์ใหม่</div><div>${fmt(r.added)} (ซ้ำ/ข้าม ${fmt(r.skipped)})</div><div>เดือนที่อัปเดต</div><div>${esc((r.periods || []).join(', ') || '-')}</div><div>Creator สมาชิก</div><div>${fmt(r.matched)} คน</div><div>Prospects (ยังไม่สมัคร)</div><div>${fmt(r.prospects)} คน</div><div>ถึงเป้าแคมเปญ</div><div>${fmt(r.rewarded)} คน</div></div>`, '<button class="btn" data-close>ปิด</button>');
    go(S.page, { keep: true });
  }));
}
function parseCsv(text) {
  const out = []; let row = [], cur = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); out.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); out.push(row); }
  return out;
}
function parseXlsx(file) {
  return new Promise((res, rej) => {
    const run = () => file.arrayBuffer().then(buf => {
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      res(XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }));
    }).catch(rej);
    if (window.XLSX) return run();
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = run; s.onerror = () => rej(new Error('โหลดตัวอ่าน Excel ไม่ได้ — ลองบันทึกเป็น .csv')); document.head.appendChild(s);
  });
}

/* ===================== boot ===================== */
const PAGES = { home: pageHome, creators: pageCreators, samples: pageSamples, videos: pageVideos, campaigns: pageCampaigns, messages: pageMessages, leads: pageLeads };
document.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); go(a.dataset.go); }));
$('#burger').addEventListener('click', () => $('#side').classList.toggle('show'));
(async function boot() {
  if (MOCK) { const b = document.createElement('div'); b.className = 'mockbar'; b.textContent = 'โหมดตัวอย่าง (ข้อมูลจำลอง) — ใช้งานจริงผ่านลิงก์ Admin Center ของ Apps Script'; document.body.appendChild(b); }
  try {
    S.boot = await call('boot');
    if (S.boot.home) S.cache.home = S.boot.home;
    $('#mee').textContent = S.boot.me; $('#mei').textContent = S.boot.me.charAt(0).toUpperCase();
    $('#sheetlink').href = $('#sheetlink2').href = S.boot.sheet_url;
    go('home');
  } catch (e) { fail(e); }
})();
/* ===================== mock data (โหมดตัวอย่างเมื่อเปิดไฟล์นอก Apps Script) ===================== */
const MOCKDB = (() => {
  const names = [['montreekotadee7', 'มนตรี โกตาดี', 1, 0, 1, 0, 0, 'approved'], ['pramual_nano', 'ประมวล นาโน', 1, 0, 0, 1022.47, 1, 'approved'], ['preax_5', 'ปรีชา ห้า', 1, 0, 0, 98.10, 1, 'approved'],
    ['banana_shop8', 'Banana shop', 1, 0, 0, 92, 1, 'approved'], ['shopwithpare', 'แพร ชวนช้อป', 1, 1, 1, 0, 0, 'approved'], ['mod.d_520', 'มด ดี', 2, 0, 0, 130.5, 1, 'approved'],
    ['sukumalkangtia', 'สุกุมาล กังเตีย', 1, 0, 0, 128.7, 2, 'approved'], ['nat.review', 'ณัฐวุฒิ ใจดี', 0, 0, 0, 0, 0, 'pending'], ['fernnie.beauty', 'เฟิร์น บิวตี้', 0, 0, 0, 0, 0, 'pending']];
  const stages = ['posted', 'active', 'active', 'active', 'posted', 'active', 'active', 'pending', 'pending'];
  return {
    rows: names.map((n, i) => ({ id: 'AF' + (1001 + i), name: n[1], display_name: n[1], tiktok: n[0], followers: [1200, 8400, 530, 22000, 3100, 760, 15400, 12000, 4100][i],
      categories: ['Beauty', 'Lifestyle', 'Review / Unbox', 'Beauty', 'Lifestyle', 'Food', 'Health & Wellness', 'Review / Unbox', 'Beauty'][i], source: ['LINE OA', 'แคมเปญ tiktok_bio', 'ชวนเพื่อน', 'LINE OA', 'LINE OA', 'แคมเปญ tiktok_bio', 'LINE OA', 'LINE OA', 'ชวนเพื่อน'][i],
      status: n[7], stage: stages[i], tags: i === 1 ? ['VIP'] : i === 3 ? ['ร้านค้า'] : [], points: [150, 250, 50, 50, 200, 50, 50, 0, 0][i], shop: 'selling', province: 'กรุงเทพฯ',
      registered_at: '2026-10-' + String(10 + i).padStart(2, '0'), last_sale: n[5] ? '2026-10-18' : '', samples: n[2], samples_open: n[3], videos: n[4], gmv: n[5], gmv_month: n[5], items: n[6],
      programs: i < 4 ? ['BOOST1111'] : [], line: true })),
  };
})();
function mockApi(action, b) {
  const R = MOCKDB.rows;
  const who = r => ({ id: r.id, name: r.name, tiktok: r.tiktok });
  switch (action) {
    case 'boot': return { me: 'admin@dentiste.example', brand: 'Dentiste Affiliate+', sheet_url: '#', stages: STAGE_TH, home: mockApi('home') };
    case 'home': case 'refresh': return { period: '2026-10', last_period: '2026-09', kpi: { gmv: 1471.77, gmv_last: 980, items: 6, items_last: 4, creators: 7, selling: 5, followers_7d: 23, signups_7d: 4 },
      funnel: [['lead', 14], ['pending', 2], ['approved', 0], ['sampled', 0], ['posted', 2], ['active', 5], ['dormant', 0]].map(x => ({ key: x[0], label: STAGE_TH[x[0]], value: x[1] })),
      todo: { pending_creators: R.filter(r => r.status === 'pending').length, samples_to_approve: 2, samples_to_ship: 1, videos_to_review: 2, prospects_new: 3, content_overdue: 1 },
      top: R.filter(r => r.gmv).sort((a, b) => b.gmv - a.gmv).slice(0, 5).map(r => Object.assign(who(r), { gmv: r.gmv })),
      recent: R.slice(-5).reverse().map(r => Object.assign(who(r), { status: r.status, registered_at: r.registered_at })) };
    case 'creators': return { rows: R, period: '2026-10' };
    case 'creator': { const r = R.find(x => x.id === b.id); return { profile: Object.assign({}, r, { phone: '0812345678', address: '99 ถ.สุขุมวิท กรุงเทพฯ 10110', other_channels: 'IG @' + r.tiktok, ref_code: 'K7Q2MX', referred_by: '', campaign: '', registered_at: r.registered_at, approved_at: r.status === 'approved' ? r.registered_at : '', approved_by: 'admin', note: '' }),
      sales: r.gmv ? [{ period: '2026-10', gmv: r.gmv, items: r.items }] : [], samples: r.samples ? [{ id: 'RQ1', product: 'ยาสีฟัน Dentiste Plus White 100g', status: 'shipped', requested_at: '12 Oct', tracking: 'Flash TH0123', content_url: '' }] : [],
      missions: r.videos ? [{ id: 'MS1', program: 'BOOST1111', url: 'https://www.tiktok.com/@' + r.tiktok + '/video/1', status: 'pending', date: '18 Oct' }] : [], activities: [{ type: 'register', points: 50, verified: true, date: '12 Oct 2026', note: 'สมัครสำเร็จ' }] }; }
    case 'setStatus': b.ids.forEach(id => { R.find(x => x.id === id).status = b.status; }); return { updated: b.ids.length };
    case 'tag': b.ids.forEach(id => { const r = R.find(x => x.id === id); r.tags = r.tags.filter(t => (b.remove || []).indexOf(t) === -1); (b.add || []).forEach(t => { if (r.tags.indexOf(t) === -1) r.tags.push(t); }); }); return { updated: b.ids.length };
    case 'saveNote': return { ok: true };
    case 'message': if (!String(b.text || '').trim()) throw new Error('พิมพ์ข้อความก่อนส่ง'); return { sent: b.ids.length, total: b.ids.length };
    case 'samples': return { rows: [
      Object.assign(who(R[7]), { request_id: 'RQ-261020-A1', sku: 'DT-PW100', product: 'ยาสีฟัน Dentiste Plus White 100g', qty: 1, status: 'requested', requested_at: '20 Oct 2026', carrier: '', tracking_no: '', shipped_at: '', content_due: '', content_url: '', note: '', address: 'ณัฐวุฒิ ใจดี 0812345678 99 ถ.สุขุมวิท กรุงเทพฯ 10110', overdue: false }),
      Object.assign(who(R[1]), { request_id: 'RQ-261019-B2', sku: 'DT-MS250', product: 'สเปรย์ระงับกลิ่นปาก', qty: 1, status: 'requested', requested_at: '19 Oct 2026', carrier: '', tracking_no: '', shipped_at: '', content_due: '', content_url: '', note: '', address: '-', overdue: false }),
      Object.assign(who(R[5]), { request_id: 'RQ-261015-C3', sku: 'DT-PW100', product: 'ยาสีฟัน Dentiste Plus White 100g', qty: 1, status: 'approved', requested_at: '15 Oct 2026', carrier: '', tracking_no: '', shipped_at: '', content_due: '', content_url: '', note: '', address: '-', overdue: false }),
      Object.assign(who(R[0]), { request_id: 'RQ-261010-D4', sku: 'DT-PW100', product: 'ยาสีฟัน Dentiste Plus White 100g', qty: 1, status: 'shipped', requested_at: '10 Oct 2026', carrier: 'Flash Express', tracking_no: 'TH0123456789', shipped_at: '11 Oct', content_due: '18 Oct', content_url: '', note: '', address: '-', overdue: true }),
      Object.assign(who(R[4]), { request_id: 'RQ-261008-E5', sku: 'DT-MS250', product: 'สเปรย์ระงับกลิ่นปาก', qty: 1, status: 'content_submitted', requested_at: '8 Oct 2026', carrier: 'Kerry Express', tracking_no: 'KEX998877', shipped_at: '9 Oct', content_due: '16 Oct', content_url: 'https://www.tiktok.com/@shopwithpare/video/7', note: '', address: '-', overdue: false }),
    ] };
    case 'setSample': return { ok: true };
    case 'videos': return { rows: [
      Object.assign(who(R[4]), { kind: 'content', key: 'RQ-261008-E5', title: 'รีวิวสินค้าตัวอย่าง: สเปรย์ระงับกลิ่นปาก', url: 'https://www.tiktok.com/@shopwithpare/video/7', date: '2026-10-15 20:11', status: 'pending', points: 100 }),
      Object.assign(who(R[0]), { kind: 'mission', key: 'MS-1', title: 'ภารกิจแคมเปญ BOOST1111', url: 'https://www.tiktok.com/@montreekotadee7/video/1', date: '2026-10-18 12:40', status: 'pending', points: 50 }),
      Object.assign(who(R[1]), { kind: 'mission', key: 'MS-0', title: 'ภารกิจแคมเปญ BOOST1111', url: 'https://www.tiktok.com/@pramual_nano/video/9', date: '2026-10-12 09:02', status: 'approved', points: 50 }),
    ] };
    case 'reviewContent': case 'reviewMission': return { ok: true };
    case 'campaigns': return { rows: [
      { program_id: 'BOOST1111', state: 'upcoming', title: 'Boost up 11.11', headline: 'เข้าร่วมโปรแกรม รับค่าคอมเพิ่มช่วงแคมเปญ 11.11', extra_commission: '+5%', start_date: '2026-11-01', end_date: '2026-11-15', details: 'ค่าคอมเพิ่ม +5% สำหรับยอดขายช่วงแคมเปญ', join_message: '', active: true, hashtag: '#DentisteBoost1111', video_target: 3, points_per_video: 50, gmv_target: 10000, gmv_reward_points: 500, reward_note: '+ สิทธิ์ค่าคอมเพิ่มตามเงื่อนไขแคมเปญ',
        members: 4, videos: 2, gmv: 1240.57, completed: 0, list: R.slice(0, 4).map(r => Object.assign(who(r), { videos: r.videos, gmv: r.gmv, joined_at: '20 Oct', completed: false })) },
    ] };
    case 'saveCampaign': return { program_id: b.program_id || 'NEW' };
    case 'broadcasts': return { rows: [{ id: 'BC1', title: 'แจ้งเปิดรับสมัคร Boost 11.11', message: 'แคมเปญ Boost up 11.11 เปิดให้เข้าร่วมแล้ว รับค่าคอมเพิ่ม +5%', segment_stage: 'approved,active', segment_program: '', scheduled_at: '2026-10-20 10:00', status: 'sent', sent_count: 7, sent_at: '2026-10-20 10:02' }], programs: [{ id: 'BOOST1111', title: 'Boost up 11.11' }] };
    case 'createBroadcast': return { id: 'BC2', status: b.send_now ? 'sent' : 'scheduled', sent_count: b.send_now ? 7 : 0 };
    case 'leads': return { leads: [{ name: 'Jane', source: 'follow', campaign: '', ref_code: '', followed_at: '2026-10-19', stage: 'lead', nudged_at: '' }, { name: 'บีม', source: 'follow', campaign: 'tiktok_bio', ref_code: '', followed_at: '2026-10-17', stage: 'lead', nudged_at: '19 Oct' }],
      prospects: [{ tiktok: 'smile.daily', first_seen: '2026-10-02', last_order: '2026-10-18', orders: 6, gmv: 1840, status: 'new', note: '' }, { tiktok: 'mintmint.rv', first_seen: '2026-10-11', last_order: '2026-10-16', orders: 2, gmv: 420, status: 'contacted', note: 'ทักแชทแล้ว' }] };
    case 'setProspect': return { ok: true };
    case 'importOrders': return { rows: b.rows.length - 1, added: b.rows.length - 1, skipped: 0, periods: ['2026-10'], matched: 3, prospects: 1, rewarded: 0 };
  }
  throw new Error('mock: ' + action);
}
