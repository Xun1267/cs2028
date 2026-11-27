// Chart marks are generated from reported observations. Missing values leave gaps.
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
const format = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
const precision = (x) => Number(x.toFixed(8));

function scale(values, zero = false) {
  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  const floor = zero ? 0 : Math.max(0, lowest - (highest - lowest || 4) * 0.08);
  const ceil = highest + (highest - lowest || 4) * 0.08;
  const ideal = (ceil - floor) / 4;
  const multiple = 10 ** Math.floor(Math.log10(ideal));
  const step = [1, 2, 2.5, 5, 10]
    .map((n) => n * multiple)
    .find((n) => n >= ideal);
  const min = precision(Math.floor(floor / step) * step);
  const max = precision(Math.ceil(ceil / step) * step);
  const ticks = Array.from(
    { length: Math.round((max - min) / step) + 1 },
    (_, i) => precision(min + i * step),
  );
  return { position: (v) => (v - min) / (max - min), ticks };
}

const mark = (className, text, shape) =>
  `<g class="chart-mark ${className}" tabindex="0" aria-label="${escape(text)}"><title>${escape(text)}</title>${shape}</g>`;

function card(title, unit, width, height, svg, legend) {
  return `<figure class="admission-chart">
    <figcaption><strong>${escape(title)}</strong><span>${escape(unit)}</span></figcaption>
    ${legend ? `<ul class="chart-legend" aria-label="图例">${legend}</ul>` : ""}
    <div class="scroll chart-scroll"><svg viewBox="0 0 ${width} ${height}" style="min-width:${width}px" role="group" aria-label="${escape(title)}">${svg}</svg></div>
  </figure>`;
}

export function annualChart(
  title,
  unit,
  rows,
  fields,
  { bars = false, zero = false } = {},
) {
  const series = fields
    .map(([key, label], i) => ({ key, label, color: `series-${i % 6}` }))
    .filter(({ key }) => rows.some((r) => Number.isFinite(r[key])));
  if (!series.length) return "";
  const { position, ticks } = scale(
    series.flatMap(({ key }) =>
      rows.map((r) => r[key]).filter(Number.isFinite),
    ),
    zero || bars,
  );
  const left = 45,
    top = 17,
    bottom = 150;
  const width = Math.max(300, left + 16 + rows.length * (bars ? 72 : 54));
  const spacing = (width - left - 12) / rows.length;
  const x = (i) => left + spacing * (i + 0.5);
  const y = (v) => bottom - position(v) * (bottom - top);
  const grid = ticks
    .map(
      (tick) =>
        `<path class="chart-grid" d="M${left} ${y(tick)}H${width - 10}"/><text class="axis-number" x="${left - 8}" y="${y(tick)}" text-anchor="end" dominant-baseline="middle">${format.format(tick)}</text>`,
    )
    .join("");
  const labels = rows
    .map(
      ({ label, year }, i) =>
        `<text class="axis-number" x="${x(i)}" y="173" text-anchor="middle">${escape(label ?? year)}</text>`,
    )
    .join("");
  const shapes = series
    .map(({ key, label, color }, s) => {
      const stride = Math.min(16, (spacing * 0.76) / series.length);
      const path = rows
        .map((row, i) => {
          if (!Number.isFinite(row[key])) return "";
          const operator = Number.isFinite(rows[i - 1]?.[key]) ? "L" : "M";
          return `${operator}${x(i)} ${y(row[key])}`;
        })
        .join("");
      return (
        (bars ? "" : `<path class="chart-line ${color}" d="${path}"/>`) +
        rows
          .map((row, i) => {
            const val = row[key];
            if (!Number.isFinite(val)) return "";
            const px = x(i),
              py = y(val);
            const offset = stride * (s - (series.length - 1) / 2);
            const shape = bars
              ? `<rect x="${px + offset - stride * 0.4}" y="${Math.min(py, bottom - 1)}" width="${stride * 0.8}" height="${Math.max(1, bottom - py)}"/>`
              : `<circle cx="${px}" cy="${py}" r="3.4"/><circle class="chart-hit" cx="${px}" cy="${py}" r="9"/>`;
            return mark(
              color,
              `${row.labelDetail ?? row.label ?? row.year} · ${label} ${format.format(val)} ${unit}`,
              shape,
            );
          })
          .join("")
      );
    })
    .join("");
  const legend = series
    .map(
      ({ color, label }) => `<li><i class="${color}"></i>${escape(label)}</li>`,
    )
    .join("");
  return card(
    title,
    unit,
    width,
    186,
    grid +
      labels +
      shapes +
      '<text class="axis-label" x="7" y="13">' +
      escape(unit) +
      "</text>",
    legend,
  );
}

function rangeMode(row) {
  const { minimum, q1, median, q3, maximum, average } = row;
  const box = [minimum, q1, median, q3, maximum];
  if (box.every(Number.isFinite) && box.every((v, i) => !i || box[i - 1] <= v))
    return "box";
  if ([minimum, maximum].every(Number.isFinite) && minimum <= maximum)
    return Number.isFinite(average) && average >= minimum && average <= maximum
      ? "mean"
      : "range";
  return "";
}

export function scoreRangeChart(title, rows, compare = false) {
  const valid = rows.filter(rangeMode);
  if (!valid.length) return "";
  const modes = new Set(valid.map(rangeMode));
  const { position, ticks } = scale(
    valid.flatMap(({ minimum, maximum }) => [minimum, maximum]),
  );
  const left = compare ? 125 : 62,
    right = 20,
    width = compare ? 380 : 310;
  const plotBottom = valid.length * 36 + 15,
    height = plotBottom + 29;
  const x = (v) => left + position(v) * (width - left - right);
  const grid = ticks
    .map(
      (t) =>
        `<path class="chart-grid" d="M${x(t)} 13V${plotBottom}"/><text class="axis-number" x="${x(t)}" y="${height - 6}" text-anchor="middle">${format.format(t)}</text>`,
    )
    .join("");
  const shapes = valid
    .map((r, i) => {
      const py = 35 + i * 36;
      const kind = rangeMode(r);
      const from = x(r.minimum),
        to = x(r.maximum);
      const label = r.label ?? r.year;
      const stats =
        kind === "box"
          ? `最低 ${r.minimum}，第一四分位 ${r.q1}，中位 ${r.median}，第三四分位 ${r.q3}，最高 ${r.maximum}`
          : `最低 ${r.minimum}${kind === "mean" ? `，平均 ${r.average}` : ""}，最高 ${r.maximum}`;
      const ends = `<path class="range-whisker" d="M${from} ${py}H${to}M${from} ${py - 6}v12M${to} ${py - 6}v12"/>`;
      const point =
        kind === "mean"
          ? `<circle cx="${x(r.average)}" cy="${py}" r="4"/>`
          : kind === "box"
            ? `<rect class="range-box" x="${x(r.q1)}" y="${py - 8}" width="${Math.max(1, x(r.q3) - x(r.q1))}" height="16"/><path class="range-mid" d="M${x(r.median)} ${py - 8}v16"/>`
            : "";
      return (
        `<text x="${left - 8}" y="${py}" text-anchor="end" dominant-baseline="middle">${escape(label)}</text>` +
        mark(
          `series-0 range-${kind}`,
          `${label} · ${stats}`,
          ends +
            point +
            `<rect class="chart-hit" x="${left}" y="${py - 11}" height="22" width="${width - left - right}"/>`,
        )
      );
    })
    .join("");
  const legend = [
    modes.has("box")
      ? '<li><i class="legend-box"></i>箱体为中间 50%，竖线为中位数</li>'
      : "",
    modes.has("mean") ? '<li><i class="legend-mean"></i>圆点为平均分</li>' : "",
    '<li><i class="legend-range"></i>端点为最低分和最高分</li>',
  ].join("");
  return card(title, "分", width, height, grid + shapes, legend);
}
