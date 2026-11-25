import { majors, careers, topics } from "./content.js";
const $ = (s) => document.querySelector(s),
  main = $("#main");
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
let state = { fav: [], comp: [], plans: [], notes: {}, city: "", ...read() },
  schools = [],
  projects = [],
  news = [],
  trends = {},
  page,
  arg,
  filters = { q: "", city: "", combo: "", year: "", view: "招生项目" };
function notify(s) {
  $("#notice").textContent = s;
  clearTimeout(notify.t);
  notify.t = setTimeout(() => ($("#notice").textContent = ""), 2200);
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
          esc(b || "暂未取得") +
          "</dd></div>",
      )
      .join("") +
    "</dl>"
  );
}
function button(action, t, val = "", cl = "") {
  return (
    '<button class="' +
    cl +
    '" data-action="' +
    action +
    '" data-id="' +
    esc(val) +
    '">' +
    esc(t) +
    "</button>"
  );
}
function fav(p, id) {
  return button(
    "fav",
    state.fav.includes(p + "/" + id) ? "取消收藏" : "收藏",
    p + "/" + id,
  );
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
function table(cols, rows) {
  return (
    '<div class="scroll"><table><thead><tr>' +
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
function projectTable(arr) {
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
          link("project", "查看 →", p.id),
        ]),
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
function getFiltered() {
  let q = filters.q
    .trim()
    .toLowerCase()
    .replace(/武大/g, "武汉大学")
    .replace(/华科/g, "华中科技大学");
  return (filters.view === "院校名录" ? schools : projects).filter(
    (p) =>
      (!filters.city || p.city === filters.city) &&
      [
        p.name,
        p.school,
        p.college,
        p.code,
        p.major,
        p.campus,
        p.city,
        p.province,
        p.combo,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q) &&
      (filters.view === "院校名录" ||
        ((!filters.combo || p.combo === filters.combo) &&
          (!filters.year || String(p.year) === filters.year))),
  );
}
function results() {
  let arr = getFiltered();
  return (
    '<div class="section"><b>' +
    esc(filters.view) +
    " · " +
    arr.length +
    " 条</b>" +
    button("exportList", "导出结果") +
    "</div>" +
    (filters.view === "院校名录"
      ? arr.length
        ? table(
            ["院校", "省份", "城市", "已收录项目"],
            arr.map((s) => [
              link("school", s.name, s.name),
              esc(s.province),
              esc(s.city),
              String(projects.filter((p) => p.school === s.name).length),
            ]),
          )
        : empty("没有符合条件的院校。")
      : projectTable(arr))
  );
}
function directory() {
  return (
    heading("院校数据库") +
    '<div class="actions">' +
    ["招生项目", "院校名录"]
      .map((t) => button("view", t, t, filters.view === t ? "btn" : ""))
      .join("") +
    '</div><div class="filters"><label>关键词<input id="filterQ" placeholder="学校、学院或专业" value="' +
    esc(filters.q) +
    '"></label><label>城市<select id="city">' +
    opts([...new Set(schools.map((x) => x.city))], filters.city) +
    "</select></label>" +
    (filters.view === "招生项目"
      ? '<label>考试组合<select id="combo">' +
        opts(["11408", "12408", "21408", "22408"], filters.combo) +
        '</select></label><label>招生年度<select id="year">' +
        opts(
          [...new Set(projects.map((p) => p.year).concat([2028]))],
          filters.year,
        ) +
        "</select></label>"
      : "") +
    button("clear", "重置") +
    button("saveFilter", "保存筛选") +
    (state.filters ? button("loadFilter", "恢复筛选") : "") +
    '</div><div id="results">' +
    results() +
    "</div>"
  );
}
const compBtn = (id) =>
  button("comp", state.comp.includes(id) ? "移出对比" : "加入对比", id);
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
    projectTable(projects.filter((p) => p.school === s.name)) +
    '<p class="source">名录来源 · ' +
    out(s.source, "教育部") +
    "</p>"
  );
}
function compare() {
  let items = state.comp
    .map((id) => projects.find((p) => p.id === id))
    .filter(Boolean);
  return (
    heading("院校对比", "选择 2—5 个招生项目，按相应年度并列查看。") +
    '<div class="filters"><label>添加招生项目<select id="addProject">' +
    '<option value="">选择项目</option>' +
    projects
      .filter((p) => !state.comp.includes(p.id))
      .map(
        (p) =>
          '<option value="' +
          esc(p.id) +
          '">' +
          esc(
            [p.school, p.college, p.major, p.direction, p.year]
              .filter(Boolean)
              .join(" · "),
          ) +
          "</option>",
      )
      .join("") +
    "</select></label></div>" +
    (items.length
      ? table(
          ["比较指标", ...items.map((p) => link("project", p.school, p.id))],
          [
            ...Object.entries({
              year: "招生年度",
              college: "招生学院",
              major: "招生专业",
              code: "专业代码",
              campus: "培养地点",
              combo: "考试组合",
              admitted: "统考录取人数",
              cutoff: "复试线",
              tuition: "学费",
            }).map(([k, t]) => [
              t,
              ...items.map((p) => esc(p[k] || "暂未取得")),
            ]),
            ["原始文件", ...items.map(source)],
            ["操作", ...items.map((p) => compBtn(p.id))],
          ],
        )
      : empty("尚未选择项目。可从上方添加，或在招生项目详情中加入对比。")) +
    (items.length >= 2
      ? '<div class="actions">' +
        button("savePlan", "保存此方案") +
        button("exportComp", "导出对比") +
        "</div>"
      : "") +
    (new Set(items.map((p) => p.combo)).size > 1
      ? "<p>各项目考试组合不同，原始分数的可比性有限。</p>"
      : "") +
    sect("已保存方案") +
    (state.plans
      .map(
        (p, i) =>
          '<div class="listrow">' +
          esc(
            p
              .map((id) => projects.find((x) => x.id === id)?.school)
              .join(" / "),
          ) +
          button("plan", "载入方案", i) +
          "</div>",
      )
      .join("") || empty("暂无已保存方案。"))
  );
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
function decision() {
  return (
    heading("择校决策", "按已核实的项目字段筛选候选院校。") +
    '<div class="filters"><label>意向城市<select id="prefCity">' +
    opts([...new Set(schools.map((s) => s.city))], state.city, "不限城市") +
    '</select></label><label>考试组合<select id="prefCombo">' +
    opts(["11408", "12408", "21408", "22408"], state.wantCombo, "不限组合") +
    "</select></label>" +
    button("pref", "保存条件", "", "btn") +
    "</div>" +
    sect(
      "候选项目 · " + matches().length,
      button("exportCandidates", "导出清单"),
    ) +
    '<p class="small">当前条件 · ' +
    esc(state.city || "不限城市") +
    " / " +
    esc(state.wantCombo || "不限组合") +
    "</p>" +
    projectTable(matches())
  );
}
function lookup(key) {
  const [p, id] = key.split("/");
  return p === "project"
    ? projects.find((x) => x.id === id)?.school +
        " · " +
        (projects.find((x) => x.id === id)?.major || "")
    : p === "major"
      ? majors.find((m) => m[0] === id)?.[1]
      : id;
}
function saved() {
  return (
    heading("我的收藏") +
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
      empty("尚无收藏。可在院校、招生项目、专业和职业详情页添加。"))
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
    school: () => school(schools.find((s) => s.name === arg)),
    project: () => detail(projects.find((p) => p.id === arg)),
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
    main.innerHTML = pages[page]();
    document.title =
      (main.querySelector("h1")?.textContent || "首页") + " · CS 2028";
  } catch (e) {
    console.error(e);
    main.innerHTML = heading("未找到该记录") + link("home", "返回首页");
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
function act(a, id) {
  switch (a) {
    case "view":
      filters.view = id;
      break;
    case "fav":
      state.fav = toggle(state.fav, id);
      save();
      break;
    case "comp":
      if (!state.comp.includes(id) && state.comp.length >= 5)
        return notify("最多可选择 5 个项目");
      state.comp = toggle(state.comp, id);
      save();
      break;
    case "plan":
      state.comp = [...state.plans[Number(id)]];
      save();
      break;
    case "savePlan":
      if (
        !state.plans.some(
          (p) => JSON.stringify(p) === JSON.stringify(state.comp),
        )
      )
        state.plans.push([...state.comp]);
      if (save()) notify("已保存比较方案");
      break;
    case "saveFilter":
      state.filters = { ...filters };
      if (save()) notify("已保存筛选条件");
      break;
    case "loadFilter":
      filters = { ...state.filters };
      break;
    case "clear":
      filters = { view: filters.view, q: "", city: "", combo: "", year: "" };
      break;
    case "pref":
      state.city = $("#prefCity").value;
      state.wantCombo = $("#prefCombo").value;
      if (save()) notify("已保存择校条件");
      break;
    case "backup":
      return download("CS2028-个人备份", { version: 1, state });
    case "exportComp":
      return download(
        "CS2028-项目对比",
        projects.filter((p) => state.comp.includes(p.id)),
      );
    case "exportList":
      return download("CS2028-筛选结果", getFiltered());
    case "exportCandidates":
      return download("CS2028-候选项目", matches());
  }
  render();
}
let pointerDestination = "";
document.addEventListener("click", (e) => {
  const anchor = e.target.closest("a");
  if (anchor?.classList.contains("skip")) {
    e.preventDefault();
    main.focus();
    return;
  }
  pointerDestination =
    e.detail > 0 &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.shiftKey &&
    !e.altKey &&
    anchor?.getAttribute("href")?.startsWith("#") &&
    anchor.hash !== location.hash
      ? anchor.hash
      : "";
  const b = e.target.closest("[data-action]");
  if (b) act(b.dataset.action, b.dataset.id);
  if (
    document.body.classList.contains("open") &&
    !e.target.closest("#menu") &&
    (!e.target.closest("#rail") || e.target.closest("a"))
  )
    document.body.classList.remove("open");
});
document.addEventListener("input", (e) => {
  if (e.target.id === "filterQ") {
    filters.q = e.target.value;
    $("#results").innerHTML = results();
  }
});
function validState(v) {
  const strings = (a) =>
      Array.isArray(a) && a.every((x) => typeof x === "string"),
    ids = (a) =>
      strings(a) &&
      a.length <= 5 &&
      a.every((id) => projects.some((p) => p.id === id));
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
  if (["year", "city", "combo"].includes(t.id)) {
    filters[t.id] = t.value;
    $("#results").innerHTML = results();
  }
  if (t.dataset.note) {
    state.notes[t.dataset.note] = t.value;
    if (save()) notify("已保存备注");
  }
  if (t.id === "addProject" && t.value) {
    act("comp", t.value);
  }
  if (t.id === "restore" && t.files.length) {
    try {
      const doc = JSON.parse(await t.files[0].text());
      if (doc.version !== 1 || !validState(doc.state)) throw Error();
      if (confirm("用所选备份替换当前个人设置？")) {
        state = doc.state;
        if (save()) notify("已恢复备份");
        render();
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
$("#menu").onclick = () => document.body.classList.toggle("open");
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
  const q = $("#searchInput")
    .value.trim()
    .replace(/武大/g, "武汉大学")
    .replace(/华科/g, "华中科技大学");
  $("#searchResults").innerHTML = q
    ? searchRows()
        .filter((r) => r[2].includes(q))
        .map(
          ([p, id, t]) =>
            '<div class="listrow">' +
            (p === "external" ? out(id, t) : link(p, t, id)) +
            "</div>",
        )
        .join("") || empty("没有匹配的记录。")
    : "";
}
function openSearch() {
  $("#searchDialog").showModal();
  $("#searchInput").focus();
  search();
}
$("#searchOpen").onclick = openSearch;
$("#searchInput").oninput = search;
$("#closeSearch").onclick = () => $("#searchDialog").close();
$("#searchResults").onclick = (e) => {
  if (e.target.closest("a")) $("#searchDialog").close();
};
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (!$("#searchDialog").open) openSearch();
  }
  if (e.key === "Escape") document.body.classList.remove("open");
});
const positions = new Map();
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
let previous = "";
let pageEntrance;
function navigate() {
  const raw = location.hash.slice(1) || "home";
  if (raw === previous) {
    pointerDestination = "";
    return;
  }
  const animate =
    previous && pointerDestination === location.hash && !reduceMotion.matches;
  pointerDestination = "";
  pageEntrance?.cancel();
  if (previous) positions.set(previous, scrollY);
  const [p, v = ""] = raw.split("/");
  page = p;
  try {
    arg = decodeURIComponent(v);
  } catch {
    arg = "";
  }
  previous = raw;
  updateNavigation();
  render();
  main.focus({ preventScroll: true });
  scrollTo(0, positions.get(raw) || 0);
  if (animate) {
    pageEntrance = main.animate([{ opacity: 0.72 }, { opacity: 1 }], {
      duration: 150,
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
    });
  }
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
    navigate();
    window.addEventListener("hashchange", navigate);
  } catch {
    main.innerHTML =
      heading("数据库读取失败") + '<button id="retry">重新读取</button>';
    $("#retry").onclick = start;
  }
}
mountNavigation();
start();
