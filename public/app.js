import {
  cancelPageEntrance,
  playPageEntrance,
  revealUpdate,
} from "./motion.js";
import { majors, careers, topics } from "./content.js";
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
const out = (url, t) =>
  '<a href="' +
  esc(url) +
  '" target="_blank" rel="noopener noreferrer">' +
  esc(t) +
  " ↗</a>";
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
let schools, projects, news, trends, page, arg;
let filters = { ...defaultFilters, ...browserState.filters };
let listPage = browserState.listPage || 1;
let schoolByName,
  projectById,
  projectsBySchool,
  indexedSchools,
  indexedProjects,
  searchIndex;
let cities, years;
const combos = ["11408", "12408", "21408", "22408"];
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
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/武大/g, "武汉大学")
    .replace(/华科/g, "华中科技大学");
}

function indexData() {
  schoolByName = new Map(schools.map((school) => [school.name, school]));
  projectById = new Map(projects.map((project) => [project.id, project]));
  projectsBySchool = new Map();
  for (const project of projects) {
    if (!projectsBySchool.has(project.school))
      projectsBySchool.set(project.school, []);
    projectsBySchool.get(project.school).push(project);
  }
  cities = [
    ...new Set(
      [...schools, ...projects].map(({ city }) => city).filter(Boolean),
    ),
  ];
  years = [...new Set(projects.map(({ year }) => String(year)).concat("2028"))]
    .sort()
    .reverse();
  indexedSchools = schools.map((record) => ({
    record,
    text: normalizeQuery([record.name, record.city, record.province].join(" ")),
  }));
  indexedProjects = projects.map((record) => ({
    record,
    text: normalizeQuery(
      [
        record.school,
        record.college,
        record.code,
        record.major,
        record.campus,
        record.city,
        record.province,
        record.combo,
        record.direction,
      ].join(" "),
    ),
  }));
  searchIndex = searchRows().map((row) => ({
    row,
    text: normalizeQuery(row[2]),
  }));
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
const source = (p) => out(p.source, p.title || "招生原文");
function projectTable(arr, quickPreview = false) {
  return arr.length
    ? table(
        ["学校 / 招生学院", "招生专业", "考试组合", "年度", "详情"],
        arr.map((p) => [
          link("project", p.school, p.id) +
            "<small>" +
            esc(p.college) +
            "</small>",
          esc(p.major) + '<small class="mono">' + esc(p.code) + "</small>",
          '<span class="mono">' + esc(p.combo || "待核实") + "</span>",
          esc(p.year),
          quickPreview
            ? button("preview", "快速预览", p.id)
            : link("project", "查看 →", p.id),
        ]),
        "project-table",
      )
    : empty("此条件下暂无已收录项目。");
}
function notices(arr) {
  return (
    arr
      .map(
        (n) =>
          '<div class="listrow"><div><small>' +
          esc(n.publisher) +
          "</small><br>" +
          out(n.source, n.title) +
          "</div><time>" +
          esc(n.date) +
          "</time></div>",
      )
      .join("") || empty("暂无符合条件的公告。")
  );
}
function chart() {
  const rows = trends.series.slice(-7);
  if (!rows.length) return empty("暂无报名数据。");

  const step = Math.max(
    50,
    Math.ceil(Math.max(...rows.map((row) => row.value)) / 150) * 50,
  );
  const points = rows.map((row, index) => ({
    ...row,
    x:
      rows.length === 1
        ? 50
        : 6 +
          (88 * (row.year - rows[0].year)) / (rows.at(-1).year - rows[0].year),
    y: 100 - (row.value / (3 * step)) * 100,
    latest: index === rows.length - 1,
  }));
  const summary = rows
    .map(({ year, value }) => `${year} 年 ${value} 万人`)
    .join("，");

  return `
    <div class="small">报名人数（万人）</div>
    <div class="chartframe" role="img" aria-label="${esc(summary)}">
      <div class="chart-axis" aria-hidden="true">
        ${[3, 2, 1, 0].map((tick) => `<span>${tick * step}</span>`).join("")}
      </div>
      <div class="chart-plot" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          <polyline points="${points.map(({ x, y }) => `${x},${y}`).join(" ")}" vector-effect="non-scaling-stroke"/>
        </svg>
        ${points
          .map(
            ({ x, y, value, year, latest }) => `
          <span class="chart-point${latest ? " latest" : ""}" style="left:${x}%;top:${y}%">
            <span class="chart-value">${esc(value)}</span>
          </span>
          <time style="left:${x}%">${esc(year)}</time>
        `,
          )
          .join("")}
      </div>
    </div>
    <p class="source">全国硕士研究生招生考试报名人数 · ${link("trend", "查看统计来源 ↗")}</p>`;
}
function home() {
  const days = Math.max(
      0,
      Math.ceil(
        (Date.UTC(2027, 11, 1) -
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
    '<div class="eyebrow"><i class="dot"></i>2028 届 · 硕士研究生招生</div><div class="hero"><div><h1>计算机考研总览</h1><p>全日制计算机类专业硕士 · 985 高校 · 408 统考</p></div><span class="update">资料核验于 <time>2026.11.25</time></span></div><div class="stats">' +
    stat("距离预计初试月", days, "天", "按 2027 年 12 月 1 日估算") +
    stat("院校名录", schools.length, "所", "全国 985 高校") +
    stat("已收录招生项目", projects.length, "项", "按学院、专业及年度区分") +
    stat("个人收藏", state.fav.length, "项", "院校、项目、专业及职业") +
    '</div><div class="columns"><section class="panel">' +
    sect("全国考研报名趋势", link("trend", "历年数据 →")) +
    chart() +
    '</section><section class="panel">' +
    sect("报考目标") +
    facts([
      ["目标届别", "2028 届"],
      ["预计初试", "2027 年 12 月"],
      ["预计入学", "2028 年 9 月"],
    ]) +
    link("decide", "设置择校条件 →", "", "jump") +
    '</section></div><section class="panel">' +
    sect("院校招生项目", link("schools", "进入院校数据库 →")) +
    projectTable(projects.slice(0, 4)) +
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
          ((!combo || record.combo === combo) &&
            (!year || String(record.year) === year))),
    )
    .map(({ record }) => record);
  if (sort === "school") {
    rows.sort((a, b) =>
      collator.compare(a.name || a.school, b.name || b.school),
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
      link("school", school.name, school.name),
      esc(school.province),
      esc(school.city),
      String(projectsBySchool.get(school.name)?.length || 0),
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

function detail(p) {
  return (
    heading(p.school + " · " + p.major, p.college) +
    '<div class="actions">' +
    fav("project", p.id) +
    compBtn(p.id) +
    link("compare", "查看对比", "", "button") +
    '</div><div class="columns"><section class="panel">' +
    sect("招生项目") +
    facts([
      ["招生年度", p.year],
      ["研究方向", p.direction],
      ["学位及学习方式", [p.degree, p.studyMode].filter(Boolean).join(" · ")],
      ["实际培养地点", p.campus],
      ["招生专业", p.code + " " + p.major],
      ["考试组合", p.combo],
      ["初试科目", p.subjects],
      ["资料核验日期", p.verifiedOn],
    ]) +
    '</section><section class="panel">' +
    sect("录取与培养信息") +
    facts([
      ["统考录取人数", p.admitted],
      ["复试分数线", p.cutoff],
      ["录取中位数", p.median],
      ["学费", p.tuition],
    ]) +
    "</section></div><section>" +
    sect("招生计划口径与原始文件") +
    '<p class="article">' +
    esc(p.description) +
    '</p><p class="source">' +
    source(p) +
    '</p></section><div class="actions">' +
    link("school", "院校档案 →", p.school, "button") +
    (majors.some((m) => m[0] === p.code)
      ? link("major", "专业详情 →", p.code, "button")
      : "") +
    "</div>"
  );
}
function school(s) {
  return (
    heading(s.name, s.province + " · " + s.city) +
    '<div class="actions">' +
    fav("school", s.name) +
    "</div>" +
    sect("已收录招生项目") +
    projectTable(projectsBySchool.get(s.name) || []) +
    '<p class="source">名录来源 · ' +
    out(s.source, "教育部") +
    "</p>"
  );
}
function compareOptions() {
  return (
    '<option value="">选择项目</option>' +
    projects
      .filter((project) => !state.comp.includes(project.id))
      .map(
        (project) =>
          `<option value="${esc(project.id)}">${esc(
            [
              project.school,
              project.college,
              project.major,
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
  const metrics = {
    year: "招生年度",
    college: "招生学院",
    major: "招生专业",
    code: "专业代码",
    campus: "培养地点",
    combo: "考试组合",
    admitted: "统考录取人数",
    cutoff: "复试线",
    tuition: "学费",
  };
  return (
    table(
      [
        "比较指标",
        ...items.map((project) => link("project", project.school, project.id)),
      ],
      [
        ...Object.entries(metrics).map(([key, title]) => [
          title,
          ...items.map(
            (project) => esc(project[key] ?? "暂未取得") || "暂未取得",
          ),
        ]),
        ["原始文件", ...items.map(source)],
        ["操作", ...items.map((project) => compBtn(project.id))],
      ],
      "compare-table",
    ) +
    (new Set(items.map((project) => project.combo)).size > 1
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
              .map((id) => projectById.get(id)?.school)
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

function major(m) {
  return (
    heading(m[1], m[0] + " · " + m[2]) +
    '<div class="actions">' +
    fav("major", m[0]) +
    '</div><div class="article"><section>' +
    sect("专业与研究方向") +
    facts([
      ["培养内容", m[3]],
      ["能力基础", m[4]],
    ]) +
    "</section><section>" +
    sect("关联职业") +
    m[5]
      .split("、")
      .map((n) => '<div class="listrow">' + link("job", n + " →", n) + "</div>")
      .join("") +
    "</section></div><section>" +
    sect("已收录招生项目") +
    projectTable(projects.filter((p) => p.code === m[0])) +
    "</section>"
  );
}
function job(c) {
  return (
    heading(c[0], c[3]) +
    '<div class="actions">' +
    fav("job", c[0]) +
    '</div><div class="article">' +
    sect("工作内容") +
    "<p>" +
    c[1] +
    "</p>" +
    facts([
      ["技术基础", c[2]],
      ["岗位薪资统计", "暂未取得"],
    ]) +
    "<section>" +
    sect("相关研究生专业") +
    majors
      .filter((m) => m[5].split("、").includes(c[0]))
      .map(
        (m) =>
          '<div class="listrow">' +
          link("major", m[0] + " " + m[1] + " →", m[0]) +
          "</div>",
      )
      .join("") +
    "</section></div>"
  );
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
  return projects.filter(
    (p) =>
      (!state.city || p.city === state.city) &&
      (!state.wantCombo || p.combo === state.wantCombo),
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
  return p === "project"
    ? projectById.get(id)?.school + " · " + (projectById.get(id)?.major || "")
    : p === "major"
      ? majors.find((m) => m[0] === id)?.[1]
      : id;
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
      ["资料核验日期", "2026-11-25"],
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
        (t, i) =>
          '<section id="topic' +
          i +
          '" class="panel">' +
          sect(t[0]) +
          "<h3>" +
          t[1] +
          "</h3><p>" +
          t[2] +
          "</p></section>",
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
    school: () => school(schoolByName.get(arg)),
    project: () => detail(projectById.get(arg)),
    majors: () =>
      heading("专业探索") +
      grid(majors.map((m) => [m[0] + " · " + m[2], m[1], m[3], "major", m[0]])),
    major: () => major(majors.find((m) => m[0] === arg)),
    jobs: () =>
      heading("就业发展") +
      grid(careers.map((c) => [c[3], c[0], c[1], "job", c[0]])),
    job: () => job(careers.find((c) => c[0] === arg)),
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
            link("school", "关联院校 · " + n.school + " →", n.school, "jump"),
        )
        .join(""),
    trend: () =>
      heading("全国考研报名人数", trends.scope) +
      table(
        ["招生年度", "报名人数（万人）", "资料来源"],
        [...trends.series]
          .reverse()
          .map((r) => [r.year, r.value, out(r.sourceUrl, r.sourceTitle)]),
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
        projects.filter((project) => state.comp.includes(project.id)),
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
  const cutoff =
    project.history
      ?.filter(({ cutoff }) => cutoff != null)
      .map(({ year, cutoff }) => `${year} 届 ${cutoff}`)
      .join(" / ") || project.cutoff;
  return `<h2 id="previewTitle" tabindex="-1">${esc(project.school)}</h2>
    <p class="preview-college">${esc(project.college)}</p>
    <div class="actions">${fav("project", project.id)}${compBtn(project.id)}
      ${link("project", "查看完整详情", project.id, "button btn")}
    </div>
    <section class="panel">${sect("招生信息")}
      ${facts([
        ["专业", `${project.code} ${project.major}`],
        ["研究方向", project.direction],
        ["招生年度", project.year],
        ["考试组合", project.combo],
        ["招生计划", project.planned],
        ["统考录取人数", project.admitted],
        ["报录比", project.applicationRatio],
        ["复录比", project.interviewRatio],
        ["历年复试线", cutoff],
        ["录取中位数", project.median],
        ["学费", project.tuition],
        ["学制", project.duration],
      ])}
    </section>
    <section class="panel">${sect("招生计划口径与原始资料")}
      <p>${esc(project.description)}</p><p class="source">${source(project)}</p>
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
  const index = items.findIndex((project) => project.id === id);
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

function searchRows() {
  return [
    ...schools.map((s) => ["school", s.name, s.name + " · " + s.city]),
    ...projects.map((p) => [
      "project",
      p.id,
      [p.school, p.college, p.major, p.code, p.combo, p.year].join(" · "),
    ]),
    ...majors.map((m) => ["major", m[0], m[0] + " · " + m[1]]),
    ...careers.map((c) => ["job", c[0], c[0]]),
    ...news.map((n) => ["external", n.source, n.title]),
    ...topics.map((t) => ["guide", "", t[0] + " · " + t[1]]),
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
  scrollTo(0, destinationScroll);
  if (shouldAnimate) playPageEntrance(pageContent);
}

async function start() {
  try {
    [schools, projects, news, trends] = await Promise.all(
      ["schools", "projects", "news", "trends"].map(async (k) => {
        const r = await fetch(k + ".json");
        if (!r.ok) throw Error(k);
        return r.json();
      }),
    );
    indexData();
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
