import { projectRef } from "./data.js";
import { annualChart, scoreRangeChart } from "./admission-charts.js";
import {
  admitSeries,
  competitionFields,
  hasCatalog,
  numbers,
  planFields,
  ratioFields,
  scaleFields,
  scoreBins,
  scoreFields,
  sourceKind,
  subjectSeries,
} from "./admission-view.js";

const trainingKeys = [
  "住宿",
  "课程",
  "导师选择",
  "企业实践",
  "实习",
  "毕业要求",
];
const retestKeys = [
  "复试科目",
  "上机可用语言",
  "笔试",
  "综合分公式",
  "复试合格要求",
];
const hasNumber = (row, fields) =>
  fields.some(([key]) => Number.isFinite(row[key]));
const scoreOrder = [
  "cutoff",
  "schoolCutoff",
  "minimum",
  "average",
  "median",
  "maximum",
];
const scoreTrends = scoreOrder.map((key) =>
  scoreFields.find((field) => field[0] === key),
);
const groupedKey = (record) => projectRef(record.id, record.year);
const fmt = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });

export function references(record, role) {
  const { annual = record, admission, training } = record;
  const all = [
    ...(annual.sources || []),
    ...(admission?.sources || []),
    ...(training?.sources || []),
  ];
  const forRole = (list, allowNeutral = true) =>
    (list || []).filter((source) => {
      const kind = sourceKind(source);
      return (
        kind === role ||
        (role === "history" && kind === "scores") ||
        (allowNeutral && !kind)
      );
    });
  if (role === "catalog")
    return [
      ...forRole(annual.sources),
      ...(record.annual || hasNumber(numbers(record), planFields)
        ? all.filter((s) => sourceKind(s) === "retest")
        : []),
    ];
  if (role === "history")
    return [
      ...forRole(admission?.sources),
      ...forRole(annual.sources, !record.annual),
    ];
  if (role === "retest")
    return [
      ...forRole(all, false),
      ...forRole(admission?.sources),
      ...forRole(annual.sources, false),
    ];
  if (role === "training")
    return [...forRole(training?.sources), ...forRole(annual.sources, false)];
  return [];
}

export function isScoreSource(source) {
  return source.kind === "scores" || /分数|成绩|复试名单/.test(source.title);
}

function chartRows(rows) {
  const byYear = new Map(rows.map((row) => [row.year, row]));
  if (!rows.length) return [];
  const min = rows.at(-1).year,
    max = rows[0].year;
  return Array.from(
    { length: max - min + 1 },
    (_, i) => byYear.get(min + i) || { year: min + i },
  );
}

export function createProjectViews({
  esc,
  heading,
  sect,
  facts,
  table,
  opts,
  link,
  sources,
  sectionWith,
  scopeNote,
  compactNotes,
  readable,
  show,
  annualActions,
  projectEmployment,
}) {
  function metricFacts(fields, values) {
    return facts(
      fields.map(([key, label]) => [label, show(values[key], " 人")]),
    );
  }

  function sharedTitle(record) {
    return (
      compactNotes(record.displayScope || record.scope) || "多个方向合并统计"
    );
  }

  function planBody(record) {
    if (!record) return "";
    const metric = numbers(record);
    const subjects = record.annual.subjects
      .map(({ code, name }) => `${code} ${name}`)
      .join("、");
    return (
      facts([
        ["考试组合", record.annual.examCombo],
        ["初试科目", subjects],
      ]) +
      metricFacts(planFields, metric) +
      scopeNote(
        compactNotes(
          record.annual.planScope || record.annual.scope,
          metric.examPlanScope,
        ),
      ) +
      record.sharedGroups
        .filter((group) => hasNumber(numbers(group), planFields))
        .map(
          (group) =>
            `<div class="shared-metrics" data-shared-group="${esc(groupedKey(group))}"><h3>共享招生计划</h3>${scopeNote(sharedTitle(group))}${metricFacts(planFields, numbers(group))}</div>`,
        )
        .join("") +
      sources(
        [record, ...record.sharedGroups].flatMap((r) =>
          references(r, "catalog"),
        ),
        20,
      )
    );
  }

  function timeTable(rows, fields, units, scopeKeys = []) {
    const used = fields.filter(([key]) =>
      rows.some((r) => Number.isFinite(r[key])),
    );
    if (!used.length) return "";
    const read = (r, key) => {
      if (!Number.isFinite(r[key])) return "—";
      const alignment =
        key === "examAdmissions"
          ? "admissionScope"
          : key === "examAttendees"
            ? "attendanceScope"
            : key === "examPlanned"
              ? "examPlanScope"
              : "";
      const note = scopeKeys.includes(alignment) ? r[alignment] : "";
      return (
        esc(fmt.format(r[key])) +
        (note ? ` <small class="metric-scope">${esc(note)}</small>` : "")
      );
    };
    return table(
      [
        "年度",
        ...used.map(([key, label]) =>
          esc(label + (typeof units === "string" ? units : units(key))),
        ),
      ],
      rows
        .filter((r) => hasNumber(r, used))
        .map((r) => [esc(r.year), ...used.map(([key]) => read(r, key))]),
      "history-table",
    );
  }

  function rangeMarkup(rows, title = "录取总分区间") {
    return scoreRangeChart(title, rows.slice().reverse());
  }

  function scoreDistribution(rows) {
    const distributions = rows
      .map((row) => ({
        year: row.year,
        bins: scoreBins(row.record.admission),
      }))
      .filter(({ bins }) => bins.length);
    if (!distributions.length) return "";
    const charts = [];
    const fields = [
      ["interview", "进入复试"],
      ["admitted", "录取"],
    ];
    const comparable = distributions.every(({ bins }) =>
      bins.every((bin) => bin.high - bin.low === 9 && bin.low % 10 === 0),
    );
    if (distributions.length > 1 && comparable) {
      const byScore = new Map();
      for (const { year, bins } of distributions)
        for (const bin of bins) {
          if (!byScore.has(bin.low))
            byScore.set(bin.low, { label: `${bin.low}–${bin.high}` });
          for (const [key] of fields)
            byScore.get(bin.low)[`${year}-${key}`] = bin[key];
        }
      const rows = [...byScore].sort(([a], [b]) => a - b).map(([, row]) => row);
      // Pair the two observed populations by year when both were published.
      for (const [key, label] of fields)
        charts.push(
          annualChart(
            `初试总分 · ${label}人数`,
            "人",
            rows,
            distributions.map(({ year }) => [`${year}-${key}`, `${year} 年`]),
            { bars: true },
          ),
        );
    }
    for (const { year, bins } of distributions) {
      const paired =
        bins.some((bin) => bin.interview != null) &&
        bins.some((bin) => bin.admitted != null);
      if (!comparable || distributions.length === 1 || paired)
        charts.push(
          annualChart(
            `${year} 年初试总分分布`,
            "人",
            bins.map((bin) => ({ ...bin, label: `${bin.low}–${bin.high}` })),
            fields.map(([key, label]) => [key, `${label}人数`]),
            { bars: true },
          ),
        );
    }
    return `<div class="admission-chart-grid">${charts.join("")}</div>`;
  }

  function historicalScale({ rows, group }) {
    const first = rows[0]?.record;
    if (!first) return "";
    const fields = [
      ...scaleFields,
      ...competitionFields.filter(([key]) => key !== "examAdmissions"),
      ...ratioFields,
    ];
    const exact = timeTable(
      rows,
      fields,
      (key) => (key.endsWith("Ratio") ? "（∶1）" : "（人）"),
      ["admissionScope", "examPlanScope", "attendanceScope"],
    );
    if (!exact) return "";
    const chartData = chartRows(rows);
    return (
      (group ? `<h3>共享范围</h3>${scopeNote(sharedTitle(group))}` : "") +
      `<div class="admission-chart-grid">
      ${annualChart("招生规模", "人", chartData, scaleFields, { zero: true })}
      ${annualChart("报考与复试人数", "人", chartData, competitionFields, { bars: true })}
      ${annualChart("录取竞争比值", "∶1", chartData, ratioFields, { zero: true })}
    </div>${exact}`
    );
  }

  function historicalScores({ rows, group }) {
    const exact = timeTable(rows, scoreTrends, "（分）");
    const distribution = scoreDistribution(rows);
    const subjects = [...subjectSeries(rows)]
      .map(([title, series]) => rangeMarkup(series, title))
      .filter(Boolean);
    if (!exact && !distribution && !subjects.length) return "";
    return (
      (group ? `<h3>共享范围</h3>${scopeNote(sharedTitle(group))}` : "") +
      `<div class="admission-chart-grid">
        ${annualChart("复试线与录取成绩", "分", chartRows(rows), scoreTrends)}
        ${rangeMarkup(rows)}
      </div>${exact}${distribution}` +
      (subjects.length
        ? `<details class="record-disclosure"><summary>初试各科成绩区间</summary><div class="admission-chart-grid">${subjects.join("")}</div></details>`
        : "")
    );
  }

  function availableRows(records, range) {
    const latest = records[0]?.year;
    return range === "all"
      ? records
      : records.filter((r) => r.year > latest - Number(range));
  }

  function history(records, range) {
    const selected = availableRows(records, range);
    const series = admitSeries(selected);
    const render = (callback) => series.map(callback).filter(Boolean).join("");
    const scale = render(historicalScale);
    const scores = render(historicalScores);
    const original = series.flatMap(({ rows }) =>
      rows.flatMap(({ record }) => references(record, "history")),
    );
    const plans = series.flatMap(({ rows }) =>
      rows.flatMap(({ record }) => references(record, "catalog")),
    );
    return (
      sectionWith(
        "历年招生规模与报考竞争",
        scale +
          (scale
            ? sources(
                [...original.filter((s) => !isScoreSource(s)), ...plans],
                40,
              )
            : ""),
      ) +
      sectionWith(
        "历年录取成绩与分数分布",
        scores +
          (scores
            ? sources(
                original.filter((s) => !scale || isScoreSource(s)),
                40,
              )
            : ""),
      )
    );
  }

  function policyChanges(records) {
    const previous = new Map();
    const updates = [];
    for (const record of records.slice().reverse()) {
      const { annual, training } = record;
      const subjects = annual.subjects.map(({ code }) => code).join(" / ");
      const fields = [
        ["考试组合", annual.examCombo || subjects],
        ["研究方向", annual.direction],
        [
          "学制",
          training?.durationYears != null ? training.durationYears + " 年" : "",
        ],
        ["招生政策", compactNotes(annual.policyChange)],
      ];
      const changed = [];
      for (const [label, value] of fields) {
        if (!value) continue;
        if (
          label === "招生政策" ||
          (previous.has(label) && previous.get(label) !== value)
        )
          changed.push(`${label} ${value}`);
        previous.set(label, value);
      }
      if (changed.length)
        updates.unshift(
          `<li><time>${record.year}</time> ${esc(changed.join("；"))}</li>`,
        );
    }
    return updates.length
      ? `<details class="record-disclosure"><summary>历年考试与招生政策变化</summary><div><ul class="policy-list">${updates.join("")}</ul></div></details>`
      : "";
  }

  function retestBody(item) {
    const details = item.record.annual?.details || item.record.details || {};
    const text = compactNotes(item.record.admission?.interviewRequirements);
    const body = facts(
      retestKeys.map((key) => {
        const value = readable(details[key]);
        return [key, text.includes(value) ? null : value];
      }),
    );
    return (text ? `<p class="article">${esc(text)}</p>` : "") + body;
  }

  function retest(records) {
    const candidates = records
      .flatMap((r) => [r, ...r.sharedGroups])
      .map((record) => ({
        record,
        direct: references(record, "retest").filter(
          (s) => sourceKind(s) === "retest",
        ),
      }))
      .map((item) => ({ ...item, body: retestBody(item) }))
      .filter((item) => item.direct.length || item.body);
    const newest =
      candidates.find(
        (item) =>
          item.record.admission?.interviewPlanComplete || item.direct.length,
      ) || candidates[0];
    if (!newest) return "";
    const current = newest.record.year;
    const newer = candidates.find(
      (item) => item.record.year > current && item.body,
    );
    const currentUpdate = newer
      ? `<div class="year-policy"><p class="section-year"><time>${newer.record.year}</time> 年目录要求</p>${newer.body}</div>`
      : "";
    const seen = new Set([newest.body]);
    const updates = candidates.filter((item) => {
      if (
        item.record.year >= current ||
        (!item.direct.length && (!item.body || seen.has(item.body)))
      )
        return false;
      seen.add(item.body);
      return true;
    });
    const historical = updates.length
      ? `<details class="record-disclosure"><summary>历年复试安排</summary><div>
      ${updates.map((item) => `<div class="year-policy"><h3>${item.record.year} 年</h3>${item.body === newest.body ? "" : item.body}${sources(item.direct, 10)}</div>`).join("")}
      </div></details>`
      : "";
    return sectionWith(
      "复试要求",
      `${currentUpdate}<p class="section-year"><time>${current}</time> 年方案</p>${newest.body}` +
        sources(
          newest.direct.length
            ? newest.direct
            : references(newest.record, "retest"),
          10,
        ) +
        historical,
    );
  }

  function training(records) {
    const content = (record) => {
      const { annual, training } = record;
      const extra = { ...annual.details, ...training?.details };
      return facts([
        ["学费总额", show(training?.tuitionTotal, " 元")],
        ["年学费", show(training?.tuitionPerYear, " 元/年")],
        ["学制", show(training?.durationYears, " 年")],
        ["培养地点", training?.location],
        ...trainingKeys.map((key) => [key, readable(extra[key])]),
      ]);
    };
    const record =
      records.find((r) => r.training && content(r)) ||
      records.find((r) => content(r));
    return record
      ? sectionWith(
          "培养条件",
          `<p class="section-year"><time>${record.year}</time> 年适用</p>` +
            content(record) +
            sources(references(record, "training"), 10),
        )
      : "";
  }

  function page(project, records, cohort, explicitYear) {
    const latest = records.find(hasCatalog);
    const mostRecent = records[0];
    const pending =
      mostRecent.year >= cohort - 1 &&
      Math.max(mostRecent.year, cohort) > (latest?.year || 0) &&
      project.status !== "excluded";
    const message = pending
      ? scopeNote(`${Math.max(mostRecent.year, cohort)} 年招生信息待确认`)
      : "";
    const years = records.filter(hasCatalog);
    const requested =
      explicitYear &&
      years.find((r) => r.year === project.year && r !== latest);
    const chooser =
      years.length > 1
        ? `<details class="record-disclosure" ${requested ? "open" : ""}>
      <summary>查看其他年度招生目录</summary><div><label>目录年度
      <select id="catalogYear" data-project="${esc(project.id)}">${opts(
        years.filter((r) => r !== latest).map((r) => r.year),
        requested?.year ?? years[1].year,
        null,
      )}</select></label>
      <div id="catalogDocument">${planBody(requested || years[1])}</div></div></details>`
        : "";
    const range =
      records[0].year - records.at(-1).year > 2
        ? `<div class="history-toolbar">
      <label for="historyRange">历史范围</label><select id="historyRange" data-project="${esc(project.id)}">
      <option value="3">近三年</option><option value="5" selected>近五年</option><option value="all">全部年份</option></select></div>`
        : "";
    const historical = history(records, "5");
    return `${heading(project.school.name + " · " + (project.majorLabel || project.major.title), project.college)}
      <div id="projectActions" class="actions">${annualActions(project)}${explicitYear && project.year !== mostRecent.year ? `<span class="section-year">${project.year} 年项目</span>` : ""}</div>
      ${sectionWith(
        "项目基本信息",
        facts([
          ["专业代码", project.majorId],
          ["研究方向", project.direction],
          ["学习方式", project.studyMode],
          ["学位类型", project.degree],
          [
            "报考范围",
            compactNotes(
              project.eligibility?.replace(/[（(][^）)]*待核[^）)]*[）)]/g, ""),
            ),
          ],
        ]),
      )}
      ${sectionWith(
        "最新招生计划及考试科目",
        message +
          (latest
            ? `<p class="section-year"><time>${latest.year}</time> 年招生</p>${planBody(latest)}`
            : "") +
          chooser +
          policyChanges(records),
      )}
      ${historical ? range : ""}<div id="projectHistory">${historical}</div>
      ${retest(records)}${training(records)}${sectionWith("相关就业情况", projectEmployment(project))}
      <div class="actions">${link("school", "院校档案 →", project.schoolId, "button")}${link("major", "专业详情 →", project.majorId, "button")}</div>`;
  }

  return { page, planBody, history };
}
