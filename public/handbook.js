import { numbers } from "./admission-view.js";

const positionKey = "cs2028-handbook-position";
const weightedFormula = "综合成绩 = 初试成绩 ÷ 初试满分 × 初试权重 × 100 ＋ 复试成绩 ÷ 复试满分 × 复试权重 × 100";
const sumFormula = "综合成绩 = 初试成绩 ＋ 复试成绩";
const scoreFormat = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 });

function calculator() {
  const input = (name, label, value, min = 0, max = "") =>
    `<label>${label}<input id="handbook-score-${name}" name="${name}" type="number" inputmode="decimal" step="any" min="${min}" ${max ? `max="${max}"` : ""} value="${value}" required></label>`;
  return `<form class="handbook-calculator" data-handbook-calculator>
    <label>计算方式<select name="mode">
      <option value="weighted">百分制加权</option>
      <option value="sum">初复试成绩直接相加</option>
    </select></label>
    <div class="handbook-inputs">
      ${input("initial", "初试成绩", 380)}
      ${input("initialMax", "初试满分", 500, 0.01)}
      ${input("retest", "复试成绩", 86)}
      ${input("retestMax", "复试满分", 100, 0.01)}
    </div>
    <div class="handbook-inputs" data-handbook-weights>
      ${input("initialWeight", "初试权重（%）", 70, 0, 100)}
      ${input("retestWeight", "复试权重（%）", 30, 0, 100)}
    </div>
    <p data-handbook-formula>${weightedFormula}</p>
    <div class="handbook-result"><strong>综合成绩</strong><output for="handbook-score-initial handbook-score-initialMax handbook-score-retest handbook-score-retestMax handbook-score-initialWeight handbook-score-retestWeight" aria-live="polite"></output></div>
  </form>`;
}

function updateScore(form) {
  const fields = form.elements;
  const weighted = fields.mode.value === "weighted";
  const read = (name) => fields[name].valueAsNumber;
  const initial = read("initial");
  const initialMax = read("initialMax");
  const retest = read("retest");
  const retestMax = read("retestMax");
  const initialWeight = read("initialWeight");
  const retestWeight = read("retestWeight");
  form.querySelector("[data-handbook-weights]").hidden = !weighted;
  fields.initialWeight.disabled = fields.retestWeight.disabled = !weighted;
  form.querySelector("[data-handbook-formula]").textContent = weighted ? weightedFormula : sumFormula;
  fields.initial.max = Number.isFinite(initialMax) ? initialMax : "";
  fields.retest.max = Number.isFinite(retestMax) ? retestMax : "";
  const error = !form.checkValidity()
    ? "成绩须在 0 与对应满分之间，满分须大于 0，权重须在 0% 至 100% 之间。"
    : weighted && Math.abs(initialWeight + retestWeight - 100) > 0.000001
      ? "初试与复试权重之和须为 100%。"
      : "";
  const score = weighted
    ? initial / initialMax * initialWeight + retest / retestMax * retestWeight
    : initial + retest;
  form.querySelector("output").textContent = error || `${scoreFormat.format(score)} 分`;
}

export function createHandbook(chapters, { esc, link, table, projects, yearRef }) {
  const chapterFor = new Map(
    chapters.flatMap((chapter) => [chapter, ...chapter.sections].map(({ id }) => [id, chapter])),
  );
  const units = chapters.flatMap((chapter) => chapter.sections.length ? chapter.sections : [chapter]);
  const headingId = (id) => "handbook-" + id;
  const jump = (id, title) => link("handbook", title, id);
  const text = (value) => {
    if (value == null || value === "") return "—";
    const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|#[^\s)]+)\)/g;
    let start = 0;
    let result = "";
    for (const match of String(value).matchAll(pattern)) {
      const [, label, url] = match;
      result += esc(String(value).slice(start, match.index));
      result += `<a href="${esc(url)}"${url.startsWith("#") ? "" : ' target="_blank" rel="noopener noreferrer"'}>${esc(label)}</a>`;
      start = match.index + match[0].length;
    }
    return (result + esc(String(value).slice(start))).replaceAll("\n", "<br>");
  };
  const paragraph = (value) => value ? `<p>${text(value)}</p>` : "";
  const figure = (block, contents) => `<figure class="handbook-figure">
    <figcaption>${esc(block.title)}</figcaption>${paragraph(block.intro)}
    ${contents}${block.note ? `<p class="handbook-figure-note">${text(block.note)}</p>` : ""}
  </figure>`;
  const renderTable = (block) => figure(block, table(
    block.headers.map(esc),
    block.rows.map((row) => row.map(text)),
    "handbook-table",
  ));
  const renderTree = (block) => figure(block, `<ul class="handbook-tree">${block.branches
    .map(([branch, ...leaves]) => `<li><strong>${text(branch)}</strong>${leaves.length
      ? `<ul>${leaves.map((leaf) => `<li>${text(leaf)}</li>`).join("")}</ul>` : ""}</li>`).join("")}</ul>`);
  const renderSteps = (block) => figure(block, `<ol class="handbook-steps">${block.items
    .map(([title, ...paragraphs]) => `<li><strong>${text(title)}</strong>${paragraphs.map(paragraph).join("")}</li>`).join("")}</ol>`);
  const renderSequence = (block) => figure(block, `<ol class="handbook-sequence">${block.items
    .map(([title, note]) => `<li><strong>${text(title)}</strong>${paragraph(note)}</li>`).join("")}</ol>`);
  function renderGraph(block) {
    const { nodes, edges } = block;
    const description = edges.map(([from, to, label]) =>
      esc([nodes[from][2], label, nodes[to][2]].filter(Boolean).join(" → ")),
    ).join("。");
    const drawing = ({ size: [width, height], positions }, compact = false) => {
      const suffix = compact ? "compact" : "wide";
      const points = nodes.map(([x, y], index) => positions?.[index] || [x, y]);
      const halfWidth = (label) => compact ? 47 : Math.max(61, label.length * 8 + 12);
      const arrows = edges.map(([from, to, label]) => {
        const [ax, ay] = points[from];
        const [bx, by] = points[to];
        const side = ay === by;
        const x1 = side ? ax + halfWidth(nodes[from][2]) : ax;
        const x2 = side ? bx - halfWidth(nodes[to][2]) - 5 : bx;
        const y1 = side ? ay : ay + 20;
        const y2 = side ? by : by - 24;
        const bend = compact && block.compact.bends?.find(([start, end]) => start === from && end === to);
        const bendSide = bend?.[2] < ax ? -1 : 1;
        const route = bend
          ? `M${ax + bendSide * halfWidth(nodes[from][2])} ${ay} H${bend[2]} V${by} H${bx + bendSide * (halfWidth(nodes[to][2]) + 5)}`
          : `M${x1} ${y1} L${x2} ${y2}`;
        const labelY = side ? y1 - (compact ? 28 : 10) : (y1 + y2) / 2 + 9;
        const labelX = (x1 + x2) / 2 + (compact && !side ? (to % 2 ? 13 : -13) : 0);
        return `<path d="${route}" marker-end="url(#handbook-arrow-${suffix})"/>` +
          (label ? `<text class="handbook-edge-label" x="${labelX}" y="${labelY}">${esc(label)}</text>` : "");
      }).join("");
      const labels = nodes.map(([, , label], index) => {
        const [x, y] = points[index];
        const half = halfWidth(label);
        const split = label.includes("，") ? label.indexOf("，") + 1 : 5;
        const lines = compact && label.length > 7 ? [label.slice(0, split), label.slice(split)] : [label];
        return `<rect x="${x - half}" y="${y - 20}" width="${half * 2}" height="40" rx="4"/>
          <text y="${y - 7 * (lines.length - 1)}" dominant-baseline="central">${lines.map((line, i) =>
            `<tspan x="${x}" dy="${i ? "14" : "0"}">${esc(line)}</tspan>`).join("")}</text>`;
      }).join("");
      return `<svg class="handbook-flow handbook-flow--${suffix}" role="img"
        aria-labelledby="handbook-flow-title-${suffix} handbook-flow-paths-${suffix}" viewBox="0 0 ${width} ${height}">
        <title id="handbook-flow-title-${suffix}">${esc(block.title)}</title>
        <desc id="handbook-flow-paths-${suffix}">${description}</desc>
        <defs><marker id="handbook-arrow-${suffix}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>
        ${arrows}${labels}
      </svg>`;
    };
    return figure(block, drawing(block) + drawing(block.compact, true));
  }

  function njuPlan() {
    const project = projects.get(yearRef("nju-032-085405-01", 2027));
    if (!project) return "";
    const metric = numbers(project);
    return figure({ title: "南京大学软件学院 · 2027 年招生计划" },
      table(["专业", "计划招生人数", "实际推免人数", "预计统考名额"],
        [[link("project", project.majorId + " " + project.major.title, project.ref),
          ...[metric.planned, metric.promotionAdmissions, metric.estimatedExamPlanned].map(text)]],
        "handbook-table"));
  }

  function njuRetest() {
    const project = projects.get(yearRef("nju-033-085404-01", 2026));
    const detail = project?.admission?.interviewRequirements;
    if (!detail?.totalFormula) return "";
    return figure({ title: "南京大学计算机学院 · 2026 年计算机技术复试" },
      table(["专业", "笔试", "上机", "面试", "总成绩计算"],
        [[link("project", project.majorId + " " + project.major.title, project.ref),
          text([detail.writtenSubjects, detail.writtenMax + " 分", detail.writtenMinutes + " 分钟"].join(" · ")),
          text([detail.computerLanguages.join("、"), detail.computerTestMax + " 分", detail.computerTestMinutes + " 分钟"].join(" · ")),
          text((detail.oralMax ?? detail.interviewMax) + " 分"),
          text(detail.totalFormula)]],
        "handbook-table"));
  }

  const renderBlock = (block) => {
    if (typeof block === "string") return paragraph(block);
    if (block.type === "heading") {
      const tag = block.depth === 2 ? "h5" : "h4";
      return `<${tag}>${esc(block.text)}</${tag}>`;
    }
    return ({
      table: renderTable, tree: renderTree, steps: renderSteps,
      sequence: renderSequence, graph: renderGraph, calculator, "nju-plan": njuPlan, "nju-retest": njuRetest,
    })[block.type]?.(block) ?? "";
  };

  function pagination(unit) {
    const index = units.indexOf(unit);
    const adjacent = (item, label, side) => item
      ? `<span class="handbook-${side}"><small>${label}</small>${jump(item.id, item.title)}</span>` : "";
    return adjacent(units[index - 1], "上一篇", "previous") +
      adjacent(units[index + 1], "下一篇", "next");
  }

  function page(id) {
    const chapter = chapterFor.get(id) || chapters[0];
    const section = chapter.sections.find((item) => item.id === id);
    const unit = section || chapter.sections[0] || chapter;
    return `<div class="hero"><h1>考研指南</h1></div>
    <div class="handbook-layout">
      <details class="handbook-contents">
        <summary>章节目录</summary>
        <nav aria-label="考研指南章节目录">
          ${chapters.map((item) => item.sections.length
            ? `<details class="handbook-contents-chapter"${item === chapter ? " open" : ""}>
                <summary>${jump(item.id, item.title)}</summary>
                <ul>${item.sections.map((child) => `<li>${jump(child.id, child.title)}</li>`).join("")}</ul>
              </details>`
            : `<div class="handbook-contents-chapter handbook-contents-link">${jump(item.id, item.title)}</div>`).join("")}
        </nav>
      </details>
      <article class="handbook-article">
        <h2 id="${headingId(chapter.id)}" data-read-anchor="${chapter.id}">${esc(chapter.title)}</h2>
        ${chapter.blocks.map(renderBlock).join("")}
        ${chapter.sections.map((item) => `<section>
          <h3 id="${headingId(item.id)}" data-read-anchor="${item.id}">${esc(item.title)}</h3>
          ${item.blocks.map(renderBlock).join("")}
        </section>`).join("")}
        <nav class="handbook-pagination" data-handbook-pagination="${unit.id}" aria-label="上一篇与下一篇">
          ${pagination(unit)}
        </nav>
      </article>
    </div>`;
  }

  const strings = (value) => typeof value === "string"
    ? value.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    : Array.isArray(value)
      ? value.flatMap(strings).join(" ")
      : value && typeof value === "object"
        ? Object.entries(value).filter(([key]) => key !== "type").map(([, item]) => strings(item)).join(" ")
        : "";

  function readPosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(positionKey));
      if (saved && chapterFor.has(saved.id) && Number.isFinite(saved.offset)) return saved;
    } catch {
      // Reading works with local storage disabled.
    }
    return null;
  }

  function updatePosition(root, save = true) {
    const anchors = [...root.querySelectorAll("[data-read-anchor]")];
    if (!anchors.length) return;
    const contents = root.querySelector(".handbook-contents");
    const mobile = !matchMedia("(min-width: 901px)").matches;
    const threshold = mobile ? 96 : 74;
    if (mobile && contents.open && save) return;
    const last = anchors.at(-1);
    const atEnd = scrollY > 0 && scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
    const anchor = atEnd && last.getBoundingClientRect().top < innerHeight / 2
      ? last
      : anchors.findLast((item) => item.getBoundingClientRect().top <= threshold) || anchors[0];
    const id = anchor.dataset.readAnchor;
    root.querySelectorAll(".handbook-contents nav a").forEach((item) => {
      if (item.hash === "#handbook/" + id) {
        item.setAttribute("aria-current", "location");
      } else {
        item.removeAttribute("aria-current");
      }
    });
    const chapter = chapterFor.get(id);
    const unit = units.find((item) => item.id === id) || chapter.sections[0] || chapter;
    const pager = root.querySelector("[data-handbook-pagination]");
    if (pager.dataset.handbookPagination !== unit.id) {
      pager.innerHTML = pagination(unit);
      pager.dataset.handbookPagination = unit.id;
    }
    if (!save) return;
    try {
      localStorage.setItem(positionKey, JSON.stringify({ id, offset: -anchor.getBoundingClientRect().top }));
    } catch {
      // Reading works with local storage disabled.
    }
  }

  function mount(root, id, { top, saved }) {
    const contents = root.querySelector(".handbook-contents");
    const wide = matchMedia("(min-width: 901px)");
    contents.open = wide.matches;
    const form = root.querySelector("[data-handbook-calculator]");
    if (form) {
      form.addEventListener("submit", (event) => event.preventDefault());
      form.addEventListener("input", () => updateScore(form));
      updateScore(form);
    }
    if (Number.isFinite(top)) {
      scrollTo(0, top);
    } else {
      const anchor = document.getElementById(headingId(id));
      if (anchor && saved?.id === id) {
        scrollTo(0, scrollY + anchor.getBoundingClientRect().top + saved.offset);
      } else if (anchor && !chapters.some((chapter) => chapter.id === id)) {
        anchor.scrollIntoView();
      } else {
        scrollTo(0, 0);
      }
    }
    updatePosition(root, false);
  }

  return {
    first: chapters[0].id,
    has: (id) => chapterFor.has(id),
    page, mount, readPosition, updatePosition,
    searchRows: () => units.map((unit) => {
      const chapter = chapterFor.get(unit.id);
      return [
        "handbook",
        unit.id,
        ["考研指南", chapter.title, unit === chapter ? "" : unit.title].filter(Boolean).join(" · "),
        strings(unit.blocks),
      ];
    }),
  };
}
