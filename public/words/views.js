import { STORAGE_KEY, emptyData, today, clean, wordKey, validateWord, parseImport, importRows, dueWords, todayStatus, startSession, answer, removeWord, editWord, validateBackup } from './model.mjs';

export function createWordViews({ esc }) {
  let root, tab = 'today', data, raw, error = '', message = '', preview = [], added = [], flipped = false, busy = false, timer, generation = 0, day = today();
  let query = '', selected = new Set(), expanded = new Set(), editing = null;
  const active = () => root?.isConnected && location.hash.startsWith('#words');
  const button = (action, text, disabled = false, extra = '') => `<button type="button" data-word-action="${action}" ${disabled ? 'disabled' : ''} ${extra}>${text}</button>`;
  function load() {
    raw = localStorage.getItem(STORAGE_KEY);
    data = raw === null ? emptyData() : validateBackup(JSON.parse(raw));
  }
  function save(change) {
    // Reject stale writes, including another tab's changes during an animation.
    if (localStorage.getItem(STORAGE_KEY) !== raw) {
      load(); throw new Error('另一页面已更新数据，请重试');
    }
    const next = structuredClone(data || emptyData());
    change(next);
    const value = JSON.stringify(next);
    try { localStorage.setItem(STORAGE_KEY, value); }
    catch { throw new Error('本地保存失败：请检查浏览器存储权限或可用空间'); }
    data = next; raw = value;
  }
  function fail(e) { error = e.message || '操作失败'; draw(); }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `cs2028-words-${today()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function tabs() {
    return `<nav class="word-tabs" aria-label="单词复习页面">${[['today', '今日复习'], ['library', '单词库'], ['import', '导入单词']].map(([id, title]) => `<a href="#words/${id}" ${tab === id ? 'aria-current="page"' : ''}>${title}</a>`).join('')}</nav>`;
  }
  function group(words) {
    const map = new Map();
    for (const w of words) { if (!map.has(w.date)) map.set(w.date, []); map.get(w.date).push(w); }
    return [...map].sort(([a], [b]) => b.localeCompare(a));
  }
  function dashboard() {
    const { pending, completed } = todayStatus(data), newWords = data.words.filter(w => w.date === today());
    const done = new Set(completed.map(w => w.id));
    return `<dl class="prep-metrics"><div><dt>今日待复习</dt><dd class="num">${pending.length}</dd></div><div><dt>今日新词</dt><dd class="num">${newWords.length}</dd></div><div><dt>今日已完成</dt><dd class="num">${completed.length}</dd></div></dl>
      <div class="word-actions">${button('start-due', '开始今日复习', !pending.length)}${button('start-new', '复习今日新词', !newWords.length)}${button('start-all', '全部复习', !data.words.length)}</div>
      <section class="panel"><h2>复习日期</h2>${pending.length || completed.length ? `<ul class="word-date-list">${group([...pending, ...completed]).map(([date, words]) => `<li><time>${date}</time><span>${data.words.filter(w => w.date === date).length} 词</span><span>已完成 ${words.filter(w => done.has(w.id)).length}/${words.length}</span></li>`).join('')}</ul>` : '<p class="word-empty">暂无待复习任务</p>'}</section>`;
  }
  function fields(w, index = '') {
    return `<label>录入日期<input type="date" name="date${index}" value="${esc(w.date)}" required></label><label>英文<input name="english${index}" value="${esc(w.english)}" maxlength="500" required lang="en"></label><label>中文释义<input name="chinese${index}" value="${esc(w.chinese)}" maxlength="5000" required></label>`;
  }
  function library() {
    const filtered = data.words.filter(w => (w.english + '\n' + w.chinese).toLowerCase().includes(query.toLowerCase().trim()));
    return `<div class="word-library-tools"><input id="word-search" type="search" placeholder="搜索英文或中文释义" aria-label="搜索英文或中文释义" value="${esc(query)}">${button('start-dates', `复习所选日期（${selected.size}）`, !selected.size)}</div>
      ${group(filtered).map(([date, words]) => `<section class="word-group"><div class="word-group-head"><label class="word-date-check"><input type="checkbox" data-word-date="${date}" ${selected.has(date) ? 'checked' : ''}><span class="sr-only">选择 ${date}</span></label>${button('expand', `<time>${date}</time><span>${data.words.filter(w => w.date === date).length} 词</span><span aria-hidden="true">${expanded.has(date) ? '−' : '+'}</span>`, false, `data-date="${date}" aria-expanded="${expanded.has(date)}"`)}</div>
      ${expanded.has(date) ? `<ul class="word-list">${words.map(w => `<li>${editing === w.id ? `<form id="word-edit" data-id="${esc(w.id)}" class="word-form">${fields(w)}<div class="word-actions"><button type="submit">保存</button>${button('cancel-edit', '取消')}</div></form>` : `<div class="word-definition"><strong lang="en">${esc(w.english)}</strong><span>${esc(w.chinese)}</span></div><div class="word-actions">${button('edit', '修改', false, `data-id="${esc(w.id)}"`)}${button('delete', '删除', false, `data-id="${esc(w.id)}"`)}</div>`}</li>`).join('')}</ul>` : ''}</section>`).join('') || '<p class="word-empty">暂无单词</p>'}
      <div class="word-backup word-actions">${button('export', '导出完整备份')}<label class="button">恢复备份<input id="word-restore" class="sr-only" type="file" accept=".json,application/json"></label></div>`;
  }
  function previewTable() {
    const seen = new Set(data.words.map(wordKey)); let duplicates = 0;
    const statuses = preview.map(w => { const key = wordKey(w), duplicate = seen.has(key); seen.add(key); if (duplicate) duplicates++; return duplicate; });
    return `<section class="panel"><h2>导入预览</h2><p class="word-preview-count" id="word-preview-count">${preview.length} 词 · 重复 ${duplicates} 词</p><form id="word-confirm"><div class="word-table-wrap"><table class="word-preview"><thead><tr><th>日期</th><th>英文</th><th>中文释义</th><th>状态</th><th></th></tr></thead><tbody>${preview.map((w, i) => `<tr><td><input aria-label="第 ${i + 1} 行日期" type="date" name="date${i}" value="${esc(w.date)}" required></td><td><input aria-label="第 ${i + 1} 行英文" name="english${i}" value="${esc(w.english)}" maxlength="500" required></td><td><input aria-label="第 ${i + 1} 行中文释义" name="chinese${i}" value="${esc(w.chinese)}" maxlength="5000" required></td><td data-preview-status="${i}">${statuses[i] ? '重复，跳过' : '新增'}</td><td>${button('remove-preview', '移除', false, `data-index="${i}"`)}</td></tr>`).join('')}</tbody></table></div><div class="word-actions"><button type="submit">确认保存</button>${button('cancel-preview', '取消')}</div></form></section>`;
  }
  function importer() {
    return `<section class="panel"><h2>手动录入</h2><form id="word-manual" class="word-form">${fields({ date: today(), english: '', chinese: '' })}<div><button type="submit">保存单词</button></div></form></section>
      <section class="panel"><h2>批量导入</h2><form id="word-parse"><textarea id="word-source" rows="7" aria-label="JSON 或普通文本" placeholder="${today()}&#10;英文 | 中文释义"></textarea><div class="word-actions"><button type="submit">预览</button><label class="button">上传 JSON / TXT<input id="word-file" class="sr-only" type="file" accept=".json,.txt,application/json,text/plain" multiple></label></div></form></section>
      ${preview.length ? previewTable() : ''}${added.length ? `<div class="word-actions">${button('start-import', `复习本次新增单词（${added.length}）`)}</div>` : ''}`;
  }
  function flashcard() {
    const s = data.session;
    if (!s?.queue.length) return `<section class="word-finish"><h1>复习完成</h1><p class="num">${s?.done.length || 0} 词 · 已完成</p>${button('finish', '返回今日复习')}</section>`;
    const w = data.words.find(w => w.id === s.queue[0]);
    return `<div class="word-review-head">${button('exit', '退出复习')}<span class="num" role="status">${s.done.length}/${s.ids.length}</span></div><progress class="word-progress" value="${s.done.length}" max="${s.ids.length}" aria-label="复习进度"></progress>
      <div class="word-card-stage"><button type="button" class="word-card${flipped ? ' is-flipped' : ''}" data-word-action="flip" aria-label="${esc(flipped ? w.chinese : w.english)}" aria-pressed="${flipped}"><span class="word-card-inner"><span class="word-card-face word-card-front" lang="en" aria-hidden="${flipped}">${esc(w.english)}</span><span class="word-card-face word-card-back" aria-hidden="${!flipped}">${esc(w.chinese)}</span></span></button></div>
      <div class="word-answer-actions" ${flipped ? '' : 'hidden'}>${button('forget', '不记得')}${button('remember', '记得')}</div>`;
  }
  function draw() {
    if (!active()) return;
    root.className = 'words-page' + (tab === 'review' ? ' word-review' : '');
    document.body.classList.toggle('word-review-active', tab === 'review');
    root.innerHTML = `${tab === 'review' ? '' : '<h1>单词复习</h1>' + tabs()}<div class="word-error" role="alert" ${error ? '' : 'hidden'}>${esc(error)}</div><p class="word-message" role="status" ${message ? '' : 'hidden'}>${esc(message)}</p>${data ? (tab === 'review' ? flashcard() : `${data.session?.queue.length ? `<div class="word-resume">${button('resume', `继续复习（${data.session.done.length}/${data.session.ids.length}）`)}</div>` : ''}${tab === 'library' ? library() : tab === 'import' ? importer() : dashboard()}`) : `<div class="word-actions">${button('reload', '重新读取')}<label class="button">恢复备份<input id="word-restore" class="sr-only" type="file" accept=".json,application/json"></label></div>`}`;
  }
  function goReview(ids, mode) {
    if (data.session?.queue.length && !confirm('开始新一轮复习将替换未完成的队列，是否继续？')) return;
    save(next => startSession(next, ids, mode));
    flipped = false; location.hash = '#words/review';
    if (tab === 'review') draw();
  }
  function switchCard(remembered) {
    if (busy || !flipped || !data.session?.queue.length) return;
    busy = true;
    const token = generation;
    root.querySelector('.word-card-stage')?.classList.add('is-leaving');
    root.querySelectorAll('.word-answer-actions button').forEach(b => b.disabled = true);
    try { save(next => answer(next, remembered)); }
    catch (e) { busy = false; fail(e); return; }
    timer = setTimeout(() => {
      if (generation !== token || !active()) return;
      busy = false; flipped = false; draw();
      root.querySelector('.word-card-stage')?.classList.add('is-entering');
      root.querySelector('.word-card')?.focus({ preventScroll: true });
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
  }
  function flip() {
    if (busy || !data.session?.queue.length) return;
    flipped = !flipped;
    const card = root.querySelector('.word-card');
    card.classList.toggle('is-flipped', flipped);
    card.setAttribute('aria-pressed', String(flipped));
    const w = data.words.find(w => w.id === data.session.queue[0]);
    card.setAttribute('aria-label', flipped ? w.chinese : w.english);
    card.querySelector('.word-card-front').setAttribute('aria-hidden', String(flipped));
    card.querySelector('.word-card-back').setAttribute('aria-hidden', String(!flipped));
    root.querySelector('.word-answer-actions').hidden = !flipped;
  }
  function capturePreview() {
    const form = root.querySelector('#word-confirm');
    if (!form) return;
    const values = new FormData(form);
    preview = preview.map((w, i) => ({ date: values.get('date' + i), english: values.get('english' + i), chinese: values.get('chinese' + i) }));
  }
  async function click(event) {
    const b = event.target.closest('[data-word-action]');
    if (!b || busy) return;
    const action = b.dataset.wordAction;
    if (action === 'flip') { flip(); return; }
    if (action === 'remember' || action === 'forget') { switchCard(action === 'remember'); return; }
    error = ''; message = '';
    try {
      const all = data?.words || [];
      switch (action) {
        case 'reload': load(); break;
        case 'start-due': goReview(dueWords(data).map(w => w.id), 'due'); return;
        case 'start-new': goReview(all.filter(w => w.date === today()).map(w => w.id), 'new'); return;
        case 'start-all': goReview(all.map(w => w.id), 'all'); return;
        case 'start-dates': goReview(all.filter(w => selected.has(w.date)).map(w => w.id), 'dates'); return;
        case 'start-import': goReview(added, 'import'); return;
        case 'resume': flipped = false; location.hash = '#words/review'; return;
        case 'exit': case 'finish': location.hash = '#words/today'; return;
        case 'expand': expanded.has(b.dataset.date) ? expanded.delete(b.dataset.date) : expanded.add(b.dataset.date); break;
        case 'edit': editing = b.dataset.id; break;
        case 'cancel-edit': editing = null; break;
        case 'delete': if (confirm('删除这个单词及其复习记录？')) save(next => removeWord(next, b.dataset.id)); break;
        case 'export': download(); break;
        case 'remove-preview': capturePreview(); preview.splice(Number(b.dataset.index), 1); break;
        case 'cancel-preview': preview = []; break;
      }
      draw();
    } catch (e) { fail(e); }
  }
  function submit(event) {
    const form = event.target;
    if (!form.id.startsWith('word-')) return;
    event.preventDefault(); error = ''; message = '';
    try {
      const f = new FormData(form), word = { date: f.get('date'), english: f.get('english'), chinese: f.get('chinese') };
      if (form.id === 'word-parse') { preview = parseImport(root.querySelector('#word-source').value); }
      if (form.id === 'word-manual' || form.id === 'word-confirm') {
        if (form.id === 'word-confirm') capturePreview();
        const rows = form.id === 'word-manual' ? [validateWord(word)] : preview;
        let result;
        save(next => { result = importRows(next, rows); });
        added = result.added; preview = [];
        message = `已新增 ${added.length} 词，跳过重复 ${result.duplicates} 词`;
      }
      if (form.id === 'word-edit') { save(next => editWord(next, form.dataset.id, word)); editing = null; }
      draw();
    } catch (e) { fail(e); }
  }
  async function change(event) {
    const input = event.target;
    try {
      if (input.dataset.wordDate) { input.checked ? selected.add(input.dataset.wordDate) : selected.delete(input.dataset.wordDate); draw(); }
      if (input.id === 'word-file') {
        const token = generation;
        const rows = [];
        for (const file of input.files) {
          if (file.size > 10 * 1024 * 1024) throw new Error('文件超过 10 MB');
          rows.push(...parseImport(await file.text()));
        }
        if (token !== generation || !active()) return;
        preview = rows; error = ''; message = ''; draw();
      }
      if (input.id === 'word-restore' && input.files[0]) {
        const token = generation;
        const file = input.files[0];
        if (file.size > 20 * 1024 * 1024) throw new Error('备份文件超过 20 MB');
        const restored = validateBackup(JSON.parse(await file.text()));
        if (token !== generation || !active()) return;
        if (confirm(`备份含 ${restored.words.length} 词、${restored.reviews.length} 条复习记录。覆盖当前全部单词和复习进度？`)) {
          save(next => Object.assign(next, restored)); selected.clear(); expanded.clear(); added = []; preview = [];
          error = ''; message = '备份已恢复'; draw();
        }
        input.value = '';
      }
    } catch (e) { fail(e); }
  }
  function input(event) {
    if (event.target.id === 'word-search') {
      const cursor = event.target.selectionStart;
      query = event.target.value; draw();
      const search = root.querySelector('#word-search'); search.focus(); search.setSelectionRange(cursor, cursor);
    }
    if (event.target.closest('#word-confirm')) {
      capturePreview();
      const seen = new Set(data.words.map(wordKey)); let count = 0;
      preview.forEach((w, i) => { const key = wordKey(w), duplicate = seen.has(key); seen.add(key); if (duplicate) count++; root.querySelector(`[data-preview-status="${i}"]`).textContent = duplicate ? '重复，跳过' : '新增'; });
      root.querySelector('#word-preview-count').textContent = `${preview.length} 词 · 重复 ${count} 词`;
    }
  }
  addEventListener('keydown', event => {
    if (!active() || tab !== 'review' || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!['Space', 'ArrowLeft', 'ArrowRight'].includes(event.code)) return;
    event.preventDefault(); if (event.repeat) return;
    if (event.code === 'Space') flip(); else if (flipped) switchCard(event.code === 'ArrowRight');
  });
  addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    if (!active()) return;
    generation++; clearTimeout(timer); busy = false; flipped = false;
    try { load(); error = ''; message = '已读取其他页面的更新'; draw(); } catch { data = null; error = '本地数据无法读取，请检查备份'; draw(); }
  });
  const refreshDay = () => {
    if (today() !== day && active()) { day = today(); if (tab !== 'review') draw(); }
  };
  setInterval(refreshDay, 30000);
  addEventListener('focus', refreshDay);
  return {
    unmount() { generation++; clearTimeout(timer); busy = false; document.body.classList.remove('word-review-active'); root = null; },
    mount(container, value) {
      generation++; clearTimeout(timer); busy = false; flipped = false;
      tab = ['today', 'library', 'import', 'review'].includes(value) ? value : 'today';
      root = document.createElement('div'); container.replaceChildren(root);
      root.addEventListener('click', click); root.addEventListener('submit', submit); root.addEventListener('change', change); root.addEventListener('input', input);
      try { load(); error = ''; if (tab === 'review' && !data.session) tab = 'today'; }
      catch { data = null; error = '本地数据无法读取，原数据已保留'; }
      draw();
    },
  };
}
