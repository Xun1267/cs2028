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
  view: "招生项目",
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
let projectById, projectsBySchool, indexedSchools, indexedProjects, searchIndex;
let cities, years;
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
  news = [...data.news].sort((a, b) => b.date.localeCompare(a.date));
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
function facts(pairs) {
  return (
    '<dl class="facts">' +
    pairs
      .map(
        ([a, b]) =>
          "<div><dt>" +
          esc(a) +
          "</dt><dd>" +
          esc(b === "" || b == null ? "暂未取得" : b) +
          "</dd></div>",
      )
      .join("") +
    "</dl>"
  );
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
const show = (value, unit = "") =>
  value == null || value === "" ? "暂未取得" : value + unit;
const source = (record) =>
  record ? out(record.url, record.title) : "暂未取得";
function sources(records = []) {
  if (!records.length) return "";
  return `<ul class="data-sources">${records
    .map(
      (record) =>
        `<li>${source(record)}${[
          record.publisher,
          record.year && `${record.year} 届`,
          record.scope,
        ]
          .filter(Boolean)
          .map((value) => ` <span>${esc(value)}</span>`)
          .join("")}</li>`,
    )
    .join("")}</ul>`;
}
function projectTable(records, quickPreview = false) {
  return records.length
    ? table(
        ["学校 / 招生学院", "招生专业", "考试组合", "年度", "详情"],
        records.map((p) => [
          link("project", p.school.name, p.ref) +
            `<small>${esc(p.college)}</small>`,
          esc(p.major.title) + `<small class="mono">${esc(p.major.id)}</small>`,
          `<span class="mono">${esc(p.annual.examCombo || "待核实")}</span>`,
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
    <time>${esc(record.date)}</time></div>`,
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
      .map(
        (section) => `<section class="panel">
    ${sect(section.title)}
    ${(section.paragraphs || []).map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}
    ${
      section.table
        ? table(
            section.table.headers.map(esc),
            section.table.rows.map((row) => row.map((cell) => esc(show(cell)))),
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
    sect("报考目标") +
    facts([
      ["目标届别", trends.target.year + " 届"],
      ["预计初试", trends.target.examDate.slice(0, 7)],
      ["预计入学", trends.target.enrollmentMonth],
    ]) +
    link("decide", "设置择校条件 →", "", "jump") +
    '</section></div><section class="panel">' +
    sect("院校招生项目", link("schools", "进入院校数据库 →")) +
    projectTable(latestProjects.slice(0, 4)) +
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
  const { q, city, combo, year, view, sort } = filters;
  const query = normalizeQuery(q);
  const key = JSON.stringify([query, city, combo, year, view, sort]);
  if (key === cachedQuery) return cachedResults;

  const directoryMode = view === "院校名录";
  const index = directoryMode ? indexedSchools : indexedProjects;
  const rows = index
    .filter(
      ({ record, text }) =>
        (!city || record.city === city) &&
        text.includes(query) &&
        (directoryMode ||
          ((!combo || record.annual.examCombo === combo) &&
            (!year || String(record.year) === year))),
    )
    .map(({ record }) => record);
  if (sort === "school") {
    rows.sort((a, b) =>
      collator.compare(a.name || a.school.name, b.name || b.school.name),
    );
  } else if (sort === "year" && !directoryMode) {
    rows.sort((a, b) => Number(b.year) - Number(a.year));
  }
  cachedQuery = key;
  cachedResults = rows;
  return rows;
}

function resultTable(rows) {
  if (filters.view !== "院校名录") return projectTable(rows, true);
  if (!rows.length) return empty("没有符合条件的院校。");
  return table(
    ["院校", "省份", "城市", "已收录项目"],
    rows.map((school) => [
      link("school", school.name, school.id),
      esc(school.province),
      esc(school.city),
      String(projectsBySchool.get(school.id)?.length || 0),
    ]),
    "school-table",
  );
}

function directory() {
  return `${heading("院校数据库")}
    <div class="actions" aria-label="列表模式">${["招生项目", "院校名录"]
      .map((mode) => button("view", mode, mode, "", filters.view === mode))
      .join("")}</div>
    <div class="filters">
      <label>关键词<input id="filterQ" placeholder="学校、学院或专业"></label>
      <label>城市<select id="city">${opts(cities)}</select></label>
      <label id="comboField">考试组合<select id="combo">${opts(combos)}</select></label>
      <label id="yearField">招生年度<select id="year">${opts(years)}</select></label>
      <label>排序<select id="sort">
        <option value="">默认顺序</option><option value="school">院校名称</option>
        <option value="year">招生年度从新到旧</option>
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
  for (const field of ["city", "combo", "year", "sort"])
    $("#" + field).value = filters[field];
  $("#filterQ").value = filters.q;
  const projectMode = filters.view === "招生项目";
  $("#comboField").hidden = $("#yearField").hidden = !projectMode;
  $('#sort option[value="year"]').disabled = !projectMode;
  if (!projectMode && filters.sort === "year") $("#sort").value = "";
  for (const control of document.querySelectorAll('[data-action="view"]')) {
    control.setAttribute(
      "aria-pressed",
      String(control.dataset.id === filters.view),
    );
  }
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
    if (animate) revealUpdate(target);
  }
  displayedRows = rows;
  displayedListPage = listPage;

  const count = `${filters.view} · ${rows.length} 条`;
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

function planMetric(project, key) {
  if (project.annual[key] != null) return show(project.annual[key], " 人");
  return show(project.sharedPlan?.[key], " 人（共享）");
}
function publishedSources(project) {
  return [
    ...project.annual.sources,
    ...(project.sharedPlan?.sources || []),
    ...(project.admission?.sources || []),
    ...(project.training?.sources || []),
  ];
}
function annualActions(project) {
  return (
    fav("project", project.ref) +
    compBtn(project.ref) +
    link("compare", "查看对比", "", "button")
  );
}
function annualDetail(project) {
  const { annual, admission, training, sharedPlan } = project;
  return `<div class="columns"><section class="panel">
    ${sect("招生与考试")}
    ${facts([
      ["招生年度", project.year],
      ["招生专业", project.major.id + " " + project.major.title],
      ["研究方向", project.direction],
      [
        "学位及学习方式",
        [project.degree, project.studyMode].filter(Boolean).join(" · "),
      ],
      ["考试组合", annual.examCombo],
      [
        "初试科目",
        annual.subjects.map(({ code, name }) => `${code} ${name}`).join("、"),
      ],
      ["拟招总人数", planMetric(project, "planned")],
      ["计划推免", planMetric(project, "promotionPlanned")],
      ["计划统考", planMetric(project, "examPlanned")],
      ["实际推免", show(admission?.promotionAdmissions, " 人")],
    ])}
    </section><section class="panel">${sect("录取与培养")}
    ${facts([
      ["普通统考报考人数", show(admission?.applicants, " 人")],
      ["普通统考录取人数", show(admission?.examAdmissions, " 人")],
      ["参加复试人数", show(admission?.interviewees, " 人")],
      ["报录比", show(admission?.applicationRatio, "∶1")],
      ["复录比", show(admission?.interviewRatio, "∶1")],
      ["复试线", show(admission?.cutoff, " 分")],
      ["录取中位数", show(admission?.median, " 分")],
      ["年学费", show(training?.tuitionPerYear, " 元/年")],
      ["学制", show(training?.durationYears, " 年")],
      ["实际培养地点", training?.location],
    ])}</section></div>
    ${admission?.interviewRequirements ? `<section>${sect("复试要求")}<p class="article">${esc(admission.interviewRequirements)}</p></section>` : ""}
    ${
      admission?.scoreDistribution?.length
        ? `<section>${sect("录取成绩分布")}
      ${table(
        ["最低分", "最高分", "人数"],
        admission.scoreDistribution.map(({ min, max, count }) =>
          [min, max, count].map(esc),
        ),
      )}</section>`
        : ""
    }
    <section>${sect("统计口径与原始资料")}
      ${[
        sharedPlan?.scope,
        annual.scope,
        admission?.scope,
        training?.scope,
        annual.note,
        training?.note,
      ]
        .filter(Boolean)
        .map((note) => `<p class="article">${esc(note)}</p>`)
        .join("")}
      ${sources(publishedSources(project))}
    </section>`;
}

function historyDetail(records) {
  const metrics = [
    ["拟招总人数", (p) => p.annual.planned ?? p.sharedPlan?.planned, "planned"],
    [
      "计划推免",
      (p) => p.annual.promotionPlanned ?? p.sharedPlan?.promotionPlanned,
      "promotionPlanned",
    ],
    [
      "计划统考",
      (p) => p.annual.examPlanned ?? p.sharedPlan?.examPlanned,
      "examPlanned",
    ],
    ["普通统考报考", (p) => p.admission?.applicants],
    ["实际推免", (p) => p.admission?.promotionAdmissions],
    ["普通统考录取", (p) => p.admission?.examAdmissions],
    ["报录比", (p) => p.admission?.applicationRatio],
    ["复录比", (p) => p.admission?.interviewRatio],
    ["复试线", (p) => p.admission?.cutoff],
    ["录取最低分", (p) => p.admission?.minimum],
    ["录取最高分", (p) => p.admission?.maximum],
    ["录取均分", (p) => p.admission?.average],
    ["录取中位数", (p) => p.admission?.median],
  ].filter(([, read]) => records.some((record) => read(record) != null));
  const chartFields = [
    ["复试线变化", "分", (p) => p.admission?.cutoff],
    ["普通统考录取人数变化", "人", (p) => p.admission?.examAdmissions],
    ["计划统考人数变化", "人", (p) => p.annual.examPlanned],
  ];
  const byYear = new Map(records.map((record) => [record.year, record]));
  const charts = chartFields
    .map(([title, unit, read]) => {
      const known = records.filter((record) => read(record) != null);
      if (known.length < 2) return "";
      const start = known.at(-1).year;
      const points = Array.from(
        { length: known[0].year - start + 1 },
        (_, index) => {
          const year = start + index;
          const record = byYear.get(year);
          return { label: year, value: record ? read(record) : null };
        },
      );
      return lineChart(title, unit, points);
    })
    .join("");
  return `<section>${sect("历年数据")}
    ${table(
      ["年度", "考试组合", ...metrics.map(([label]) => label)],
      records.map((record) => [
        esc(record.year),
        esc(show(record.annual.examCombo)),
        ...metrics.map(([, read, planKey]) =>
          esc(planKey ? planMetric(record, planKey) : show(read(record))),
        ),
      ]),
    )}
    <p class="small">共享名额按公布口径列出，不能按方向相加。<br>趋势图仅使用已取得的年度数据。</p>
    ${charts || empty("暂无可绘制趋势的两个或以上年度数据。")}</section>`;
}

function detail(project) {
  const records = projectHistory.get(project.id);
  return `${heading(project.school.name + " · " + project.major.title, project.college)}
    <div id="projectActions" class="actions">${annualActions(project)}</div>
    <div class="filters"><label>招生年度<select id="projectYear" data-project="${esc(project.id)}">
      ${opts(
        records.map(({ year }) => year),
        project.year,
        null,
      )}
    </select></label></div>
    <div id="projectAnnual">${annualDetail(project)}</div>
    ${historyDetail(records)}
    <div class="actions">${link("school", "院校档案 →", project.schoolId, "button")}
      ${link("major", "专业详情 →", project.majorId, "button")}</div>`;
}
function school(record) {
  return `${heading(record.name, record.province + " · " + record.city)}
    <div class="actions">${fav("school", record.id)}</div>
    <div class="article">${articleSections(record)}</div>
    ${sect("已收录招生项目")}${projectTable(projectsBySchool.get(record.id) || [])}`;
}
function compareOptions() {
  return (
    '<option value="">选择项目</option>' +
    projects
      .filter((project) => !state.comp.includes(project.ref))
      .map(
        (project) =>
          `<option value="${esc(project.ref)}">${esc(
            [
              project.school.name,
              project.college,
              project.major.title,
              project.direction,
              project.year,
            ]
              .filter(Boolean)
              .join(" · "),
          )}</option>`,
      )
      .join("")
  );
}
function compareTable() {
  const items = state.comp.map((id) => projectById.get(id)).filter(Boolean);
  if (!items.length) {
    return empty("尚未选择项目。可从上方添加，或在招生项目详情中加入对比。");
  }
  const metrics = [
    ["招生年度", (p) => p.year],
    ["招生学院", (p) => p.college],
    ["招生专业", (p) => p.major.title],
    ["专业代码", (p) => p.major.id],
    ["培养地点", (p) => p.training?.location],
    ["考试组合", (p) => p.annual.examCombo],
    ["拟招总人数", (p) => planMetric(p, "planned")],
    ["计划统考人数", (p) => planMetric(p, "examPlanned")],
    ["统考录取人数", (p) => show(p.admission?.examAdmissions, " 人")],
    ["复试线", (p) => show(p.admission?.cutoff, " 分")],
    ["录取中位数", (p) => show(p.admission?.median, " 分")],
    ["年学费", (p) => show(p.training?.tuitionPerYear, " 元/年")],
    ["学制", (p) => show(p.training?.durationYears, " 年")],
  ];
  return (
    table(
      ["比较指标", ...items.map((p) => link("project", p.school.name, p.ref))],
      [
        ...metrics.map(([label, read]) => [
          label,
          ...items.map((p) => esc(show(read(p)))),
        ]),
        ["原始文件", ...items.map((p) => source(p.annual.sources[0]))],
        ["操作", ...items.map((p) => compBtn(p.ref))],
      ],
      "compare-table",
    ) +
    (new Set(items.map((project) => project.annual.examCombo)).size > 1
      ? "<p>各项目考试组合不同，原始分数的可比性有限。</p>"
      : "")
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
  return `${heading("院校对比", "选择 2—5 个招生项目，按相应年度并列查看。")}
    <div class="filters"><label>添加招生项目<select id="addProject">${compareOptions()}</select></label>
    <span id="comparisonCount" class="small" role="status">已选 ${state.comp.length} / 5 项</span></div>
    <div id="comparisonTable">${compareTable()}</div>
    <div id="comparisonActions" class="actions" ${state.comp.length < 2 ? "hidden" : ""}>
      ${button("savePlan", "保存此方案")}${button("exportComp", "导出对比")}
    </div>
    ${sect("已保存方案")}<div id="comparisonPlans">${savedPlans()}</div>`;
}
function updateComparison() {
  const target = $("#comparisonTable");
  if (!target) return;
  const focusWasInTable = target.contains(document.activeElement);
  const horizontal = target.querySelector(".scroll")?.scrollLeft || 0;
  target.innerHTML = compareTable();
  const scroll = target.querySelector(".scroll");
  if (scroll) scroll.scrollLeft = horizontal;
  $("#comparisonActions").hidden = state.comp.length < 2;
  $("#comparisonCount").textContent = `已选 ${state.comp.length} / 5 项`;
  $("#addProject").innerHTML = compareOptions();
  if (focusWasInTable)
    (target.querySelector('[data-action="comp"]') || $("#addProject")).focus({
      preventScroll: true,
    });
  revealUpdate(target);
}

function major(record) {
  return `${heading(record.title, record.id + " · " + record.degree)}
    <div class="actions">${fav("major", record.id)}</div>
    <div class="article">${articleSections(record)}
    <section>${sect("关联职业")}${record.careerIds
      .map(
        (id) =>
          `<div class="listrow">${link("job", careerById.get(id).title + " →", id)}</div>`,
      )
      .join("")}</section></div>
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
      .join("")}</section></div>`;
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
function matches() {
  return latestProjects.filter(
    (p) =>
      (!state.city || p.city === state.city) &&
      (!state.wantCombo || p.annual.examCombo === state.wantCombo),
  );
}
function decisionResults() {
  const candidates = matches();
  return (
    sect(
      "候选项目 · " + candidates.length,
      button("exportCandidates", "导出清单"),
    ) +
    `<p class="small">当前条件 · ${esc(state.city || "不限城市")} / ${esc(state.wantCombo || "不限组合")}</p>` +
    projectTable(candidates)
  );
}
function decision() {
  return `${heading("择校决策", "按已核实的项目字段筛选候选院校。")}
    <div class="filters"><label>意向城市<select id="prefCity">${opts(cities, state.city, "不限城市")}</select></label>
    <label>考试组合<select id="prefCombo">${opts(combos, state.wantCombo, "不限组合")}</select></label>
    ${button("pref", "保存条件", "", "btn")}</div>
    <section id="decisionResults">${decisionResults()}</section>`;
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
function guide() {
  return (
    heading("考研概况") +
    '<div class="article">' +
    topics
      .map(
        (topic) => `<article id="knowledge-${esc(topic.id)}">
      ${sect(topic.title)}${articleSections(topic)}</article>`,
      )
      .join("") +
    "<section>" +
    sect("标准加权综合成绩试算") +
    '<p>适用于初试满分 500、复试满分 100、按百分制加权的项目。</p><form id="calc" class="filters"><label>初试成绩<input name="a" type="number" min="0" max="500" step="any" required></label><label>复试成绩<input name="b" type="number" min="0" max="100" step="any" required></label><label>初试权重（%）<input name="w" type="number" min="0" max="100" step="any" required></label><button>计算</button></form><output id="score"></output></section></div>'
  );
}
const group = {
  school: "schools",
  project: "schools",
  major: "majors",
  job: "jobs",
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
      heading("专业探索") +
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
    jobs: () =>
      heading("就业发展") +
      grid(careers.map((c) => [c.industry, c.title, c.summary, "job", c.id])),
    job: () => job(careerById.get(arg)),
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
            (schoolById.has(n.schoolId)
              ? link(
                  "school",
                  "关联院校 · " + schoolById.get(n.schoolId).name + " →",
                  n.schoolId,
                  "jump",
                )
              : ""),
        )
        .join(""),
    trend: () =>
      heading("全国考研报名人数", trends.scope) +
      table(
        ["招生年度", "报名人数（" + esc(trends.unit) + "）", "资料来源"],
        [...trends.series]
          .reverse()
          .map((r) => [esc(r.year), esc(show(r.value)), sources(r.sources)]),
      ),
  };
  try {
    pageContent.innerHTML = pages[page]
      ? pages[page]()
      : heading("未找到该记录") + link("home", "返回首页");
    if (page === "schools") {
      syncDirectoryControls();
      updateResults();
    }
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
    case "view":
      if (filters.view !== id) changeFilters({ view: id }, true);
      return;
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
      return changeFilters({ ...defaultFilters, view: filters.view }, true);
    case "pref":
      state.city = $("#prefCity").value;
      state.wantCombo = $("#prefCombo").value;
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
      return download("CS2028-筛选结果", getFiltered());
    case "exportCandidates":
      return download("CS2028-候选项目", matches());
  }
}

document.addEventListener("input", (event) => {
  if (event.target.id !== "filterQ") return;
  filters.q = event.target.value;
  listPage = 1;
  storeBrowserState();
  clearTimeout(filterTimer);
  if (!event.isComposing) filterTimer = setTimeout(updateResults, 100);
});
document.addEventListener("compositionend", (event) => {
  if (event.target.id === "filterQ") updateResults();
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
      (["院校名录", "招生项目"].includes(v.filters.view) &&
        ["q", "city", "combo", "year"].every(
          (k) => typeof v.filters[k] === "string",
        )))
  );
}
document.addEventListener("change", async (e) => {
  let t = e.target;
  if (["year", "city", "combo", "sort"].includes(t.id))
    changeFilters({ [t.id]: t.value });
  if (t.id === "projectYear") {
    const record = projectById.get(projectRef(t.dataset.project, t.value));
    if (record) {
      arg = record.ref;
      history.replaceState(history.state, "", route("project", record.ref));
      $("#projectActions").innerHTML = annualActions(record);
      const annual = $("#projectAnnual");
      annual.innerHTML = annualDetail(record);
      revealUpdate(annual);
    }
  }
  if (t.dataset.note) {
    state.notes[t.dataset.note] = t.value;
    if (save()) notify("已保存备注");
  }
  if (t.id === "addProject" && t.value) {
    toggleComparison(t.value);
    t.value = "";
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
  const cutoff = projectHistory
    .get(project.id)
    .filter((p) => p.admission?.cutoff != null)
    .map((p) => `${p.year} 届 ${p.admission.cutoff} 分`)
    .join(" / ");
  return `<h2 id="previewTitle" tabindex="-1">${esc(project.school.name)}</h2>
    <p class="preview-college">${esc(project.college)}</p>
    <div class="actions">${fav("project", project.ref)}${compBtn(project.ref)}
      ${link("project", "查看完整详情", project.ref, "button btn")}
    </div>
    <section class="panel">${sect("招生信息")}
      ${facts([
        ["专业", `${project.major.id} ${project.major.title}`],
        ["研究方向", project.direction],
        ["招生年度", project.year],
        ["考试组合", project.annual.examCombo],
        ["拟招总人数", planMetric(project, "planned")],
        ["计划统考", planMetric(project, "examPlanned")],
        ["统考录取人数", show(project.admission?.examAdmissions, " 人")],
        ["报录比", show(project.admission?.applicationRatio, "∶1")],
        ["复录比", show(project.admission?.interviewRatio, "∶1")],
        ["历年复试线", cutoff],
        ["录取中位数", show(project.admission?.median, " 分")],
        ["年学费", show(project.training?.tuitionPerYear, " 元/年")],
        ["学制", show(project.training?.durationYears, " 年")],
      ])}</section>
    <section class="panel">${sect("招生计划口径与原始资料")}
      <p>${esc(project.sharedPlan?.scope || project.annual.note)}</p>${sources(publishedSources(project))}
    </section>`;
}

function updatePreview(animate = false) {
  const body = $("#previewBody");
  body.innerHTML = preview(previewItems[previewIndex]);
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
  const items = getFiltered();
  const index = items.findIndex((project) => project.ref === id);
  if (index === -1) return;
  previewItems = items;
  previewIndex = index;
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
      [c.industry, c.summary, searchableSections(c)].join(" "),
    ]),
    ...news.map((n) => [
      "external",
      n.sources[0]?.url,
      n.title,
      n.sources[0]?.publisher,
    ]),
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
  for (const { row, text } of searchIndex) {
    if (text.includes(query)) matches.push(row);
    if (matches.length === 30) break;
  }
  searchResults.innerHTML =
    matches
      .map(
        ([type, id, title]) =>
          '<div class="listrow">' +
          (type === "external" ? out(id, title) : link(type, title, id)) +
          "</div>",
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
