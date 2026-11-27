import { annualChart } from "../admission-charts.js";
import { recordId, scoreReport, subjectHistory, subjects, validateIndex, validateReport } from "./model.mjs";

const folder = "./data/exam-reports/";
const decimal = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
const format = (value) => decimal.format(value);
const percent = (value) => `${(value * 100).toFixed(1).replace(/\.0$/, "")}%`;
const ratio = (score, max) => `${format(score)} / ${format(max)}`;
const answerText = (value) => (Array.isArray(value) ? value.join("、") : value.trim()) || "未作答";

async function read(file) {
  const response = await fetch(folder + file + ".json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export function createPrepViews({ esc, heading, sect, link, table, empty }) {
  let indexRequest;
  const reports = new Map();
  const getIndex = () => {
    indexRequest ??= read("index").then(validateIndex).catch((error) => {
      indexRequest = undefined;
      throw error;
    });
    return indexRequest;
  };
  function getReport(id) {
    if (!reports.has(id)) {
      reports.set(id, read(id).then(validateReport).then((report) => {
        if (report.id !== id) throw new Error("考试记录编号不一致");
        return { report, scores: scoreReport(report) };
      }).catch((error) => {
        reports.delete(id);
        throw error;
      }));
    }
    return reports.get(id);
  }

  function metrics(entries) {
    return `<dl class="prep-metrics">${entries.map(([label, value]) =>
      `<div><dt>${esc(label)}</dt><dd class="num">${esc(value)}</dd></div>`
    ).join("")}</dl>`;
  }

  function paragraphs(value, language = "") {
    return (Array.isArray(value) ? value : [value]).filter(Boolean).map((p) =>
      `<p${language ? ` lang="${esc(language)}"` : ""}>${esc(p)}</p>`
    ).join("");
  }

  function bars(title, rows, { scale, label, unit = "" }) {
    return `<figure class="admission-chart prep-bars">
      <figcaption><strong>${esc(title)}</strong><span>${esc(unit)}</span></figcaption>
      <ul>${rows.map((row) => `<li>
        <span>${esc(row.title)}</span>
        <span class="prep-bar-track" aria-hidden="true"><span style="width:${Math.min(100, Math.max(0, scale(row) * 100))}%"></span></span>
        <span class="num">${esc(label(row))}</span>
      </li>`).join("")}</ul>
    </figure>`;
  }

  function history(entries) {
    return heading("备考记录") + Object.entries(subjects).map(([code, subject]) => {
      const { ordered, latest, highest, average } = subjectHistory(
        entries.filter(({ report }) => report.subjectCode === code),
      );
      if (!ordered.length) return `<section class="panel">${sect(subject.name)}${empty("暂无记录")}</section>`;
      const trend = ordered.length < 2 ? "" : annualChart(
        "成绩趋势", "分", ordered.map(({ report, scores }) => ({
          label: report.recordDate.slice(2),
          labelDetail: report.recordDate + (report.attempt > 1 ? ` · 第 ${report.attempt} 次` : ""),
          score: scores.score,
        })), [["score", "总成绩"]],
      );
      return `<section class="panel">${sect(subject.name)}
        ${metrics([
          ["已完成试卷", `${ordered.length} 份`], ["最近成绩", ratio(latest, subject.max)],
          ["历史最高", ratio(highest, subject.max)], ["平均成绩", ratio(average, subject.max)],
        ])}
        ${trend ? `<div class="prep-trend">${trend}</div>` : ""}
        ${table(["试卷名称", "作答日期", "总成绩", "客观题错题"], [...ordered].reverse().map(({ report, scores }) => [
          link("prep", report.title, report.id) + (report.attempt > 1 ? `<small>第 ${format(report.attempt)} 次作答</small>` : ""),
          `<time datetime="${esc(report.recordDate)}">${esc(report.recordDate)}</time>`,
          ratio(scores.score, scores.max), `${scores.incorrect} 题`,
        ]), "prep-records")}
      </section>`;
    }).join("");
  }

  function overview(scores) {
    const { sections, objective, subjective } = scores;
    return `<section class="panel">${sect("成绩总览")}
      ${metrics([
        ["总成绩", ratio(scores.score, scores.max)],
        ...(objective.max ? [["客观题", ratio(objective.score, objective.max)]] : []),
        ...(subjective.max ? [["主观题", ratio(subjective.score, subjective.max)]] : []),
        ...(scores.count ? [["客观题正确率", `${percent(scores.accuracy)}（${scores.correct}/${scores.count}）`]] : []),
      ])}
      <div class="prep-score-grid">
        ${table(["题型", "得分", "满分", "失分", "得分率", "错题题号"],
          sections.map((s) => [
            esc(s.title), format(s.score), format(s.max), format(s.loss), percent(s.score / s.max), s.wrong.join("、") || "—",
          ]), "prep-section-scores")}
        ${bars("各题型得分", sections, {
          scale: (s) => s.score / s.max, label: (s) => ratio(s.score, s.max), unit: "得分 / 满分",
        })}
      </div>
    </section>`;
  }

  function answers(report, scores) {
    if (!scores.count) return "";
    const wrong = new Set(scores.sections.flatMap((s) => s.wrong));
    const questions = new Map(report.questions.map((q) => [q.number, q]));
    const groups = report.sections.filter((s) => s.type === "objective").map((s) => {
      const items = s.questionNumbers.map((n) => {
        const q = questions.get(n);
        const incorrect = wrong.has(n);
        const opening = incorrect ? `<button type="button" data-prep-question="${n}"` : "<div";
        return `<li${incorrect ? "" : " data-prep-correct"}>${opening} class="prep-answer ${incorrect ? "is-wrong" : "is-correct"}">
          <span class="prep-answer-heading"><strong>第 ${n} 题</strong><span>${incorrect ? "错误" : "正确"}</span></span>
          <span>作答 <b>${esc(answerText(q.answer))}</b></span>
          <span>答案 <b>${esc(answerText(q.correctAnswer))}</b></span>
        ${incorrect ? "</button>" : "</div>"}</li>`;
      }).join("");
      return `<div class="prep-answer-group" data-prep-answer-group${s.questionNumbers.some((n) => wrong.has(n)) ? "" : ' data-no-wrong'}>
        <h3>${esc(s.title)}</h3><ol class="prep-answer-grid">${items}</ol>
      </div>`;
    }).join("");
    return `<section class="panel">${sect("完整答题情况")}
      <div class="prep-answer-filters" role="group" aria-label="答题卡筛选">
        <button type="button" data-prep-filter="all" aria-pressed="true">全部题目</button>
        <button type="button" data-prep-filter="wrong" aria-pressed="false">仅看错题</button>
      </div>
      <p class="empty" data-prep-no-wrong hidden>暂无错题</p>${groups}
    </section>`;
  }

  function explanations(report, scores) {
    if (!scores.incorrect) return "";
    const questions = new Map(report.questions.map((q) => [q.number, q]));
    const details = new Map(report.wrongQuestions.map((q) => [q.number, q]));
    const pending = new Map(scores.sections.flatMap((s) => s.wrong.map((n) => [n, s])));
    const groups = [...(report.wrongQuestionGroups ?? []), { sectionIds: report.sections.map((s) => s.id) }];
    return `<section class="panel">${sect("错题详细解析")}
      ${groups.map(({ title, sectionIds, passageSummary }) => {
        const items = [...pending].filter(([, s]) => sectionIds.includes(s.id));
        if (!items.length) return "";
        return `<div class="prep-explanation-group">${title ? `<h3>${esc(title)}</h3>` : ""}
          ${paragraphs(passageSummary)}
          ${items.map(([n, s]) => {
            pending.delete(n);
            const q = questions.get(n);
            const d = details.get(n);
            const fields = [
              ["题意", d?.prompt], ["原文定位", d?.location], ["正确答案分析", d?.correctAnalysis],
              ["干扰项分析", d?.distractorAnalysis], ["复习要点", d?.reviewPoint],
            ];
            return `<details class="prep-detail" id="prep-wrong-${n}">
              <summary>第 ${n} 题 <span>${esc(s.title)}${d?.knowledgePoint ? " · " + esc(d.knowledgePoint) : ""}</span></summary>
              <div class="prep-detail-body">
                <p><strong>考生答案 ${esc(answerText(q.answer))} · 正确答案 ${esc(answerText(q.correctAnswer))}</strong></p>
                ${d?.answerComparison ? paragraphs(d.answerComparison) : ""}
                ${fields.filter(([, value]) => value).map(([label, value]) =>
                  `<div><h4>${label}</h4>${paragraphs(value)}</div>`).join("")}
              </div>
            </details>`;
          }).join("")}
        </div>`;
      }).join("")}
    </section>`;
  }

  function grading(report) {
    if (!report.subjectiveQuestions.length) return "";
    const questions = new Map(report.subjectiveQuestions.map((q) => [q.number, q]));
    const labels = {
      translation: "参考译文", writing: "参考作文", general: "参考答案",
    };
    return `<section class="panel">${sect("主观题批改")}
      ${report.sections.filter((s) => s.type === "subjective").flatMap((s) => s.questionNumbers.map((n) => {
        const q = questions.get(n);
        const corrections = q.corrections ?? [];
        const translation = corrections.some((row) => "originalExpression" in row);
        const correctionTable = !corrections.length ? "" : translation
          ? table(["原文关键表达", q.studentAnswer ? "考生译文" : "考生译文（节选）", "建议译法及说明"],
            corrections.map((row) => [esc(row.originalExpression), esc(row.studentExpression), esc(row.suggestion)]),
            "prep-prose-table")
          : table(["考生表达", "建议修改", "说明"],
            corrections.map((row) => [esc(row.studentExpression), esc(row.suggestedExpression), esc(row.explanation)]),
            "prep-prose-table");
        const chart = q.chart;
        const chartRows = chart?.data.map((row) => ({ title: row.label, value: row.value })) ?? [];
        const max = chart?.unit === "%" ? 100 : Math.max(1, ...chartRows.map((row) => row.value));
        const assess = q.scoreType === "estimated" ? '<span class="small muted">估分</span>' : "";
        const referenceKind = translation ? "translation" : q.language === "en" ? "writing" : "general";
        const language = q.language ?? "";
        const title = s.questionNumbers.length > 1 ? `${s.title} · 第 ${n} 题` : s.title;
        return `<article class="prep-grading">
          <div class="prep-grading-heading">
            <h3>${esc(title)}</h3><span class="prep-grading-score"><strong class="num">${ratio(q.score, q.maxScore ?? s.pointsPerQuestion)}</strong> ${assess}</span>
          </div>
          ${paragraphs(q.assessment)}
          ${chart ? bars(chart.title ?? "原题统计图", chartRows, {
            scale: (row) => row.value / max, label: (row) => format(row.value) + chart.unit, unit: chart.unit,
          }) : ""}
          ${q.originalText ? `<div class="prep-prose"><h4>原文</h4>${paragraphs(q.originalText)}</div>` : ""}
          ${q.studentAnswer ? `<div class="prep-prose"><h4>考生原始作答</h4>${paragraphs(q.studentAnswer, language)}</div>` : ""}
          ${correctionTable}
          ${q.contentAnalysis?.length ? `<div class="prep-prose"><h4>内容与结构失分分析</h4>${
            q.contentAnalysis.map((row) => `<p><strong>${esc(row.title)}：</strong>${esc(row.text)}</p>`).join("")
          }</div>` : ""}
          ${q.referenceAnswer ? `<details class="prep-detail prep-reference"><summary>${labels[referenceKind]}</summary>
            <div class="prep-detail-body">${paragraphs(q.referenceAnswer, language)}</div></details>` : ""}
          ${q.reviewAdvice ? `<div class="prep-prose"><h4>复习建议</h4>${paragraphs(q.reviewAdvice)}</div>` : ""}
        </article>`;
      })).join("")}
    </section>`;
  }

  function diagnosis(report, scores) {
    const sections = new Map(scores.sections.map((s) => [s.id, s]));
    const total = (ids, key) => ids.reduce((sum, id) => sum + sections.get(id)[key], 0);
    const analysis = report.diagnosis ?? {};
    const groups = analysis.bySection ?? scores.sections.map((s) => ({ title: s.title, sectionIds: [s.id] }));
    const totalLoss = scores.max - scores.score;
    const targets = report.targets ?? [];
    const targetKey = (row) => [...row.sectionIds].sort().join(",");
    const groupsByKey = new Map(targets.flatMap(({ sections }) =>
      sections.map((row) => [targetKey(row), row]),
    ));
    const targetTable = !targets.length ? "" : table(
      ["题型", "本次", ...targets.map((t) => `${format(t.totalScore)} 分目标`)],
      [
        ...[...groupsByKey].map(([key, row]) => [
          esc(row.title), format(total(row.sectionIds, "score")),
          ...targets.map((t) => {
            const value = t.sections.find((r) => targetKey(r) === key)?.targetScore;
            return value === undefined ? "—" : format(value);
          }),
        ]),
        ["合计", format(scores.score), ...targets.map((t) => format(t.totalScore))],
      ],
    );
    return `<section class="panel">${sect("成绩诊断")}
      <div class="prep-score-grid">
        ${table(["题型", "得分", "得分率", "主要问题"], groups.map((row) => {
          const score = total(row.sectionIds, "score"), max = total(row.sectionIds, "max");
          return [esc(row.title), ratio(score, max), percent(score / max), esc(row.mainIssues || "—")];
        }), "prep-prose-table")}
        ${bars("失分分布", scores.sections, {
          scale: (s) => totalLoss ? s.loss / totalLoss : 0,
          label: (s) => `${format(s.loss)} 分 · ${totalLoss ? percent(s.loss / totalLoss) : "0%"}`,
          unit: "占总失分",
        })}
      </div>
      ${analysis.summary ? `<div class="prep-prose">${paragraphs(analysis.summary)}</div>` : ""}
      ${targetTable ? `<div class="prep-prose"><h3>阶段性成绩目标</h3>${targetTable}</div>` : ""}
      ${analysis.reviewAdvice?.length ? `<div class="prep-prose"><h3>复习建议</h3>${
        analysis.reviewAdvice.map((row) => `<h4>${esc(row.title)}</h4>${paragraphs(row.text)}`).join("")
      }</div>` : ""}
    </section>`;
  }

  function detail({ report, scores }) {
    return `<div class="prep-back">${link("prep", "← 备考记录", "", "textlink")}</div>
      ${heading(report.title)}
      <p class="prep-meta">作答日期 <time datetime="${esc(report.recordDate)}">${esc(report.recordDate)}</time> · ${esc(report.examType)}</p>
      ${overview(scores)}${answers(report, scores)}${explanations(report, scores)}
      ${grading(report)}${diagnosis(report, scores)}`;
  }

  async function view(id) {
    if (id && !recordId(id)) return missing();
    const ids = await getIndex();
    if (!id) return history(await Promise.all(ids.map(getReport)));
    return ids.includes(id) ? detail(await getReport(id)) : missing();
  }

  function missing() {
    return heading("未找到考试记录") + link("prep", "返回备考记录", "", "button");
  }

  return { view };
}

export function bindPrepReport(region) {
  region.onclick = (event) => {
    const question = event.target.closest("[data-prep-question]");
    if (question) {
      const details = region.querySelector(`#prep-wrong-${question.dataset.prepQuestion}`);
      if (!details) return;
      details.open = true;
      details.querySelector("summary").focus({ preventScroll: true });
      details.scrollIntoView({ block: "start" });
      return;
    }
    const filter = event.target.closest("[data-prep-filter]");
    if (!filter) return;
    const onlyWrong = filter.dataset.prepFilter === "wrong";
    region.querySelectorAll("[data-prep-filter]").forEach((item) =>
      item.setAttribute("aria-pressed", String(item === filter)),
    );
    region.querySelectorAll("[data-prep-correct], [data-no-wrong]").forEach((item) => {
      item.hidden = onlyWrong;
    });
    region.querySelector("[data-prep-no-wrong]").hidden = !onlyWrong || !!region.querySelector("[data-prep-question]");
  };
}
