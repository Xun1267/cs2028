import { projectRef } from "./data.js";
import { annualChart, scoreRangeChart } from "./admission-charts.js";
import {
  admitSeries,
  admissionBreakdownFields,
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
const retestMetrics = [
  ["writtenSubjects", "笔试科目"],
  ["writtenMax", "笔试满分", " 分"],
  ["writtenMinutes", "笔试时长", " 分钟"],
  ["computerTestSubjects", "上机内容"],
  ["computerLanguages", "上机语言"],
  ["computerTestMax", "上机满分", " 分"],
  ["computerTestMinutes", "上机时长", " 分钟"],
  ["writtenComputerPassingScore", "笔试与上机合计合格线", " 分"],
  ["oralMax", "面试满分", " 分"],
  ["interviewPassingScore", "面试合格线", " 分"],
  ["retestMax", "复试满分", " 分"],
  ["retestPassingScore", "复试合格线", " 分"],
  ["totalFormula", "总成绩计算"],
];
const catalogMetrics = [...planFields, ["promotionAdmissions", "实际推免人数"]];
const hasNumber = (row, fields) =>
  fields.some(([key]) => Number.isFinite(row[key]));
const scoreOrder = [
  "cutoff",
  "observedMinimum",
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
  if (role === "catalog") {
    const catalog = forRole(annual.sources);
    const supplemental = hasNumber(numbers(record), planFields) &&
      !catalog.some((s) => sourceKind(s) === "catalog");
    return supplemental
      ? [...catalog, ...all.filter((s) => sourceKind(s) === "retest")]
      : catalog;
  }
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
  return source.kind === "scores" || (!source.kind && /分数|成绩|复试名单/.test(source.title));
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
      .map(({ code, name }) => [code, name].filter(Boolean).join(" "))
      .join("、");
    return (
      facts([
        ["当年学院", record.annual.historicalCollege],
        ["当年专业代码", record.annual.officialMajorCode],
        ["当年专业", record.annual.officialMajorName],
        ["当年研究方向", record.annual.historicalDirection],
        ["考试组合", record.annual.examCombo],
        ["初试科目", subjects],
      ]) +
      metricFacts(catalogMetrics, metric) +
      scopeNote(compactNotes(record.annual.planScope || record.annual.scope)) +
      record.sharedGroups
        .filter((group) => hasNumber(numbers(group), catalogMetrics))
        .map(
          (group) =>
            `<div class="shared-metrics" data-shared-group="${esc(groupedKey(group))}"><h3>共享招生计划</h3>${scopeNote(sharedTitle(group))}${metricFacts(catalogMetrics, numbers(group))}</div>`,
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
          : key === "interviewRatio"
            ? "interviewRatioScope"
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
        .map((r) => {
          const {
            officialMajorCode,
            officialMajorName,
            historicalCollege,
            historicalDirection,
            professionalSubject,
          } = r.annual || r.record?.annual || {};
          const legacyCode =
            officialMajorCode !== r.record?.majorId ? officialMajorCode : null;
          const context = [
            legacyCode,
            legacyCode && officialMajorName,
            historicalCollege,
            historicalDirection,
            professionalSubject &&
              professionalSubject.code + " " + professionalSubject.name,
          ]
            .filter(Boolean)
            .join(" · ");
          return [
            esc(r.year) +
              (r.subject
                ? `<small class="metric-scope">${esc(r.subject)}</small>`
                : "") +
              (context
                ? `<small class="metric-scope">${esc(context)}</small>`
                : ""),
            ...used.map(([key]) => read(r, key)),
          ];
        }),
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
    const first = distributions[0];
    const panel = ({ year, bins }) => {
      const records = bins.map((bin) => ({
        ...bin,
        label: bin.openEnded ? `${bin.low}+` : `${bin.low}–${bin.high}`,
      }));
      const fields = [
        ["interview", "进入复试人数"],
        ["admitted", "录取人数"],
      ];
      const used = fields.filter(([key]) =>
        records.some((r) => Number.isFinite(r[key])),
      );
      const paired = records.some(
        ({ interview, admitted }) => interview > 0 && Number.isFinite(admitted),
      );
      return (
        annualChart(year + " 年初试总分分布", "人", records, used, {
          bars: true,
        }) +
        table(
          [
            "初试分数段",
            ...used.map(([, label]) => label),
            ...(paired ? ["录取比例"] : []),
          ],
          records.map((row) => [
            row.label,
            ...used.map(([key]) => show(row[key])),
            ...(paired
              ? [
                  row.interview > 0 && Number.isFinite(row.admitted)
                    ? fmt.format((row.admitted / row.interview) * 100) + "%"
                    : "—",
                ]
              : []),
          ]),
          "history-table",
        )
      );
    };
    return `<details class="record-disclosure"><summary>分数段录取情况</summary>
      <div data-band-panel>${
        distributions.length > 1
          ? `<label>年度 <select data-band-year>${opts(
              distributions.map(({ year }) => year),
              first.year,
              null,
            )}</select></label>`
          : ""
      }
      <div data-band-content>${panel(first)}</div>
      ${distributions.map((entry) => `<template data-band-template="${entry.year}">${panel(entry)}</template>`).join("")}</div></details>`;
  }

  function seriesHeading({ group, predecessor }) {
    if (group) return `<h3>${esc(sharedTitle(group))}</h3>`;
    if (predecessor)
      return `<h3>${link("project", predecessor.historyScope || "原招生项目", predecessor.id)}</h3>`;
    return "";
  }

  function historicalScale(series) {
    const { rows } = series;
    const first = rows[0]?.record;
    if (!first) return "";
    const fields = [
      ...scaleFields,
      ...competitionFields.filter(([key]) => key !== "examAdmissions"),
      ...admissionBreakdownFields.filter(([key]) =>
        rows.some((row) => row[key] > 0),
      ),
      ...ratioFields,
    ];
    const exact = timeTable(
      rows,
      fields,
      (key) => (key.endsWith("Ratio") ? "（∶1）" : "（人）"),
      ["admissionScope", "interviewRatioScope"],
    );
    if (!exact) return "";
    const chartData = chartRows(rows);
    return (
      seriesHeading(series) +
      `<div class="admission-chart-grid">
      ${annualChart(
        "招生规模",
        "人",
        chartData,
        scaleFields.filter(([key]) => key !== "specialPlanPlanned"),
        { zero: true },
      )}
      ${annualChart("报考与复试人数", "人", chartData, competitionFields, { bars: true })}
      ${annualChart("录取竞争比值", "∶1", chartData, ratioFields, { zero: true })}
    </div>${exact}`
    );
  }

  function historicalScores(series) {
    const { rows } = series;
    const exact = timeTable(rows, scoreTrends, "（分）");
    const distribution = scoreDistribution(rows);
    const stats = scoreTrends
      .filter(([key]) => !["cutoff", "observedMinimum", "schoolCutoff"].includes(key))
      .map(([key, label]) => [key, label.replace("录取", "")]);
    const scoreDetails = (ordered, title) => {
      const partial = ordered.some(({ average, minimum, maximum }) =>
        Number.isFinite(average) && (!Number.isFinite(minimum) || !Number.isFinite(maximum)),
      );
      return rangeMarkup(ordered, title) +
        (partial ? annualChart(title + "均分", "分", chartRows(ordered), [["average", "平均分"]]) : "") +
        timeTable(ordered, stats, "（分）");
    };
    const renderSubjects = (entries) =>
      [...entries].map(([title, scores]) => {
        const ordered = scores.slice().sort((a, b) => b.year - a.year);
        return `<div><h3>${esc(title)}</h3>${scoreDetails(ordered, title)}</div>`;
      }).join("");
    const subjects = renderSubjects(subjectSeries(rows));
    const interviewSubjects = renderSubjects(subjectSeries(rows, true));
    const interview = rows
      .filter((r) => r.record.admission?.interviewScoreStats)
      .map(({ year, record }) => ({
        year,
        ...record.admission.interviewScoreStats,
      }));
    if (!exact && !distribution && !subjects && !interview.length && !interviewSubjects)
      return "";
    return (
      seriesHeading(series) +
      `<div class="admission-chart-grid">
        ${annualChart("复试线与录取成绩", "分", chartRows(rows), scoreTrends)}
        ${rangeMarkup(rows)}
      </div>${exact}${distribution}` +
      (subjects.length
        ? `<details class="record-disclosure"><summary>录取考生初试各科成绩</summary><div class="admission-chart-grid individual-subjects">${subjects}</div></details>`
        : "") +
      (interview.length
        ? `<details class="record-disclosure"><summary>复试考生初试总分</summary><div>${scoreDetails(interview, "复试考生初试总分")}</div></details>`
        : "") +
      (interviewSubjects
        ? `<details class="record-disclosure"><summary>复试考生初试各科成绩</summary><div class="admission-chart-grid individual-subjects">${interviewSubjects}</div></details>`
        : "")
    );
  }

  function history(records, range, predecessors = []) {
    const latest =
      records.find(
        (record) =>
          record.admission || record.sharedGroups.some((g) => g.admission),
      )?.year ?? records[0]?.year;
    const select = (items) =>
      range === "all"
        ? items
        : items.filter((r) => r.year > latest - Number(range));
    const series = [
      ...admitSeries(select(records)),
      ...predecessors.flatMap((items) =>
        items?.length
          ? admitSeries(select(items)).map((set) => ({
              ...set,
              predecessor: items[0],
            }))
          : [],
      ),
    ];
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
                [
                  ...original.filter((s) => !scores || !isScoreSource(s)),
                  ...plans,
                ],
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
    const { interviewRequirements: requirements, cutoffSubjects } = item.record.admission || {};
    const text = typeof requirements === "string" ? compactNotes(requirements) : "";
    const structured = requirements && typeof requirements === "object" ? requirements : {};
    const { initialWeight, interviewMax } = structured;
    const subjects = item.record.annual?.subjects || item.record.subjects || [];
    const body = facts(
      [
        ...retestKeys.map((key) => {
          const value = readable(details[key]);
          return [key, text.includes(value) ? null : value];
        }),
        ...retestMetrics.map(([key, label, unit]) => [
          label,
          unit ? show(structured[key] ?? (key === "oralMax" ? interviewMax : null), unit) : readable(structured[key]),
        ]),
        ["初试权重", Number.isFinite(initialWeight) ? fmt.format(initialWeight * 100) + "%" : ""],
        ["复试单科线", cutoffSubjects?.map((score, i) =>
          `${subjects[i]?.name || ["政治", "外语", "业务课一", "业务课二"][i]} ${score} 分`,
        ).join("、")],
      ],
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
      .filter((item) => item.body || item.direct.length);
    const newest =
      candidates.find(
        (item) =>
          item.record.admission?.interviewPlanComplete || (item.direct.length && item.body),
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
      ]) + sources(references(record, "training"), 10);
    };
    const entries = records.map((record) => ({ year: record.year, body: content(record) }))
      .filter(({ body }) => body);
    const [current, ...previous] = entries;
    return current
      ? sectionWith(
          "培养条件",
          `<p class="section-year"><time>${current.year}</time> 年</p>${current.body}` +
            (previous.length ? `<details class="record-disclosure"><summary>历年学费与学制</summary><div>${previous.map(({ year, body }) =>
              `<div class="year-policy"><h3>${year} 年</h3>${body}</div>`).join("")}</div></details>` : ""),
        )
      : "";
  }

  function page(
    project,
    records,
    cohort,
    explicitYear,
    predecessors = [],
    successors = [],
  ) {
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
    const oldest = Math.min(
      records.at(-1).year,
      ...predecessors.map((items) => items.at(-1).year),
    );
    const defaultRange =
      predecessors.length ||
      records.some(
        (r) =>
          r.annual.officialMajorCode &&
          r.annual.officialMajorCode !== project.majorId,
      )
        ? "all"
        : "5";
    const range =
      records[0].year - oldest > 2
        ? `<div class="history-toolbar"><label for="historyRange">历史范围</label><select id="historyRange" data-project="${esc(project.id)}">
        <option value="3">近三年</option><option value="5" ${defaultRange === "5" ? "selected" : ""}>近五年</option>
        <option value="all" ${defaultRange === "all" ? "selected" : ""}>全部年份</option></select></div>`
        : "";
    const relations = predecessors.length
      ? `<p class="related-links small">${esc(project.historyTransition || "早期招生大类单独列示")}</p>`
      : successors.length
        ? `<p class="related-links small">后续独立招生项目 ${successors.map((next) => link("project", next.majorLabel || next.major.title, next.id)).join(" · ")}</p>`
        : "";
    const historical = history(records, defaultRange, predecessors);
    return `${heading(project.school.name + " · " + (project.majorLabel || project.major.title), project.college, project.schoolId)}
      <div id="projectActions" class="actions">${annualActions(project)}${explicitYear && project.year !== mostRecent.year ? `<span class="section-year">${project.year} 年项目</span>` : ""}</div>
      ${sectionWith(
        "项目基本信息",
        facts([
          ["专业代码", project.annual.officialMajorCode || project.majorId],
          ["研究方向", project.annual.historicalDirection || project.direction],
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
      ${relations}${historical ? range : ""}<div id="projectHistory">${historical}</div>
      ${retest(records)}${training(records)}${sectionWith("相关就业情况", projectEmployment(project))}
      <div class="actions">${link("school", "院校档案 →", project.schoolId, "button")}${link("major", "专业详情 →", project.majorId, "button")}</div>`;
  }

  return { page, planBody, history };
}
