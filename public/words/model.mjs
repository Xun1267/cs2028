export const STORAGE_KEY = 'cs2028-words-v1';
export const INTERVALS = [1, 2, 4, 7, 15, 30];
export const emptyData = () => ({ version: 1, words: [], reviews: [], session: null });
export function today(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(k => parts.find(p => p.type === k).value).join('-');
}
export const validDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
export function addDays(date, days) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export const clean = v => typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
export const wordKey = w => w.date + '\n' + clean(w.english).toLowerCase();
export function validateWord(w) {
  if (!w || !validDate(w.date) || !clean(w.english) || !clean(w.chinese)) throw new Error('请填写有效日期、英文及中文释义');
  if (w.english.length > 500 || w.chinese.length > 5000) throw new Error('单词或释义过长');
  return { date: w.date, english: clean(w.english), chinese: clean(w.chinese) };
}
export function parseImport(source) {
  const text = source.replace(/^\uFEFF/, '').trim();
  if (!text) throw new Error('请输入或上传单词数据');
  let rows = [];
  if (/^[\[{]/.test(text)) {
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error('JSON 格式无效'); }
    const batches = Array.isArray(parsed) ? parsed : [parsed];
    if (!batches.length) throw new Error('没有可导入的单词');
    for (const b of batches) {
      if (!b || !validDate(b.date) || !Array.isArray(b.words)) throw new Error('JSON 需要有效的 date 和 words 数组');
      for (const w of b.words) rows.push(validateWord({ ...w, date: b.date }));
    }
  } else {
    let date;
    for (const [index, raw] of text.split(/\r?\n/).entries()) {
      const line = raw.trim();
      if (!line) continue;
      if (validDate(line)) { date = line; continue; }
      const split = line.indexOf('|');
      if (!date || split < 1) throw new Error(`第 ${index + 1} 行格式无效`);
      rows.push(validateWord({ date, english: line.slice(0, split), chinese: line.slice(split + 1) }));
    }
  }
  if (!rows.length) throw new Error('没有可导入的单词');
  return rows;
}
export function importRows(data, rows, id = () => crypto.randomUUID()) {
  const valid = rows.map(validateWord), seen = new Set(data.words.map(wordKey)), added = [];
  for (const w of valid) {
    const key = wordKey(w);
    if (seen.has(key)) continue;
    seen.add(key);
    const word = { ...w, id: id() };
    data.words.push(word); added.push(word.id);
  }
  return { added, duplicates: rows.length - added.length };
}
export function dueWords(data, day = today()) {
  return data.words.filter(w => INTERVALS.some(n => {
    const due = addDays(w.date, n);
    return due <= day && !data.reviews.some(r => r.wordId === w.id && r.date >= due && r.date <= day);
  }));
}
export function todayStatus(data, day = today()) {
  const pending = dueWords(data, day), ids = new Set(pending.map(w => w.id));
  const completed = data.words.filter(w => !ids.has(w.id) && INTERVALS.some(n => addDays(w.date, n) <= day) && data.reviews.some(r => r.wordId === w.id && r.date === day));
  return { pending, completed };
}
export function startSession(data, ids, mode, random = Math.random) {
  const allowed = new Set(data.words.map(w => w.id));
  const queue = [...new Set(ids)].filter(id => allowed.has(id));
  if (!queue.length) throw new Error('没有可复习的单词');
  for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; }
  data.session = { mode, ids: [...queue], queue, done: [], startedOn: today() };
}
export function answer(data, remembered, day = today()) {
  const s = data.session;
  if (!s?.queue.length) throw new Error('当前没有复习卡片');
  const id = s.queue.shift();
  if (remembered) {
    s.done.push(id);
    if (!data.reviews.some(r => r.wordId === id && r.date === day)) data.reviews.push({ wordId: id, date: day });
  } else s.queue.splice(Math.min(3, s.queue.length), 0, id);
}
export function removeWord(data, id) {
  data.words = data.words.filter(w => w.id !== id);
  data.reviews = data.reviews.filter(r => r.wordId !== id);
  if (data.session) {
    for (const k of ['ids', 'queue', 'done']) data.session[k] = data.session[k].filter(v => v !== id);
    if (!data.session.ids.length) data.session = null;
  }
}
export function editWord(data, id, value) {
  const w = validateWord(value), old = data.words.find(w => w.id === id);
  if (!old) throw new Error('单词已被删除');
  if (data.words.some(x => x.id !== id && wordKey(x) === wordKey(w))) throw new Error('目标日期已有相同单词');
  if (old.date === w.date && old.english === w.english && old.chinese === w.chinese) return;
  // A changed card must be reviewed again, against its current date and meaning.
  data.reviews = data.reviews.filter(r => r.wordId !== id);
  if (data.session?.ids.includes(id)) data.session = null;
  Object.assign(old, w);
}
export function validateBackup(input) {
  if (!input || input.version !== 1 || !Array.isArray(input.words) || !Array.isArray(input.reviews) || !Object.hasOwn(input, 'session')) throw new Error('备份格式或版本无效');
  const data = emptyData(), ids = new Set(), keys = new Set();
  for (const w of input.words) {
    const value = validateWord(w);
    if (typeof w.id !== 'string' || !w.id || ids.has(w.id) || keys.has(wordKey(value))) throw new Error('备份存在重复单词或无效 ID');
    ids.add(w.id); keys.add(wordKey(value)); data.words.push({ ...value, id: w.id });
  }
  const reviewKeys = new Set();
  for (const r of input.reviews) {
    const key = r?.wordId + '\n' + r?.date;
    if (!r || !ids.has(r.wordId) || !validDate(r.date) || reviewKeys.has(key)) throw new Error('备份复习记录无效');
    reviewKeys.add(key); data.reviews.push({ wordId: r.wordId, date: r.date });
  }
  if (input.session !== null) {
    const s = input.session;
    if (!s || !['due', 'new', 'dates', 'all', 'import'].includes(s.mode) || !validDate(s.startedOn)) throw new Error('备份复习进度无效');
    for (const k of ['ids', 'queue', 'done']) if (!Array.isArray(s[k]) || new Set(s[k]).size !== s[k].length || !s[k].every(id => ids.has(id))) throw new Error('备份队列无效');
    if (!s.ids.length || s.queue.length + s.done.length !== s.ids.length || new Set([...s.queue, ...s.done]).size !== s.ids.length || ![...s.queue, ...s.done].every(id => s.ids.includes(id))) throw new Error('备份进度不一致');
    data.session = { mode: s.mode, startedOn: s.startedOn, ids: [...s.ids], queue: [...s.queue], done: [...s.done] };
  }
  return data;
}
