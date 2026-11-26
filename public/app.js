import { scoreRangeChart } from "./admission-charts.js";
import {
  hasCatalog,
  numbers,
  planFields,
  scaleFields,
  competitionFields,
  ratioFields,
  scoreFields,
} from "./admission-view.js";
import {
  createProjectViews,
  references,
  isScoreSource,
} from "./project-page.js";
import { byLatest, containsWords, groupBy, projectTree } from "./browse.js";
import { createInsights } from "./insights.js";
import {
  cancelPageEntrance,
  playPageEntrance,
  revealUpdate,
} from "./motion.js";
import {
  admissionRecords,
  latestDataDate,
  loadPublicData,
  projectRef,
} from "./data.js";
const $ = (s) => document.querySelector(s),
  main = $("#main"),
  pageContent = $("#page-content");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const nav = [
  ["home", "首页", "M3 10l9-7 9 7v10h-6v-7H9v7H3z"],
  ["guide", "考研概况", "M3 5q5-2 9 1 4-3 9-1v14q-5-2-9 1-4-3-9-1z M12 6v14"],
  ["majors", "专业探索", "M12 3l10 5-10 5L2 8z M6 10v6q6 5 12 0v-6"],
  [
    "schools",
    "院校数据库",
    "M2 9l10-6 10 6z M4 20h16 M6 11v6 M12 11v6 M18 11v6",
  ],
  ["compare", "院校对比", "M4 4v16h16 M8 16V9 M13 16V5 M18 16v-5"],
  ["jobs", "就业发展", "M3 8h18v12H3z M8 8V5h8v3 M3 12q9 5 18 0"],
  ["news", "招生动态", "M3 4h15v16H3z M18 8h3v12h-3 M6 8h8 M6 12h8 M6 16h6"],
  ["decide", "择校决策", "M4 6h16 M4 12h16 M4 18h16 M8 3v6 M15 9v6 M9 15v6"],
  ["saved", "我的收藏", "M6 3h12v18l-6-4-6 4z"],
  [
    "data",
    "数据管理",
    "M3 6c0-5 18-5 18 0s-18 5-18 0v12c0 5 18 5 18 0V6 M3 12c0 5 18 5 18 0",
  ],
];
const icon = (d) =>
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="' +
  d +
  '"/></svg>';
const route = (p = "home", arg = "") =>
  "#" + p + (arg ? "/" + encodeURIComponent(arg) : "");
const link = (p, label, arg = "", cl = "") =>
  '<a class="' + cl + '" href="' + route(p, arg) + '">' + esc(label) + "</a>";
function out(url, title) {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return esc(title);
  return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)} ↗</a>`;
}
const label = (p) => nav.find((r) => r[0] === p)?.[1];
const read = () => {
  try {
    return JSON.parse(localStorage.getItem("cs2028-v1")) || {};
  } catch {
    return {};
  }
};
const defaultFilters = {
  q: "",
  city: "",
  combo: "",
  year: "",
  sort: "",
  major: "",
};
const pageSize = 20;
const browserStateKey = "cs2028-browser-v2";
function readBrowserState() {
  try {
    return JSON.parse(sessionStorage.getItem(browserStateKey)) || {};
  } catch {
    return {};
  }
}
const browserState = readBrowserState();
browserState.directoryEntries ||= {};
let state = { fav: [], comp: [], plans: [], notes: {}, city: "", ...read() };
let schools,
  projects,
  latestProjects,
  news,
  trends,
  majors,
  careers,
  topics,
  updatedAt,
  page,
  arg;
let projectHistory, schoolById, majorById, careerById, careerByMajor;
let filters = { ...defaultFilters, ...browserState.filters };
let listPage = browserState.listPage || 1;
let projectById,
  projectsBySchool,
  allBySchool,
  indexedSchools,
  indexedProjects,
  searchIndex;
let cities, years, research, researchById, dataInsights;
let combos;
const collator = new Intl.Collator("zh-CN");

function storeBrowserState() {
  if (page === "schools" && activeEntry) {
    browserState.directoryEntries[activeEntry] = {
      filters: { ...filters },
      listPage,
    };
  }
  try {
    sessionStorage.setItem(
      browserStateKey,
      JSON.stringify({ ...browserState, filters, listPage }),
    );
  } catch {
    // Browsing still works when session storage is unavailable.
  }
}

function normalizeQuery(value) {
  return String(value).trim().toLowerCase();
}

function indexData(data) {
  schools = data.schools;
  majors = data.majors;
  careers = data.careers;
  topics = data.knowledge;
  research = data.research;
  researchById = new Map(research.map((row) => [row.id, row]));
  dataInsights = createInsights(data, {
    esc,
    heading,
    sect,
    table,
    facts,
    sources,
    out,
    link,
    empty,
    grid,
    show,
  });
  news = [...data.news].sort(
    (a, b) =>
      (b.date || "").localeCompare(a.date || "") ||
      (b.year || 0) - (a.year || 0),
  );
  trends = {
    ...data.national,
    series: [...data.national.series].sort((a, b) => a.year - b.year),
  };
  updatedAt = latestDataDate(data);
  const records = admissionRecords(data);
  projects = records.all;
  latestProjects = records.latest;
  projectById = records.byRef;
  projectHistory = records.historyByProject;
  schoolById = new Map(schools.map((school) => [school.id, school]));
  majorById = new Map(majors.map((major) => [major.id, major]));
  careerById = new Map(careers.map((career) => [career.id, career]));
  careerByMajor = new Map(careers.map((career) => [career.id, []]));
  for (const major of majors) {
    for (const careerId of major.careerIds)
      careerByMajor.get(careerId)?.push(major);
  }
  projectsBySchool = new Map();
  for (const project of latestProjects) {
    if (!projectsBySchool.has(project.schoolId))
      projectsBySchool.set(project.schoolId, []);
    projectsBySchool.get(project.schoolId).push(project);
  }
  cities = [
    ...new Set(
      [...schools, ...projects].map(({ city }) => city).filter(Boolean),
    ),
  ];
  years = [
    ...new Set(
      projects
        .map(({ year }) => String(year))
        .concat(String(trends.target.year)),
    ),
  ]
    .sort()
    .reverse();
  combos = [
    ...new Set([
      "11408",
      "12408",
      "21408",
      "22408",
      ...projects.map((p) => p.annual.examCombo).filter(Boolean),
    ]),
  ].sort();
  allBySchool = groupBy(projects, (project) => project.schoolId);
  indexedSchools = schools.map((record) => ({
    record,
    text: normalizeQuery(
      [record.name, record.city, record.province, ...record.aliases].join(" "),
    ),
  }));
  indexedProjects = projects.map((record) => ({
    record,
    text: normalizeQuery(projectTerms(record).join(" ")),
  }));
  searchIndex = searchRows().map((row) => ({
    row,
    text: normalizeQuery([row[2], row[3]].filter(Boolean).join(" ")),
  }));
}
function projectTerms(record) {
  return [
    record.school.name,
    ...record.school.aliases,
    record.college,
    record.major.id,
    record.major.title,
    record.majorLabel,
    record.training?.location,
    record.city,
    record.school.province,
    record.annual.examCombo,
    record.direction,
    record.year,
  ];
}

function notify(s) {
  const display = $("#previewDialog[open] #previewNotice") || $("#notice");
  $("#notice").textContent = "";
  $("#previewNotice").textContent = "";
  display.textContent = s;
  clearTimeout(notify.t);
  notify.t = setTimeout(() => (display.textContent = ""), 2200);
}
function save() {
  try {
    localStorage.setItem("cs2028-v1", JSON.stringify(state));
    return true;
  } catch {
    notify("本机存储不可用，修改仅在本次打开期间有效");
    return false;
  }
}
function heading(t, subtitle = "") {
  return (
    '<div class="hero"><div><h1>' +
    esc(t) +
    "</h1>" +
    (subtitle ? "<p>" + esc(subtitle) + "</p>" : "") +
    "</div></div>"
  );
}
function sect(t, action = "") {
  return '<div class="section"><h2>' + esc(t) + "</h2>" + action + "</div>";
}
const present = (value) =>
  value != null && value !== "" && value !== "—" && value !== "暂未取得";
function facts(pairs, required = []) {
  const rows = pairs.filter(
    ([label, value]) => present(value) || required.includes(label),
  );
  if (!rows.length) return "";
  return `<dl class="facts">${rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(show(value))}</dd></div>`).join("")}</dl>`;
}
function button(action, title, value = "", className = "", pressed) {
  const toggleState = pressed === undefined ? "" : ` aria-pressed="${pressed}"`;
  return `<button type="button" class="${className}" data-action="${action}" data-id="${esc(value)}"${toggleState}>${esc(title)}</button>`;
}
function fav(type, id) {
  const key = type + "/" + id;
  const selected = state.fav.includes(key);
  return button("fav", selected ? "取消收藏" : "收藏", key, "", selected);
}
function compBtn(id) {
  const selected = state.comp.includes(id);
  return button("comp", selected ? "移出对比" : "加入对比", id, "", selected);
}
function opts(values, sel, all = "全部") {
  return (
    (all === null ? "" : '<option value="">' + all + "</option>") +
    values
      .map(
        (x) =>
          "<option " +
          (String(x) === String(sel) ? "selected " : "") +
          'value="' +
          esc(x) +
          '">' +
          esc(x) +
          "</option>",
      )
      .join("")
  );
}
function table(cols, rows, className = "") {
  return (
    '<div class="scroll"><table class="' +
    className +
    '"><thead><tr>' +
    cols.map((c) => "<th>" + c + "</th>").join("") +
    "</tr></thead><tbody>" +
    rows
      .map(
        (r) => "<tr>" + r.map((c) => "<td>" + c + "</td>").join("") + "</tr>",
      )
      .join("") +
    "</tbody></table></div>"
  );
}
const empty = (s) => '<p class="empty">' + esc(s) + "</p>";
const show = (value, unit = "") => (present(value) ? value + unit : "—");
function referenceKey(raw) {
  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol)) return "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()])
      if (/^utm_|^(gclid|fbclid)$/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return url.href.replace(/\/$/, "");
  } catch {
    return "";
  }
}
function sources(records = [], priority = 30) {
  const references = records.filter((record) => referenceKey(record?.url));
  return references.length
    ? `<div class="section-sources" data-reference-list data-priority="${priority}" hidden>${references
        .map(
          (record) =>
            `<template data-reference="${esc(record.url)}" data-title="${esc(record.shortTitle || record.title || record.url)}"></template>`,
        )
        .join("")}</div>`
    : "";
}
function refreshReferences(root) {
  const seen = new Set();
  for (const anchor of root.querySelectorAll(
    "a[href^='http']:not([data-source-link])",
  )) {
    const key = referenceKey(anchor.href);
    if (seen.has(key))
      anchor.replaceWith(
        document.createTextNode(anchor.textContent.replace(/ ↗$/, "")),
      );
    else if (key) seen.add(key);
  }
  const lists = [...root.querySelectorAll("[data-reference-list]")].sort(
    (a, b) => Number(a.dataset.priority) - Number(b.dataset.priority),
  );
  for (const list of lists) {
    const links = [
      ...list.querySelectorAll("template[data-reference]"),
    ].flatMap((mark) => {
      const { reference, title } = mark.dataset;
      const key = referenceKey(reference);
      if (seen.has(key)) return [];
      seen.add(key);
      return [
        `<li><a data-source-link href="${esc(reference)}" target="_blank" rel="noopener noreferrer">${esc(title)} ↗</a></li>`,
      ];
    });
    const markup = links.length
      ? `<span class="small">原文</span><ul>${links.join("")}</ul>`
      : "";
    const output = list.querySelector(".section-source-links");
    if (output && output.innerHTML !== markup) output.innerHTML = markup;
    else if (!output && markup)
      list.insertAdjacentHTML(
        "beforeend",
        `<div class="section-source-links">${markup}</div>`,
      );
    list.hidden = !markup;
  }
}
function projectTable(records, quickPreview = false) {
  return records.length
    ? table(
        ["学校 / 招生学院", "招生专业", "考试组合", "年度", "详情"],
        records.map((p) => [
          link("project", p.school.name, p.ref) +
            `<small>${esc(p.college)}</small>`,
          esc(p.majorLabel || p.major.title) +
            `<small class="mono">${esc(p.major.id)}</small>`,
          `<span class="mono">${esc(p.annual.examCombo || "—")}</span>`,
          esc(p.year),
          quickPreview
            ? button("preview", "快速预览", p.ref)
            : link("project", "查看 →", p.ref),
        ]),
        "project-table",
      )
    : empty("此条件下暂无已收录项目。");
}
function notices(records) {
  return (
    records
      .map(
        (record) => `<div class="listrow">
    <div><small>${esc(record.sources[0]?.publisher)}</small><br>${out(record.sources[0]?.url, record.title)}</div>
    <time>${esc(record.date || (record.year ? record.year + " 届" : "日期未取得"))}</time></div>`,
      )
      .join("") || empty("暂无符合条件的公告。")
  );
}

function lineChart(title, unit, entries) {
  const points = entries.filter(({ value }) => Number.isFinite(value));
  if (!points.length) return "";
  const high = Math.max(0, ...points.map(({ value }) => value));
  const low = Math.min(0, ...points.map(({ value }) => value));
  const span = high - low || 1;
  const scale = 10 ** Math.floor(Math.log10(span / 3));
  const step = Math.ceil(span / 3 / scale) * scale;
  const data = entries.map(({ label, value }, index) => ({
    label,
    value,
    x: entries.length === 1 ? 50 : 6 + (88 * index) / (entries.length - 1),
    y: 100 - ((value - low) / (3 * step)) * 100,
  }));
  const lines = [];
  let segment = [];
  for (const point of data) {
    if (Number.isFinite(point.value)) segment.push(`${point.x},${point.y}`);
    else if (segment.length) {
      lines.push(segment);
      segment = [];
    }
  }
  if (segment.length) lines.push(segment);
  const summary = points
    .map(({ label, value }) => `${label} ${value}${unit}`)
    .join("，");
  return `<div class="small">${esc(title)}${unit ? `（${esc(unit)}）` : ""}</div>
    <div class="scroll"><div class="chartframe" role="img" aria-label="${esc(title + " " + summary)}"
      style="min-width:${entries.length > 7 ? entries.length * 45 : 0}px">
      <div class="chart-axis" aria-hidden="true">
        ${[3, 2, 1, 0].map((n) => `<span>${Number((low + n * step).toPrecision(8))}</span>`).join("")}
      </div>
      <div class="chart-plot" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          ${lines.map((line) => `<polyline points="${line.join(" ")}" vector-effect="non-scaling-stroke"/>`).join("")}
        </svg>
        ${data
          .map(
            ({ x, y, value, label }, i) => `
          ${
            Number.isFinite(value)
              ? `<span class="chart-point${i === data.length - 1 ? " latest" : ""}" style="left:${x}%;top:${y}%">
            <span class="chart-value">${esc(value)}</span></span>`
              : ""
          }
          <span class="chart-label" style="left:${x}%">${esc(label)}</span>`,
          )
          .join("")}
      </div>
    </div></div>`;
}
function articleSections(article) {
  return (
    (article.sections || [])
      .filter((section) => !/^(调查|核验|维护)/.test(section.title || ""))
      .map(
        (section) => `<section class="panel">
    ${sect(section.title)}
    ${(section.paragraphs || []).map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}
    ${
      section.table
        ? table(
            section.table.headers.map(esc),
            section.table.rows
              .filter(
                (row) =>
                  !/^(资料口径|学历证据|城市证据|薪资证据|调查|核验)/.test(
                    row[0],
                  ),
              )
              .map((row) => row.map((cell) => esc(show(cell)))),
          )
        : ""
    }
    ${section.chart ? lineChart(section.chart.title, section.chart.unit || "", section.chart.points) : ""}
    ${sources(section.sources)}
    </section>`,
      )
      .join("") + sources(article.sources)
  );
}

function home() {
  const days = Math.max(
      0,
      Math.ceil(
        (Date.parse(trends.target.examDate + "T00:00:00Z") -
          Date.parse(
            new Date().toLocaleDateString("en-CA", {
              timeZone: "Asia/Shanghai",
            }) + "T00:00:00Z",
          )) /
          86400000,
      ),
    ),
    stat = (a, b, c, d) =>
      '<div class="stat"><label>' +
      a +
      "</label><div><strong>" +
      b +
      "</strong>" +
      c +
      "</div><p>" +
      d +
      "</p></div>";
  return (
    `<div class="eyebrow"><i class="dot"></i>${esc(trends.target.year)} 届 · 硕士研究生招生</div>
    <div class="hero"><div><h1>计算机考研总览</h1><p>全日制计算机类专业硕士 · 985 高校 · 408 统考</p></div>
    ${updatedAt ? `<span class="update">资料更新于 <time datetime="${esc(updatedAt)}">${esc(updatedAt.replaceAll("-", "."))}</time></span>` : ""}</div><div class="stats">` +
    stat(
      "距离预计初试月",
      days,
      "天",
      "按 " + esc(trends.target.examDate) + " 估算",
    ) +
    stat("院校名录", schools.length, "所", "全国 985 高校") +
    stat(
      "已收录招生项目",
      latestProjects.length,
      "项",
      `含 ${projects.length} 条年度记录`,
    ) +
    stat("个人收藏", state.fav.length, "项", "院校、项目、专业及职业") +
    '</div><div class="columns"><section class="panel">' +
    sect("全国考研报名趋势", link("trend", "历年数据 →")) +
    lineChart(
      "报名人数",
      trends.unit,
      trends.series
        .slice(-7)
        .map(({ year, value }) => ({ label: year, value })),
    ) +
    '</section><section class="panel">' +
    sect("数据覆盖") +
    facts([
      [
        "已建项目的院校",
        new Set(latestProjects.map((project) => project.schoolId)).size + " 所",
      ],
      ["有招生目录或计划的项目", [...projectHistory.values()].filter((records) => records.some(hasCatalog)).length + " 项"],
      [
        "有录取统计的项目年度",
        projects.filter(
          (p) =>
            p.admission &&
            [
              "examAdmissions",
              "cutoff",
              "median",
              "average",
            ].some((key) => p.admission[key] != null),
        ).length + " 条",
      ],
    ]) +
    sect("报考目标") +
    facts([
      ["目标届别", trends.target.year + " 届"],
      ["预计初试", trends.target.examDate.slice(0, 7)],
      ["预计入学", trends.target.enrollmentMonth],
    ]) +
    link("decide", "设置择校条件 →", "", "jump") +
    '</section></div><section class="panel">' +
    sect("院校招生项目", link("schools", "进入院校数据库 →")) +
    projectTable(
      latestProjects.filter((p) => p.status === "current").slice(0, 4),
    ) +
    '</section><section class="panel">' +
    sect("招生动态", link("news", "全部动态 →")) +
    notices(news.slice(0, 3)) +
    '</section><section class="panel">' +
    sect("近期收藏", link("saved", "查看收藏 →")) +
    (state.fav
      .slice(-3)
      .reverse()
      .map(
        (k) =>
          '<div class="listrow">' +
          link(k.split("/")[0], lookup(k) + " →", k.split("/")[1]) +
          "</div>",
      )
      .join("") || empty("尚无收藏。可在项目详情中收藏关注的院校和专业。")) +
    "</section>"
  );
}
let cachedQuery = "";
let cachedResults = [];
function getFiltered() {
  const { q, city, combo, year, sort, major } = filters;
  const query = normalizeQuery(q);
  const key = JSON.stringify([query, city, combo, year, sort, major]);
  if (key === cachedQuery) return cachedResults;
  const matches = groupBy(
    indexedProjects
      .filter(
        ({ record, text }) =>
          (!city || record.city === city) &&
          containsWords(text, query) &&
          (!combo || record.annual.examCombo === combo) &&
          (!year || String(record.year) === year) &&
          (!major || record.majorId === major),
      )
      .map(({ record }) => record),
    (record) => record.schoolId,
  );
  const projectFilter = combo || year || major;
  const rows = indexedSchools.flatMap(({ record: school, text }) => {
    const records = matches.get(school.id) || [];
    return records.length ||
      (!projectFilter &&
        (!city || school.city === city) &&
        containsWords(text, query))
      ? [{ school, records, count: new Set(records.map((r) => r.id)).size }]
      : [];
  });
  if (sort === "school")
    rows.sort((a, b) => collator.compare(a.school.name, b.school.name));
  const rank =
    sort === "year"
      ? (p) => p.year
      : sort === "cutoff"
        ? (p) => numbers(p).cutoff
        : null;
  if (rank) {
    const metric = ({ records }) =>
      Math.max(-1, ...records.map((record) => rank(record) ?? -1));
    rows.sort((a, b) => metric(b) - metric(a));
  }
  cachedQuery = key;
  cachedResults = rows;
  return rows;
}

function assessment(school) {
  const result = school.computingAssessment;
  return result?.grade ? `${result.grade} · 第${result.round}轮` : "—";
}
function projectRowControls(project) {
  const exam =
    project.annual.examCombo ||
    (project.year >= trends.target.year && !hasCatalog(project)
      ? "招生信息待确认"
      : "—");
  return `<span class="small">${esc(exam)}</span>
    <div class="actions">${button("preview", "快速预览", project.ref)}${link("project", "详情 →", project.ref, "button")}${compBtn(project.ref)}</div>`;
}
function groupedProjects(records) {
  if (!records.length) return empty("暂无符合条件的招生项目。");
  return projectTree(records)
    .map(
      ({ college, majors }) => `<details class="college-group">
    <summary>${esc(college)} <span class="small">${majors.length} 个专业</span></summary>
    <div>${majors
      .map(
        ({ id, title, projects }) => `<section class="major-group">
      <h3>${esc(title)} <span class="small num">${esc(id)}</span></h3>
      ${projects
        .map((years) => {
          const current = years[0];
          return `<div class="group-project" data-group-project="${esc(current.id)}"><div>
          <span>${esc(current.direction || (current.majorLabel !== title ? current.majorLabel : "") || "未细分方向")}</span>
          ${
            years.length > 1
              ? `<label class="small">年度 <select data-browse-year="${esc(current.id)}">${opts(
                  years.map((p) => p.year),
                  current.year,
                  null,
                )}</select></label>`
              : `<span class="num small">${current.year} 届</span>`
          }
          </div><div data-row-controls>${projectRowControls(current)}</div></div>`;
        })
        .join("")}</section>`,
      )
      .join("")}</div></details>`,
    )
    .join("");
}
const expandedSchools = new Set();
function resultTable(rows) {
  if (!rows.length) return empty("没有符合条件的院校。");
  return rows
    .map(
      ({ school, count }) => `<article class="school-row">
    <div class="school-summary">
      <h2>${link("school", school.name, school.id)}</h2>
      <span>${esc(school.city)}</span>
      <span class="small"><span class="field-caption">计算机学科评估 </span>${esc(assessment(school))}</span>
      <span class="small"><span class="num">${count}</span> 个项目</span>
    </div>
    <details data-browse-school="${esc(school.id)}" ${expandedSchools.has(school.id) ? "open" : ""}>
      <summary>查看匹配项目</summary><div data-browse-content></div>
    </details>
  </article>`,
    )
    .join("");
}
function fillSchoolProjects(details) {
  const target = details.querySelector("[data-browse-content]");
  if (target && !target.hasChildNodes()) {
    const row = getFiltered().find(
      ({ school }) => school.id === details.dataset.browseSchool,
    );
    if (row) target.innerHTML = groupedProjects(row.records);
  }
}
document.addEventListener(
  "toggle",
  (event) => {
    const details = event.target;
    if (!details.matches?.("[data-browse-school]") || !details.isConnected)
      return;
    if (details.open) {
      expandedSchools.add(details.dataset.browseSchool);
      fillSchoolProjects(details);
    } else expandedSchools.delete(details.dataset.browseSchool);
  },
  true,
);

function directory() {
  return `${heading("院校数据库")}
    <div class="filters">
      <label>关键词<input id="filterQ" placeholder="学校、学院或专业"></label>
      <label>城市<select id="city">${opts(cities)}</select></label>
      <label id="comboField">考试组合<select id="combo">${opts(combos)}</select></label>
      <label id="yearField">招生年度<select id="year">${opts(years)}</select></label>
      <label id="majorField">专业<select id="major"><option value="">全部</option>${majors.map((m) => `<option value="${esc(m.id)}">${esc(m.id + " " + m.title)}</option>`).join("")}</select></label>
      <label>排序<select id="sort">
        <option value="">默认顺序</option><option value="school">院校名称</option>
        <option value="year">招生年度从新到旧</option><option value="cutoff">项目复试线从高到低</option>
      </select></label>
      ${button("clear", "重置")}${button("saveFilter", "保存筛选")}
      ${button("loadFilter", "恢复筛选")}
    </div>
    <section id="results" aria-label="查询结果">
      <div class="section"><b id="resultCount" role="status"></b>${button("exportList", "导出结果")}</div>
      <div id="resultTable"></div>
      <nav id="pager" aria-label="结果分页">
        ${button("paginate", "上一页", "-1")}<span id="pageCount" class="num"></span>
        ${button("paginate", "下一页", "1")}
      </nav>
    </section>`;
}

function syncDirectoryControls() {
  for (const field of ["city", "combo", "year", "sort", "major"])
    $("#" + field).value = filters[field] || "";
  $("#filterQ").value = filters.q;
  $('[data-action="loadFilter"]').hidden = !state.filters;
}

let displayedRows;
let displayedListPage;
function updateResults(animate = false) {
  const target = $("#resultTable");
  if (!target) return;
  const rows = getFiltered();
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  listPage = Math.min(totalPages, Math.max(1, listPage));
  if (
    rows !== displayedRows ||
    displayedListPage !== listPage ||
    !target.firstChild
  ) {
    const horizontal = target.querySelector(".scroll")?.scrollLeft || 0;
    target.innerHTML = resultTable(
      rows.slice((listPage - 1) * pageSize, listPage * pageSize),
    );
    if (target.querySelector(".scroll"))
      target.querySelector(".scroll").scrollLeft = horizontal;
    target
      .querySelectorAll("[data-browse-school][open]")
      .forEach(fillSchoolProjects);
    if (animate) revealUpdate(target);
  }
  displayedRows = rows;
  displayedListPage = listPage;

  const count = `院校 · ${rows.length} 所`;
  if ($("#resultCount").textContent !== count)
    $("#resultCount").textContent = count;
  $("#pager").hidden = totalPages <= 1;
  $("#pageCount").textContent = `${listPage} / ${totalPages}`;
  $('[data-action="paginate"][data-id="-1"]').setAttribute(
    "aria-disabled",
    String(listPage === 1),
  );
  $('[data-action="paginate"][data-id="1"]').setAttribute(
    "aria-disabled",
    String(listPage === totalPages),
  );
  storeBrowserState();
}

let filterTimer;
function changeFilters(patch, syncControls = false) {
  Object.assign(filters, patch);
  listPage = 1;
  clearTimeout(filterTimer);
  if (syncControls) syncDirectoryControls();
  updateResults(true);
}

const usefulText = (text) =>
  String(text || "")
    .split(/[。；;\n]+/)
    .map((v) => v.trim())
    .filter(
      (v) =>
        v &&
        !/访问失败|核验过程|本轮|字段清单|历史对应|未获得|未成功|尚未核实|暂未取得|仍待核查|本数据库|页面打不开|供维护|待核|未核实|关联方向为参考|未建独立项目|不能分配至|不得分配至/.test(
          v,
        ),
    );
function compactNotes(...values) {
  const kept = [];
  const normalize = (value) =>
    value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, "")
      .replace(
        /(统计口径|数据口径|合计统计|合并统计|按原文公布范围|详见原文|以原文为准)/g,
        "",
      );
  for (const line of values.flatMap(usefulText)) {
    const key = normalize(line);
    if (
      !key ||
      kept.some(
        (x) =>
          x.key === key ||
          (Math.min(key.length, x.key.length) >= 9 &&
            (key.includes(x.key) || x.key.includes(key))),
      )
    )
      continue;
    kept.push({ key, line });
  }
  return kept.map((x) => x.line).join("；");
}
function scopeNote(text) {
  return text ? `<p class="measure-note small">${esc(text)}</p>` : "";
}
function readable(value) {
  if (value === true || value === false) return value ? "是" : "否";
  if (Array.isArray(value)) return value.map(readable).join("、");
  if (value && typeof value === "object")
    return Object.entries(value)
      .filter(([, v]) => v != null)
      .map(
        ([key, v]) =>
          (({
            total: "总分",
            min: "最低",
            max: "最高",
            median: "中位数",
            mean: "均分",
            q1: "第一四分位",
            q3: "第三四分位",
            n: "样本量",
          })[key] || key) +
          " " +
          readable(v),
      )
      .join("；");
  return value == null ? "" : String(value);
}
function annualActions(project) {
  return (
    fav("project", project.ref) +
    compBtn(project.ref) +
    link("compare", "查看对比", "", "button")
  );
}
function sectionWith(title, body) {
  return body ? `<section class="panel">${sect(title)}${body}</section>` : "";
}
const projectViews = createProjectViews({
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
  projectEmployment: (project) => dataInsights.projectEmployment(project),
});
function detail(project) {
  return projectViews.page(
    project,
    projectHistory.get(project.id),
    trends.target.year,
    arg === project.ref,
  );
}
function school(record) {
  const info = Object.fromEntries(
    (record.sections || [])
      .flatMap((section) => section.table?.rows || [])
      .filter(([label]) => ["研究优势", "双一流学科"].includes(label))
      .map(([label, value]) => [
        label,
        String(value).replace(/^year：\d+；round：\d+；disciplines：/, ""),
      ]),
  );
  return `${heading(record.name, record.province + " · " + record.city)}
    <div class="actions">${fav("school", record.id)}</div>
    ${sectionWith(
      "院校概况",
      facts([
        [
          "计算机学科评估",
          record.computingAssessment ? assessment(record) : null,
        ],
        ...Object.entries(info),
      ]) +
        sources([
          ...(record.computingAssessment?.sources || []),
          ...(record.sections || []).flatMap((s) => s.sources || []),
          ...(record.sources || []),
        ]),
    )}
    ${sectionWith("招生项目", groupedProjects(allBySchool.get(record.id) || []))}
    ${dataInsights.schoolEmployment(record.id)}`;
}
const compareFields = ["school", "college", "major", "project", "year"];
const emptyCompareDraft = () => ({
  school: "",
  college: "",
  major: "",
  project: "",
  year: "",
  editing: "",
});
let compareDraft = emptyCompareDraft();
function comparisonChooser() {
  return `<section class="comparison-chooser" aria-label="选择对比项目">
    <div class="filters">
      <label>搜索院校<input id="compareSearch" placeholder="校名或简称" autocomplete="off"></label>
      <label>院校<select data-compare-field="school"></select></label>
      <label>招生学院<select data-compare-field="college"></select></label>
      <label>招生专业<select data-compare-field="major"></select></label>
      <label id="compareDirection">研究方向<select data-compare-field="project"></select></label>
      <label>招生年度<select data-compare-field="year"></select></label>
      ${button("addComparison", "加入对比", "", "btn")}${button("cancelComparisonEdit", "取消修改")}
    </div>
    <p id="comparisonHint" class="small" role="status"></p>
    </section>`;
}
function compareSelect(field, choices, label, preferRecent = false) {
  const node = document.querySelector(`[data-compare-field="${field}"]`);
  const existing = compareDraft[field];
  const value = choices.some(([id]) => id === existing)
    ? existing
    : choices.length === 1 || preferRecent
      ? choices[0]?.[0] || ""
      : "";
  compareDraft[field] = value;
  const options =
    (choices.length === 1 ? "" : `<option value="">${label}</option>`) +
    choices
      .map(([id, text]) => `<option value="${esc(id)}">${esc(text)}</option>`)
      .join("");
  if (node.dataset.options !== options) {
    node.innerHTML = options;
    node.dataset.options = options;
  }
  node.value = value;
  node.disabled = !choices.length;
  return value;
}
function selectedCompareItem() {
  const { project, year } = compareDraft;
  return project && year ? projectById.get(projectRef(project, year)) : null;
}
function syncCompareChooser() {
  const query = normalizeQuery($("#compareSearch").value);
  const school = compareSelect(
    "school",
    indexedSchools
      .filter(
        ({ record, text }) =>
          projectsBySchool.has(record.id) && containsWords(text, query),
      )
      .map(({ record }) => [record.id, record.name]),
    "选择院校",
  );
  const tree = projectTree(projectsBySchool.get(school) || []);
  const college = compareSelect(
    "college",
    tree.map(({ college }) => [college, college]),
    "选择学院",
  );
  const majors = tree.find((row) => row.college === college)?.majors || [];
  const major = compareSelect(
    "major",
    majors.map(({ id, title }) => [id, `${id} ${title}`]),
    "选择专业",
  );
  const tracks = majors.find((row) => row.id === major)?.projects || [];
  const labels = tracks.map(
    ([p]) => p.direction || p.majorLabel || "未细分方向",
  );
  const project = compareSelect(
    "project",
    tracks.map(([p], i) => [
      p.id,
      labels.filter((label) => label === labels[i]).length > 1
        ? [labels[i], p.studyMode, p.training?.location, p.id]
            .filter(Boolean)
            .join(" · ")
        : labels[i],
    ]),
    "选择方向",
  );
  $("#compareDirection").hidden =
    tracks.length < 2 && !tracks[0]?.[0]?.direction;
  compareSelect(
    "year",
    (projectHistory.get(project) || []).map((p) => [
      String(p.year),
      `${p.year} 届`,
    ]),
    "选择年度",
    true,
  );
  const candidate = selectedCompareItem();
  const duplicate =
    candidate &&
    state.comp.some(
      (ref) =>
        ref !== compareDraft.editing &&
        projectById.get(ref)?.ref === candidate.ref,
    );
  const add = $('[data-action="addComparison"]');
  add.disabled =
    !candidate ||
    duplicate ||
    (!compareDraft.editing && state.comp.length >= 5);
  add.textContent = compareDraft.editing ? "更新对比" : "加入对比";
  $('[data-action="cancelComparisonEdit"]').hidden = !compareDraft.editing;
  $("#comparisonHint").textContent = duplicate
    ? "该项目年度已在对比中。"
    : query && !school && $('[data-compare-field="school"]').disabled
      ? "没有匹配的院校。"
      : "";
}
function comparisonItems() {
  return state.comp
    .map((ref) => {
      const p = projectById.get(ref);
      if (!p) return "";
      const years = projectHistory.get(p.id);
      return `<article class="compare-item">
      <h3>${link("project", p.school.name, p.ref)}</h3>
      <p>${esc([p.college, p.majorLabel || p.major.title, p.direction].filter(Boolean).join(" · "))}</p>
      <div class="actions">
        <label>年度 <select aria-label="${esc(p.school.name + " " + p.major.title + "的对比年度")}" data-comp-year="${esc(ref)}">
          ${opts(
            years.map(({ year }) => year),
            p.year,
            null,
          )}</select></label>
        ${button("editComparison", "修改", ref)}
        ${button("comp", "删除", ref)}
      </div></article>`;
    })
    .join("");
}
function editComparison(ref) {
  const p = projectById.get(ref);
  if (!p) return;
  compareDraft = {
    school: p.schoolId,
    college: p.college,
    major: p.majorId,
    project: p.id,
    year: String(p.year),
    editing: ref,
  };
  $("#compareSearch").value = "";
  syncCompareChooser();
  $('[data-compare-field="school"]').focus();
}
function replaceComparison(from, to) {
  const index = state.comp.indexOf(from);
  if (index < 0 || !projectById.has(to)) return false;
  if (
    state.comp.some(
      (ref, i) =>
        i !== index && projectById.get(ref)?.ref === projectById.get(to).ref,
    )
  ) {
    notify("该项目年度已在对比中");
    return false;
  }
  state.comp[index] = to;
  for (const ref of [from, to])
    updateToggle("comp", ref, state.comp.includes(ref), "移出对比", "加入对比");
  save();
  return true;
}
function compareTable() {
  const items = state.comp.map((id) => projectById.get(id)).filter(Boolean);
  if (!items.length)
    return empty("尚未选择项目。可从上方添加，或在招生项目详情中加入对比。");
  const rows = items.map((project) => ({ project, ...numbers(project) }));
  const groups = [
    ...new Map(
      items
        .flatMap((p) => p.sharedGroups)
        .map((g) => [projectRef(g.id, g.year), g]),
    ).values(),
  ];
  const columns = [
    "比较指标",
    ...items.map((p, i) =>
      link("project", `${i + 1} · ${p.school.name} · ${p.year}`, p.ref),
    ),
  ];
  const compareRows = (fields) =>
    fields
      .filter(([, read]) => items.some((p) => present(read(p))))
      .map(([label, read]) => [label, ...items.map((p) => esc(show(read(p))))]);
  const values = (fields) =>
    fields
      .filter(
        ([key]) =>
          rows.some((r) => Number.isFinite(r[key])) ||
          groups.some((g) => Number.isFinite(numbers(g)[key])),
      )
      .map(([key, label]) => [
        label,
        ...rows.map((r) => {
          const note =
            key === "examAdmissions"
              ? r.admissionScope
              : key === "examPlanned"
                ? r.examPlanScope
                : key === "examAttendees"
                  ? r.attendanceScope
                  : "";
          return Number.isFinite(r[key])
            ? esc(r[key] + (key.endsWith("Ratio") ? "∶1" : "")) +
                (note ? `<small class="metric-scope">${esc(note)}</small>` : "")
            : r.project.sharedGroups.some((g) =>
                  Number.isFinite(numbers(g)[key]),
                )
              ? "见共享统计"
              : "—";
        }),
      ]);
  const columnTable = (values) =>
    values.length
      ? table(columns, values, "compare-table admission-compare")
      : "";
  const requirements = compareRows([
    ["学院", (p) => p.college],
    ["专业", (p) => p.majorLabel || p.major.title],
    ["研究方向", (p) => p.direction],
    ["考试组合", (p) => p.annual.examCombo],
  ]);
  const costs = compareRows([
    ["培养地点", (p) => p.training?.location],
    ["学制", (p) => show(p.training?.durationYears, " 年")],
    ["学费总额", (p) => show(p.training?.tuitionTotal, " 元")],
    ["年学费", (p) => show(p.training?.tuitionPerYear, " 元/年")],
  ]);
  const metricFields = [
    ...new Map([
      ...scaleFields,
      ...competitionFields,
      ...ratioFields,
      ...scoreFields,
    ]).entries(),
  ];
  const chart = scoreRangeChart(
    "录取成绩对比",
    rows.map((r, i) => ({ ...r, label: `${i + 1} · ${r.project.year}` })),
    true,
  );
  const outcomeRows = columnTable(
    values([
      ["promotionAdmissions", "实际推免人数"],
      ...competitionFields,
      ...ratioFields,
    ]),
  );
  const scores = columnTable(values(scoreFields));
  const history = items.flatMap((p) => references(p, "history"));
  const job = items.map((p) => dataInsights.comparisonEmployment(p));
  return (
    sectionWith(
      "招生计划及考试科目",
      columnTable([...requirements, ...values(planFields)]) +
        sources(
          items.flatMap((p) => references(p, "catalog")),
          15,
        ),
    ) +
    sectionWith(
      "报考与录取人数",
      outcomeRows +
        (outcomeRows ? sources(history.filter((s) => !isScoreSource(s))) : ""),
    ) +
    sectionWith(
      "录取成绩",
      scores +
        chart +
        (scores || chart
          ? sources(history.filter((s) => !outcomeRows || isScoreSource(s)))
          : "") +
        (scores &&
        new Set(items.map((p) => p.annual.examCombo).filter(Boolean)).size > 1
          ? scopeNote("各项目考试组合不同，原始分数的可比性有限。")
          : ""),
    ) +
    groups
      .map((group) => {
        const values = numbers(group);
        const used = metricFields.filter(([key]) =>
          Number.isFinite(values[key]),
        );
        return used.length
          ? `<section class="panel shared-metrics"><h3>${group.year} 年共享统计</h3>
        ${scopeNote(compactNotes(group.displayScope || group.scope))}${facts(used.map(([key, label]) => [label, show(values[key], key.endsWith("Ratio") ? "∶1" : "")]))}
        ${sources(group.sources, 10)}</section>`
          : "";
      })
      .join("") +
    sectionWith(
      "培养条件",
      costs.length
        ? columnTable(costs) +
            sources(
              items.flatMap((p) => references(p, "training")),
              15,
            )
        : "",
    ) +
    sectionWith(
      "就业情况",
      job.some(Boolean)
        ? columnTable([["就业资料", ...job.map((item) => item || "—")]])
        : "",
    )
  );
}
function savedPlans() {
  return (
    state.plans
      .map(
        (plan, index) =>
          `<div class="listrow">${esc(
            plan
              .map((id) => projectById.get(id)?.school.name)
              .filter(Boolean)
              .join(" / "),
          )}${button("plan", "载入方案", index)}</div>`,
      )
      .join("") || empty("暂无已保存方案。")
  );
}
function compare() {
  compareDraft = emptyCompareDraft();
  return `${heading("院校对比")}${comparisonChooser()}
    <div class="section"><h2>已选项目</h2><span id="comparisonCount" class="small" role="status">已选 ${state.comp.length} / 5 项</span></div>
    <div id="comparisonItems" class="compare-items">${comparisonItems()}</div>
    <div id="comparisonTable">${compareTable()}</div>
    <div id="comparisonActions" class="actions" ${state.comp.length < 2 ? "hidden" : ""}>
      ${button("savePlan", "保存此方案")}${button("exportComp", "导出对比")}
    </div>${sect("已保存方案")}<div id="comparisonPlans">${savedPlans()}</div>`;
}
function updateComparison(focusRef) {
  const target = $("#comparisonTable");
  if (!target) return;
  const focused = document.activeElement;
  const inSelection = $("#comparisonItems").contains(focused);
  const activeRef =
    focusRef || focused.dataset?.id || focused.dataset?.compYear;
  const horizontal = target.querySelector(".scroll")?.scrollLeft || 0;
  $("#comparisonItems").innerHTML = comparisonItems();
  target.innerHTML = compareTable();
  const scroll = target.querySelector(".scroll");
  if (scroll) scroll.scrollLeft = horizontal;
  $("#comparisonActions").hidden = state.comp.length < 2;
  $("#comparisonCount").textContent = `已选 ${state.comp.length} / 5 项`;
  if (compareDraft.editing && !state.comp.includes(compareDraft.editing))
    compareDraft.editing = "";
  syncCompareChooser();
  refreshReferences(pageContent);
  if (inSelection) {
    const next = [...document.querySelectorAll("[data-comp-year]")].find(
      (node) => node.dataset.compYear === activeRef,
    );
    (next || $("#compareSearch")).focus({ preventScroll: true });
  }
  revealUpdate(target);
}
function major(record) {
  return `${heading(record.title, record.id + " · " + record.degree)}
    <div class="actions">${fav("major", record.id)}</div>
    <div class="article">${articleSections(record)}${directionLinks(record)}
    ${
      record.careerIds.length
        ? `<section>${sect("关联职业")}${record.careerIds
            .map(
              (id) =>
                `<div class="listrow">${link("job", careerById.get(id).title + " →", id)}</div>`,
            )
            .join("")}</section>`
        : ""
    }</div>
    <section>${sect("已收录招生项目")}${projectTable(latestProjects.filter((p) => p.majorId === record.id))}</section>`;
}
function job(record) {
  return `${heading(record.title, record.industry)}
    <div class="actions">${fav("job", record.id)}</div>
    <div class="article">${articleSections(record)}
    <section>${sect("相关研究生专业")}${careerByMajor
      .get(record.id)
      .map(
        (major) =>
          `<div class="listrow">${link("major", major.id + " " + major.title + " →", major.id)}</div>`,
      )
      .join(
        "",
      )}</section></div>${dataInsights.bandTable(record)}${dataInsights.careerContext(record)}${dataInsights.marketSections(record)}`;
}
function grid(rows) {
  return (
    '<div class="grid">' +
    rows
      .map(
        ([k, t, d, p, id]) =>
          '<article class="item"><small>' +
          esc(k) +
          "</small><h3>" +
          link(p, t + " ↗", id) +
          "</h3><p>" +
          esc(d) +
          "</p></article>",
      )
      .join("") +
    "</div>"
  );
}
function decisionsMatching(record) {
  return (
    (!state.city || record.city === state.city) &&
    (!state.wantCombo || record.annual.examCombo === state.wantCombo) &&
    (!state.wantYear || String(record.year) === state.wantYear) &&
    (!state.wantMajor || record.majorId === state.wantMajor)
  );
}
function matches() {
  return (state.wantYear ? projects : latestProjects).filter(decisionsMatching);
}
function decisionResults() {
  const candidates = matches();
  return (
    sect(
      "候选项目 · " + candidates.length,
      button("exportCandidates", "导出清单"),
    ) +
    `<p class="small">当前条件 · ${esc([state.city, state.wantCombo, state.wantYear, state.wantMajor].filter(Boolean).join(" / ") || "全部")}</p>` +
    projectTable(candidates.slice(0, 30), true) +
    (candidates.length > 30
      ? '<p class="measure-note">列表显示前 30 条。可缩小筛选范围或导出全部结果。</p>'
      : "")
  );
}
function decision() {
  return `${heading("择校决策", "按已有项目资料筛选；可在项目预览中直接加入对比。")}
    <div class="filters"><label>意向城市<select id="prefCity">${opts(cities, state.city, "不限城市")}</select></label>
    <label>考试组合<select id="prefCombo">${opts(combos, state.wantCombo, "不限组合")}</select></label>
    <label>招生年度<select id="prefYear">${opts(years, state.wantYear, "最近收录年度")}</select></label>
    <label>专业<select id="prefMajor"><option value="">不限专业</option>${majors.map((m) => `<option value="${esc(m.id)}" ${state.wantMajor === m.id ? "selected" : ""}>${esc(m.id + " " + m.title)}</option>`).join("")}</select></label>
    ${button("pref", "保存条件", "", "btn")}</div><section id="decisionResults">${decisionResults()}</section>`;
}
function lookup(key) {
  const [p, id] = key.split("/");
  if (p === "project") {
    const project = projectById.get(id);
    return project
      ? `${project.school.name} · ${project.major.title} · ${project.year}`
      : id;
  }
  if (p === "major") return majorById.get(id)?.title || id;
  if (p === "job") return careerById.get(id)?.title || id;
  return schoolById.get(id)?.name || id;
}
function saved() {
  return (
    heading("我的收藏") +
    '<div id="favoriteList">' +
    (state.fav
      .map((k) => {
        const [p, id] = k.split("/");
        return (
          '<article class="item"><div class="section"><h3>' +
          link(p, lookup(k), id) +
          "</h3>" +
          fav(p, id) +
          '</div><label>个人备注 <input data-note="' +
          esc(k) +
          '" maxlength="500" placeholder="添加择校备注" value="' +
          esc(state.notes[k] || "") +
          '"></label> ' +
          (p === "project" ? compBtn(id) : "") +
          "</article>"
        );
      })
      .join("") ||
      empty("尚无收藏。可在院校、招生项目、专业和职业详情页添加。")) +
    "</div>"
  );
}
function data() {
  return (
    heading("数据管理") +
    facts([
      ["院校名录", schools.length + " 所"],
      ["招生项目年度记录", projects.length + " 条"],
      ["招生公告", news.length + " 条"],
      ["全国报名人数序列", trends.series.length + " 年"],
      ["最近资料更新", updatedAt],
    ]) +
    "<section>" +
    sect("个人数据备份") +
    '<p>收藏、备注、对比方案和择校条件保存在当前浏览器中。恢复备份会替换当前个人设置。</p><div class="actions">' +
    button("backup", "下载 JSON 备份") +
    '<label class="button">选择备份文件 <input id="restore" type="file" accept=".json,application/json"></label></div></section>'
  );
}
function directionLinks(record) {
  const related = (record.researchIds || []).filter((id) =>
    researchById.has(id),
  );
  return related.length
    ? `<section>${sect("研究方向")}<p class="related-links">
    ${related.map((id) => link("research", researchById.get(id).title, id)).join(" · ")}</p></section>`
    : "";
}
function directionPage(record) {
  return (
    heading(record.title, record.category) +
    `<div class="article">${articleSections(record)}${directionLinks(record)}
    <section>${sect("相关专业")}<p class="related-links">${(record.majorIds || []).map((id) => link("major", majorById.get(id)?.title || id, id)).join(" · ")}</p></section></div>`
  );
}
function guide() {
  const categories = [...new Set(topics.map((t) => t.category || "考研知识"))];
  const selected = topics.find((t) => t.id === arg);
  const category =
    selected?.category || (categories.includes(arg) ? arg : categories[0]);
  const current = topics.filter((t) => (t.category || "考研知识") === category);
  return (
    heading("考研概况") +
    `<nav class="actions" aria-label="知识专题">${categories.map((c) => link("guide", c, c, c === category ? "button btn" : "button")).join("")}</nav>
    <div class="article">${current
      .map(
        (
          topic,
        ) => `<details id="knowledge-${esc(topic.id)}" class="record-disclosure" ${selected?.id === topic.id ? "open" : ""}>
     <summary>${esc(topic.title)}</summary><div><p>${esc(topic.summary)}</p>${articleSections(topic)}${directionLinks(topic)}
     ${topic.majorIds?.length ? `<p class="related-links">${topic.majorIds.map((id) => link("major", majorById.get(id)?.title || id, id)).join(" · ")}</p>` : ""}
     </div></details>`,
      )
      .join("")}</div>` +
    "<section>" +
    sect("标准加权综合成绩试算") +
    '<p>适用于初试满分 500、复试满分 100、按百分制加权的项目。</p><form id="calc" class="filters"><label>初试成绩<input name="a" type="number" min="0" max="500" step="any" required></label><label>复试成绩<input name="b" type="number" min="0" max="100" step="any" required></label><label>初试权重（%）<input name="w" type="number" min="0" max="100" step="any" required></label><button>计算</button></form><output id="score"></output></section></div>'
  );
}
function jobsPage() {
  return (
    heading("就业发展") +
    `<nav class="actions" aria-label="就业资料">
    ${[
      ["行业", "industries"],
      ["企业", "employers"],
      ["就业城市", "cities"],
      ["高校就业", "schoolEmployment"],
      ["薪资资料", "salaryStatistics"],
      ["招聘与 Offer 案例", "recruitmentExamples"],
    ]
      .map(([label, key]) => link("jobs", label, key, "button"))
      .join("")}</nav>` +
    grid(careers.map((c) => [c.industry, c.title, c.summary, "job", c.id]))
  );
}
const group = {
  school: "schools",
  project: "schools",
  major: "majors",
  job: "jobs",
  industry: "jobs",
  employer: "jobs",
  city: "jobs",
  salary: "jobs",
  recruitment: "jobs",
  research: "majors",
  trend: "home",
};
function mountNavigation() {
  $("#rail").innerHTML =
    '<a class="brand" href="#home"><svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M1 1h30v7H8v16h23v7H1z M12 12h19v7H12z"/></svg>CS 2028</a><nav class="nav" aria-label="主导航">' +
    nav
      .slice(0, 9)
      .map(
        ([k, t, d], i) =>
          (i === 5 || i === 8 ? "<hr>" : "") +
          `<a href="#${k}">${icon(d)}${t}</a>`,
      )
      .join("") +
    '</nav><div class="railfoot"><a href="#data">' +
    icon(nav[9][2]) +
    "数据管理</a></div>";
  $("#searchOpen").innerHTML =
    icon("M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0") +
    "全站搜索 <kbd>⌘ K</kbd>";
}

function updateNavigation() {
  const section = group[page] || page;
  const current = $("#rail [aria-current]");
  const next = [
    ...document.querySelectorAll("#rail .nav a, #rail .railfoot a"),
  ].find((item) => item.hash === route(section));

  if (current !== next) {
    current?.removeAttribute("aria-current");
    next?.setAttribute("aria-current", "page");
  }
  $("#crumb b").textContent = label(section) || "页面";
}

function render() {
  let pages = {
    home,
    schools: directory,
    school: () => school(schoolById.get(arg)),
    project: () => detail(projectById.get(arg)),
    majors: () =>
      arg === "directions"
        ? heading("研究方向") +
          grid(
            research.map((row) => [
              row.category,
              row.title,
              row.summary,
              "research",
              row.id,
            ]),
          )
        : heading("专业探索") +
          `<div class="actions">${link("majors", "研究方向", "directions", "button")}</div>` +
          grid(
            majors.map((m) => [
              m.id + " · " + m.degree,
              m.title,
              m.summary,
              "major",
              m.id,
            ]),
          ),
    major: () => major(majorById.get(arg)),
    research: () => directionPage(researchById.get(arg)),
    jobs: () =>
      arg
        ? dataInsights.marketIndex(arg) +
          `<div class="actions">${link("jobs", "就业发展 →", "", "button")}</div>`
        : jobsPage(),
    job: () => job(careerById.get(arg)),
    industry: () => dataInsights.marketDetail("industries", arg),
    employer: () => dataInsights.marketDetail("employers", arg),
    city: () => dataInsights.marketDetail("cities", arg),
    salary: () => dataInsights.marketDetail("salaryStatistics", arg),
    recruitment: () => dataInsights.marketDetail("recruitmentExamples", arg),
    guide,
    compare,
    decide: decision,
    saved,
    data,
    news: () =>
      heading("招生动态") +
      news
        .map(
          (n) =>
            notices([n]) +
            (n.summary ? `<p class="article">${esc(n.summary)}</p>` : "") +
            (schoolById.has(n.schoolId)
              ? link(
                  "school",
                  "关联院校 · " + schoolById.get(n.schoolId).name + " →",
                  n.schoolId,
                  "jump",
                )
              : "") +
            (n.projectIds?.length
              ? `<p class="related-links">${n.projectIds.map((id) => link("project", projectById.get(id)?.majorLabel || projectById.get(id)?.major.title || id, id)).join(" · ")}</p>`
              : ""),
        )
        .join(""),
    trend: () =>
      heading("全国考研报名人数", trends.scope) +
      table(
        ["招生年度", "报名人数（" + esc(trends.unit) + "）"],
        [...trends.series]
          .reverse()
          .map((r) => [esc(r.year), esc(show(r.value))]),
      ) +
      sources(trends.series.flatMap((r) => r.sources)),
  };
  try {
    pageContent.innerHTML = pages[page]
      ? pages[page]()
      : heading("未找到该记录") + link("home", "返回首页");
    if (page === "schools") {
      syncDirectoryControls();
      updateResults();
    }
    if (page === "compare") syncCompareChooser();
    refreshReferences(pageContent);
    document.title =
      (main.querySelector("h1")?.textContent || "首页") + " · CS 2028";
  } catch (e) {
    console.error(e);
    pageContent.innerHTML = heading("未找到该记录") + link("home", "返回首页");
  }
}
function download(name, obj) {
  const u = URL.createObjectURL(
    new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = u;
  a.download = name + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function toggle(arr, v) {
  return arr.includes(v) ? arr.filter((t) => t !== v) : [...arr, v];
}
function updateToggle(action, id, selected, selectedLabel, defaultLabel) {
  for (const control of document.querySelectorAll(
    `[data-action="${action}"]`,
  )) {
    if (control.dataset.id !== id) continue;
    control.setAttribute("aria-pressed", String(selected));
    control.textContent = selected ? selectedLabel : defaultLabel;
  }
}

function toggleComparison(id) {
  id = projectById.get(id)?.ref || id;
  if (!state.comp.includes(id) && state.comp.length >= 5)
    return notify("最多可选择 5 个项目");
  state.comp = toggle(state.comp, id);
  const selected = state.comp.includes(id);
  updateToggle("comp", id, selected, "移出对比", "加入对比");
  updateComparison();
  if (save()) notify(selected ? "已加入对比" : "已移出对比");
}

function act(control) {
  const { action, id } = control.dataset;
  if (control.getAttribute("aria-disabled") === "true") return;
  switch (action) {
    case "preview":
      return openPreview(id, control);
    case "previewStep":
      return stepPreview(Number(id));
    case "paginate":
      listPage += Number(id);
      return updateResults(true);
    case "fav": {
      state.fav = toggle(state.fav, id);
      const selected = state.fav.includes(id);
      updateToggle(action, id, selected, "取消收藏", "收藏");
      const favorite = control.closest("#favoriteList .item");
      if (favorite && !selected) {
        const next =
          favorite.nextElementSibling || favorite.previousElementSibling;
        const list = favorite.parentElement;
        favorite.remove();
        if (!list.childElementCount)
          list.innerHTML = empty(
            "尚无收藏。可在院校、招生项目、专业和职业详情页添加。",
          );
        (next?.querySelector('[data-action="fav"]') || main).focus({
          preventScroll: true,
        });
      }
      if (save()) notify(selected ? "已收藏" : "已取消收藏");
      return;
    }
    case "comp":
      return toggleComparison(id);
    case "editComparison":
      return editComparison(id);
    case "cancelComparisonEdit":
      compareDraft.editing = "";
      return syncCompareChooser();
    case "addComparison": {
      const project = selectedCompareItem();
      if (!project) return;
      if (compareDraft.editing) {
        if (replaceComparison(compareDraft.editing, project.ref)) {
          compareDraft.editing = "";
          updateComparison(project.ref);
          notify("已更新对比项目");
        }
      } else if (!state.comp.includes(project.ref))
        toggleComparison(project.ref);
      return;
    }
    case "plan":
      state.comp = [...state.plans[Number(id)]];
      save();
      return updateComparison();
    case "savePlan":
      if (
        !state.plans.some(
          (plan) => JSON.stringify(plan) === JSON.stringify(state.comp),
        )
      ) {
        state.plans.push([...state.comp]);
        $("#comparisonPlans").innerHTML = savedPlans();
        revealUpdate($("#comparisonPlans"));
      }
      if (save()) notify("已保存比较方案");
      return;
    case "saveFilter":
      state.filters = { ...filters };
      $('[data-action="loadFilter"]').hidden = false;
      if (save()) notify("已保存筛选条件");
      return;
    case "loadFilter":
      return changeFilters({ ...defaultFilters, ...state.filters }, true);
    case "clear":
      return changeFilters({ ...defaultFilters }, true);
    case "pref":
      state.city = $("#prefCity").value;
      state.wantCombo = $("#prefCombo").value;
      state.wantYear = $("#prefYear").value;
      state.wantMajor = $("#prefMajor").value;
      $("#decisionResults").innerHTML = decisionResults();
      revealUpdate($("#decisionResults"));
      if (save()) notify("已保存择校条件");
      return;
    case "backup":
      return download("CS2028-个人备份", { version: 1, state });
    case "exportComp":
      return download(
        "CS2028-项目对比",
        state.comp.map((ref) => projectById.get(ref)).filter(Boolean),
      );
    case "exportList":
      return download(
        "CS2028-筛选结果",
        getFiltered().map(({ school, records }) => ({
          school: school.name,
          projects: records,
        })),
      );
    case "exportCandidates":
      return download("CS2028-候选项目", matches());
  }
}

document.addEventListener("input", (event) => {
  if (event.target.id === "compareSearch") {
    if (!event.isComposing) syncCompareChooser();
    return;
  }
  if (event.target.id !== "filterQ") return;
  filters.q = event.target.value;
  listPage = 1;
  storeBrowserState();
  clearTimeout(filterTimer);
  if (!event.isComposing) filterTimer = setTimeout(updateResults, 100);
});
document.addEventListener("compositionend", (event) => {
  if (event.target.id === "filterQ") updateResults();
  if (event.target.id === "compareSearch") syncCompareChooser();
});
function validState(v) {
  const strings = (a) =>
      Array.isArray(a) && a.every((x) => typeof x === "string"),
    ids = (a) =>
      strings(a) && a.length <= 5 && a.every((id) => projectById.has(id));
  return (
    v &&
    strings(v.fav) &&
    v.fav.every((k) => searchRows().some(([p, id]) => p + "/" + id === k)) &&
    ids(v.comp) &&
    Array.isArray(v.plans) &&
    v.plans.every(ids) &&
    v.notes &&
    typeof v.notes === "object" &&
    !Array.isArray(v.notes) &&
    Object.values(v.notes).every((n) => typeof n === "string") &&
    typeof v.city === "string" &&
    (!v.wantCombo || typeof v.wantCombo === "string") &&
    (!v.filters ||
      ["q", "city", "combo", "year"].every(
        (k) => typeof v.filters[k] === "string",
      ))
  );
}
document.addEventListener("change", async (e) => {
  let t = e.target;
  if (["year", "city", "combo", "sort", "major"].includes(t.id))
    changeFilters({ [t.id]: t.value });
  if (t.dataset.browseYear) {
    const project = projectById.get(projectRef(t.dataset.browseYear, t.value));
    if (project)
      t
        .closest("[data-group-project]")
        .querySelector("[data-row-controls]").innerHTML =
        projectRowControls(project);
    return;
  }
  if (t.id === "catalogYear" || t.id === "historyRange") {
    const records = projectHistory.get(t.dataset.project);
    const target = t.id === "catalogYear" ? $("#catalogDocument") : $("#projectHistory");
    target.innerHTML = t.id === "catalogYear"
      ? projectViews.planBody(records.find((record) => record.year === Number(t.value)))
      : projectViews.history(records, t.value);
    refreshReferences(pageContent);
    revealUpdate(target);
    return;
  }
  if (t.dataset.note) {
    state.notes[t.dataset.note] = t.value;
    if (save()) notify("已保存备注");
  }
  if (t.dataset.compareField) {
    const field = t.dataset.compareField;
    compareDraft[field] = t.value;
    for (const later of compareFields.slice(compareFields.indexOf(field) + 1))
      compareDraft[later] = "";
    syncCompareChooser();
    return;
  }
  if (t.dataset.compYear) {
    const project = projectById.get(t.dataset.compYear);
    const ref = projectRef(project.id, t.value);
    if (replaceComparison(t.dataset.compYear, ref)) updateComparison(ref);
    else t.value = String(project.year);
    return;
  }
  if (t.id === "restore" && t.files.length) {
    try {
      const doc = JSON.parse(await t.files[0].text());
      if (doc.version !== 1 || !validState(doc.state)) throw Error();
      if (confirm("用所选备份替换当前个人设置？")) {
        state = doc.state;
        if (save()) notify("已恢复备份");
      }
    } catch {
      notify("文件格式或关联记录无效，原设置已保留");
    }
    t.value = "";
  }
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "calc") {
    e.preventDefault();
    const f = new FormData(e.target),
      w = +f.get("w") / 100;
    $("#score").textContent =
      "综合成绩 " +
      ((+f.get("a") / 5) * w + +f.get("b") * (1 - w)).toFixed(2) +
      " 分";
  }
});
const searchDialog = $("#searchDialog");
const previewDialog = $("#previewDialog");
const searchInput = $("#searchInput");
const searchResults = $("#searchResults");
let previewItems = [];
let previewIndex = 0;

function preview(project) {
  const catalog = hasCatalog(project)
    ? project
    : projectHistory.get(project.id).find(hasCatalog);
  const recent = projectHistory
    .get(project.id)
    .map((record) => ({ record, cutoff: numbers(record).cutoff }))
    .find(({ cutoff }) => cutoff != null);
  return `<h2 id="previewTitle" tabindex="-1">${esc(project.school.name)}</h2>
    <p class="preview-college">${esc([project.college, project.majorLabel || project.major.title, project.direction].filter(Boolean).join(" · "))}</p>
    <div class="actions">${fav("project", project.ref)}${compBtn(project.ref)}${link("project", "查看完整详情", project.ref, "button btn")}</div>
    ${catalog ? sectionWith(catalog.year + " 年招生计划", projectViews.planBody(catalog)) : ""}
    ${sectionWith(
      "录取与培养",
      facts([
        [
          "最近复试线",
          recent ? `${recent.record.year} 年 · ${recent.cutoff} 分` : null,
        ],
        ["年学费", show(project.training?.tuitionPerYear, " 元/年")],
        ["学制", show(project.training?.durationYears, " 年")],
      ]) +
        sources([
          ...(recent ? references(recent.record, "history") : []),
          ...references(project, "training"),
        ]),
    )}`;
}
function updatePreview(animate = false) {
  const body = $("#previewBody");
  body.innerHTML = preview(previewItems[previewIndex]);
  refreshReferences(body);
  $("#previewPosition").textContent =
    `${previewIndex + 1} / ${previewItems.length}`;
  $('[data-action="previewStep"][data-id="-1"]').setAttribute(
    "aria-disabled",
    String(previewIndex === 0),
  );
  $('[data-action="previewStep"][data-id="1"]').setAttribute(
    "aria-disabled",
    String(previewIndex === previewItems.length - 1),
  );
  $("#previewNotice").textContent = "";
  previewDialog.scrollTop = 0;
  if (animate) revealUpdate(body);
}

let previewOpener;
function openPreview(id, opener) {
  const selected = projectById.get(id);
  if (!selected) return;
  const candidates =
    page === "decide"
      ? matches().slice(0, 30)
      : page === "schools"
        ? getFiltered().find(({ school }) => school.id === selected.schoolId)
            ?.records || []
        : allBySchool.get(selected.schoolId) || [];
  const items = byLatest(candidates).map((rows) =>
    rows[0].id === selected.id ? selected : rows[0],
  );
  if (!items.some((project) => project.ref === id)) items.unshift(selected);
  previewItems = items;
  previewIndex = items.findIndex((project) => project.ref === id);
  updatePreview();
  if (!previewDialog.open) {
    previewOpener = opener;
    delete previewDialog.dataset.instant;
    previewDialog.showModal();
  }
}
function stepPreview(delta) {
  previewIndex += delta;
  updatePreview(true);
}

function setMenu(open, restoreFocus = false) {
  document.body.classList.toggle("open", open);
  $("#menu").setAttribute("aria-expanded", String(open));
  if (restoreFocus) $("#menu").focus();
}
$("#menu").onclick = () => {
  const open = !document.body.classList.contains("open");
  setMenu(open);
  if (open) ($("#rail [aria-current]") || $("#rail a")).focus();
};

function closeOverlay(dialog, immediate = false) {
  if (!dialog.open) return;
  if (immediate) dialog.dataset.instant = "";
  dialog.close();
}
for (const dialog of [searchDialog, previewDialog]) {
  dialog.addEventListener("pointerdown", (event) => {
    dialog.pointerOnBackdrop = event.target === dialog;
  });
  dialog.addEventListener("click", (event) => {
    if (dialog.pointerOnBackdrop && event.target === dialog)
      closeOverlay(dialog);
    dialog.pointerOnBackdrop = false;
  });
}
$("#closePreview").onclick = () => closeOverlay(previewDialog);
previewDialog.addEventListener("close", () => {
  if (previewDialog.open) return;
  if (!("instant" in previewDialog.dataset) && previewOpener?.isConnected) {
    previewOpener.focus({ preventScroll: true });
  }
  previewOpener = undefined;
});

function searchableSections(article) {
  return (article.sections || [])
    .flatMap((section) => [
      section.title,
      ...(section.paragraphs || []),
      ...(section.table?.headers || []),
      ...(section.table?.rows.flat() || []),
      section.chart?.title,
      ...(section.chart?.points.map(({ label }) => label) || []),
      ...(section.sources || []).map(({ title }) => title),
    ])
    .join(" ");
}
function searchRows() {
  return [
    ...schools.map((s) => [
      "school",
      s.id,
      s.name + " · " + s.city,
      [...s.aliases, searchableSections(s)].join(" "),
    ]),
    ...projects.map((p) => [
      "project",
      p.ref,
      [p.school.name, p.college, p.major.title, p.annual.examCombo, p.year]
        .filter(Boolean)
        .join(" · "),
      [
        ...projectTerms(p),
        ...p.annual.subjects.map(({ code, name }) => code + " " + name),
      ].join(" "),
    ]),
    ...majors.map((m) => [
      "major",
      m.id,
      m.id + " · " + m.title,
      [m.summary, searchableSections(m)].join(" "),
    ]),
    ...careers.map((c) => [
      "job",
      c.id,
      c.title,
      [c.industry, c.summary, ...(c.aliases || []), searchableSections(c)].join(
        " ",
      ),
    ]),
    ...news.map((n) => [
      "external",
      n.sources[0]?.url,
      n.title,
      [n.sources[0]?.publisher, n.summary, n.year].filter(Boolean).join(" "),
    ]),
    ...research.map((r) => [
      "research",
      r.id,
      r.title + " · 研究方向",
      [r.category, r.summary, searchableSections(r)].join(" "),
    ]),
    ...dataInsights.searchRows(),
    ...topics.map((t) => [
      "guide",
      t.id,
      t.title + " · " + t.summary,
      searchableSections(t),
    ]),
  ];
}
function search() {
  const query = normalizeQuery(searchInput.value);
  if (!query || !searchIndex) {
    searchResults.replaceChildren();
    return;
  }
  const matches = [];
  const seen = new Set();
  for (const { row, text } of searchIndex) {
    if (!containsWords(text, query)) continue;
    const [type, id] = row;
    const key =
      type === "project"
        ? "project/" + projectById.get(id)?.id
        : type === "external"
          ? referenceKey(id)
          : type + "/" + id;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push(row);
    if (matches.length === 30) break;
  }
  const projectResults = matches.filter(([type]) => type === "project");
  const bySchool = groupBy(
    projectResults,
    ([, id]) => projectById.get(id).schoolId,
  );
  const renderRow = ([type, id, title]) =>
    `<div class="listrow">${type === "external" ? out(id, title) : link(type, title, id)}</div>`;
  searchResults.innerHTML =
    matches
      .filter(
        ([type, id]) =>
          type !== "project" && !(type === "school" && bySchool.has(id)),
      )
      .map(renderRow)
      .join("") +
      [...bySchool]
        .map(
          ([
            schoolId,
            rows,
          ]) => `<section class="search-school"><h3>${link("school", schoolById.get(schoolId).name, schoolId)}</h3>
      ${rows
        .map(([, id]) => {
          const p = projectById.get(id);
          return renderRow([
            "project",
            id,
            [
              p.college,
              p.majorLabel || p.major.title,
              p.direction,
              p.year + " 届",
            ]
              .filter(Boolean)
              .join(" · "),
          ]);
        })
        .join("")}</section>`,
        )
        .join("") || empty("没有匹配的记录。");
}
function openSearch() {
  if (searchDialog.open) return;
  closeOverlay(previewDialog, true);
  if (document.body.classList.contains("open")) setMenu(false, true);
  delete searchDialog.dataset.instant;
  searchDialog.showModal();
  search();
}
$("#searchOpen").onclick = openSearch;
searchInput.oninput = (event) => {
  if (!event.isComposing) search();
};
searchInput.oncompositionend = search;
$("#closeSearch").onclick = () => closeOverlay(searchDialog);
searchDialog.addEventListener("keydown", (event) => {
  if (
    event.isComposing ||
    !["ArrowUp", "ArrowDown", "Enter"].includes(event.key)
  )
    return;
  const results = [...searchResults.querySelectorAll("a")];
  if (!results.length) return;
  if (event.key === "Enter") {
    if (event.target !== searchInput) return;
    event.preventDefault();
    results[0].click();
    return;
  }
  event.preventDefault();
  const index = results.indexOf(document.activeElement);
  const next = index + (event.key === "ArrowDown" ? 1 : -1);
  (next < 0
    ? index < 0
      ? results.at(-1)
      : searchInput
    : results[Math.min(next, results.length - 1)]
  ).focus();
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openSearch();
  }
  if (event.key === "Escape" && document.body.classList.contains("open"))
    setMenu(false, true);
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (button) act(button);
  const anchor = event.target.closest("a");
  if (
    document.body.classList.contains("open") &&
    !event.target.closest("#menu") &&
    (!event.target.closest("#rail") || anchor)
  ) {
    setMenu(false, !!anchor && anchor.hash === location.hash);
  }
  if (
    !anchor ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  if (anchor.classList.contains("skip")) {
    event.preventDefault();
    main.focus();
    return;
  }
  if (!anchor.getAttribute("href")?.startsWith("#")) {
    if (searchDialog.contains(anchor)) closeOverlay(searchDialog);
    return;
  }
  if (!projectById) return;
  event.preventDefault();
  closeOverlay(searchDialog, true);
  closeOverlay(previewDialog, true);
  if (anchor.hash === location.hash) return;
  rememberScroll();
  history.pushState({ cs2028Entry: newEntryId() }, "", anchor.hash);
  navigate(event.detail > 0);
});

const positions = new Map(Object.entries(browserState.positions || {}));
let scrollTimer;
let activeEntry;
history.scrollRestoration = "manual";

function newEntryId() {
  return Math.random().toString(36).slice(2);
}
function rememberScroll(persist = false) {
  if (!activeEntry) return;
  positions.delete(activeEntry);
  positions.set(activeEntry, scrollY);
  if (positions.size > 30) {
    const oldest = positions.keys().next().value;
    positions.delete(oldest);
    delete browserState.directoryEntries[oldest];
  }
  if (!persist) return;
  browserState.positions = Object.fromEntries(positions);
  storeBrowserState();
}
addEventListener(
  "scroll",
  () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => rememberScroll(true), 120);
  },
  { passive: true },
);
addEventListener("pagehide", () => rememberScroll(true));

function navigate(animate = false) {
  let entry = history.state?.cs2028Entry;
  if (!entry) {
    entry = newEntryId();
    history.replaceState({ ...history.state, cs2028Entry: entry }, "");
  }
  if (entry === activeEntry) return;
  cancelPageEntrance();
  rememberScroll();
  clearTimeout(scrollTimer);
  closeOverlay(searchDialog, true);
  closeOverlay(previewDialog, true);
  setMenu(false);
  const shouldAnimate = animate && activeEntry !== undefined;
  const destinationScroll = positions.get(entry) || 0;
  const [name, value = ""] = (location.hash.slice(1) || "home").split("/");
  page = name;
  try {
    arg = decodeURIComponent(value);
  } catch {
    arg = "";
  }
  activeEntry = entry;
  const directoryEntry = browserState.directoryEntries[entry];
  if (page === "schools" && directoryEntry) {
    filters = { ...defaultFilters, ...directoryEntry.filters };
    listPage = directoryEntry.listPage;
  }
  updateNavigation();
  render();
  main.focus({ preventScroll: true });
  const topic =
    page === "guide" && arg && document.getElementById("knowledge-" + arg);
  if (topic && !positions.has(entry)) topic.scrollIntoView();
  else scrollTo(0, destinationScroll);
  if (shouldAnimate) playPageEntrance(pageContent);
}

async function start() {
  try {
    indexData(await loadPublicData());
    navigate();
    const syncRoute = () => {
      if (history.state?.cs2028Entry !== activeEntry) navigate();
    };
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", () => navigate());
  } catch {
    pageContent.innerHTML =
      heading("数据库读取失败") + '<button id="retry">重新读取</button>';
    $("#retry").onclick = start;
  }
}
mountNavigation();
start();
