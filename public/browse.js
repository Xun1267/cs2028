export function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const id = key(item);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(item);
  }
  return groups;
}

export function byLatest(records) {
  return [...groupBy(records, (record) => record.id).values()].map((records) =>
    [...records].sort((a, b) => b.year - a.year),
  );
}

export function projectTree(records) {
  return [...groupBy(records, (record) => record.college)].map(
    ([college, rows]) => ({
      college,
      majors: [...groupBy(rows, (record) => record.majorId)].map(
        ([id, items]) => ({
          id,
          title: items[0].major.title,
          projects: byLatest(items),
        }),
      ),
    }),
  );
}

export function containsWords(text, query) {
  return query.split(/\s+/).every((word) => text.includes(word));
}
