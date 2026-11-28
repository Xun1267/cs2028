import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, today, addDays, parseImport, importRows, dueWords, todayStatus, startSession, answer, validateBackup, editWord, removeWord, removeWords, wordGroups, selectionState } from '../public/words/model.mjs';

let serial = 0;
const add = (data, rows) => importRows(data, rows, () => `test-${++serial}`);
const word = (english, date = '2026-11-01') => ({ date, english, chinese: '测试释义' });

test('Beijing calendar and month/year boundaries', () => {
  assert.equal(today(new Date('2026-11-28T16:00:00Z')), '2026-11-29');
  assert.equal(today(new Date('2026-11-28T15:59:59Z')), '2026-11-28');
  assert.deepEqual([1,2,4,7,15,30].map(n => addDays('2026-11-01', n)), ['2026-11-02','2026-11-03','2026-11-05','2026-11-08','2026-11-16','2026-12-01']);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 2), '2028-03-01');
});
test('JSON/text parsing, cleaning, multiple sheets, invalid input', () => {
  const json = JSON.stringify([{ date:'2026-11-01', words:[word('  account   for ')] }, { date:'2026-11-02', words:[word('attribute')] }]);
  assert.equal(parseImport(json)[0].english, 'account for');
  assert.equal(parseImport('\uFEFF2026-11-01\r\n\r\n account for | 解释 \r\n2026-11-02\nattribute | 属性').length, 2);
  for (const source of ['', '{}', '{broken', '2026-02-30\nword | 释义', '2026-11-01\nword', '2026-11-01\nword | ', '{"date":"2026-11-01","words":[null]}']) assert.throws(() => parseImport(source));
});
test('merge imports skip normalized duplicates only on the same date', () => {
  const d = emptyData();
  add(d, [word('Account for')]);
  const result = add(d, [word(' account  FOR '), word('new'), word('account for', '2026-11-02')]);
  assert.equal(result.duplicates, 1); assert.equal(d.words.length, 3);
  assert.throws(() => add(d, [word('valid'), { ...word('invalid'), chinese:'' }]));
  assert.equal(d.words.length, 3);
});
test('overdue tasks merge by word and manual completion clears only past due dates', () => {
  const d = emptyData(); add(d, [word('a'), word('b', '2026-10-30')]);
  assert.equal(dueWords(d, '2026-11-01').length, 1);
  assert.equal(dueWords(d, '2026-11-08').length, 2);
  startSession(d, d.words.map(w => w.id), 'dates');
  answer(d, true, '2026-11-08'); answer(d, true, '2026-11-08');
  assert.equal(dueWords(d, '2026-11-08').length, 0);
  assert.equal(todayStatus(d, '2026-11-08').completed.length, 2);
  assert.equal(dueWords(d, '2026-11-14').length, 1);
  assert.equal(dueWords(d, '2026-11-16').length, 2);
});
test('new-word manual completion does not clear future scheduled review', () => {
  const d = emptyData(); add(d, [word('a')]); startSession(d, [d.words[0].id], 'new'); answer(d, true, '2026-11-01');
  assert.equal(dueWords(d, '2026-11-02').length, 1);
});
test('forgotten cards return after three others, short queues and one card work', () => {
  const d = emptyData(); add(d, ['a','b','c','d','e'].map(w => word(w)));
  startSession(d, d.words.map(w => w.id), 'all');
  const id = d.session.queue[0]; answer(d, false);
  assert.equal(d.session.queue.indexOf(id), 3);
  for (let i=0; i<3; i++) answer(d, true);
  assert.equal(d.session.queue[0], id); assert.equal(d.session.done.length, 3);
  answer(d, true); answer(d, true); assert.equal(d.session.done.length, 5);
  startSession(d, d.words.slice(0,2).map(w => w.id), 'all');
  const short = d.session.queue[0]; answer(d, false); answer(d, true);
  assert.equal(d.session.queue[0], short); answer(d, false);
  assert.equal(d.session.queue[0], short); assert.equal(d.session.done.length, 1);
});
test('full backup restores exact queue, completed IDs and records; rejects corruption', () => {
  const d = emptyData(); add(d, ['a','b','c','d','e'].map(w => word(w)));
  startSession(d, d.words.map(w => w.id), 'all'); answer(d, true); answer(d, false);
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(d))), d);
  for (const mutation of [x => x.version=2, x => x.session.queue.push(x.session.queue[0]), x => x.session.done.push('missing'), x => x.reviews[0].date='bad', x => x.words.push(x.words[0])]) {
    const copy = structuredClone(d); mutation(copy); assert.throws(() => validateBackup(copy));
  }
});
test('editing rejects collisions; moving dates resets old review; deletion reconciles progress', () => {
  const d = emptyData(); add(d, [word('a'), word('b')]); const id = d.words[0].id;
  startSession(d, [id], 'all'); answer(d, true);
  assert.throws(() => editWord(d, id, word('b')));
  editWord(d, id, word('a', '2026-12-31'));
  assert.equal(d.reviews.length, 0); assert.equal(d.session, null);
  startSession(d, d.words.map(w => w.id), 'all'); removeWord(d, id);
  assert.equal(d.session.ids.length, 1); assert.deepEqual(validateBackup(d), d);
});


test('year/month/day groups are descending, count all words and support three selection states', () => {
  const d = emptyData();
  add(d, [word('a', '2025-12-31'), word('b', '2026-11-28'), word('c', '2026-11-27'), word('d', '2026-10-01'), word('e', '2026-11-28')]);
  const groups = wordGroups(d.words);
  assert.deepEqual(groups.map(g => g.key), ['2026', '2025']);
  assert.equal(groups[0].words.length, 4);
  assert.deepEqual(groups[0].children.map(g => g.key), ['2026-11', '2026-10']);
  const month = groups[0].children[0];
  assert.deepEqual(month.children.map(g => g.key), ['2026-11-28', '2026-11-27']);
  assert.equal(month.children[0].words.length, 2);
  const selected = new Set();
  assert.deepEqual(selectionState(month.words, selected), { checked: false, partial: false });
  selected.add(month.words[0].id);
  assert.deepEqual(selectionState(month.words, selected), { checked: false, partial: true });
  month.words.forEach(w => selected.add(w.id));
  assert.deepEqual(selectionState(month.words, selected), { checked: true, partial: false });
  assert.deepEqual(selectionState(groups[0].words, selected), { checked: false, partial: true });
});
test('bulk deletion uses IDs, preserves same English on other dates, cleans reviews and session', () => {
  const d = emptyData();
  add(d, [word('same', '2025-12-31'), word('same', '2026-11-28'), word('b', '2026-11-27'), word('c', '2026-10-01')]);
  const ids = d.words.map(w => w.id);
  startSession(d, ids, 'all');
  const done = d.session.queue[0]; answer(d, true, '2026-11-28');
  d.reviews.push({ wordId: ids[0], date: '2026-11-27' });
  const remove = new Set([ids[0], done]);
  removeWords(d, [...remove]);
  assert.ok(d.words.every(w => !remove.has(w.id)));
  assert.ok(d.reviews.every(r => !remove.has(r.wordId)));
  for (const key of ['ids', 'queue', 'done']) assert.ok(d.session[key].every(id => !remove.has(id)));
  if (!remove.has(ids[1])) assert.ok(d.words.some(w => w.id === ids[1] && w.english === 'same'));
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(d))), d);
  removeWords(d, d.words.map(w => w.id));
  assert.deepEqual(d, emptyData());
  assert.deepEqual(wordGroups(d.words), []);
});
