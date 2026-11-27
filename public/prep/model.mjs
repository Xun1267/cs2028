export const subjects = {
  "101": { name: "思想政治理论", max: 100 },
  "204": { name: "英语二", max: 100 },
  "302": { name: "数学二", max: 150 },
  "408": { name: "408计算机学科专业基础", max: 150 },
};

export const recordId = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(value);
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v) => typeof v === "string" && v.trim().length > 0;
const number = (v) => Number.isFinite(v) && v >= 0;
const integer = (v) => Number.isSafeInteger(v) && v > 0;
const same = (a, b) => Math.abs(a - b) < 1e-8;
const round = (v) => Number(v.toFixed(8));
const prose = (v) => typeof v === "string" || (Array.isArray(v) && v.every((x) => typeof x === "string"));
const date = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const answerParts = (v) => (Array.isArray(v) ? v : v.trim().split(/[,，\s]+/))
  .map((part) => part.trim().toUpperCase()).filter(Boolean).sort();
const answerValue = (v) => typeof v === "string" || (Array.isArray(v) && v.every(text));

export function matchesAnswer(answer, correct) {
  return JSON.stringify(answerParts(answer)) === JSON.stringify(answerParts(correct));
}

export function validateReport(report) {
  const check = (condition, field) => {
    if (!condition) throw new Error(`${field} 无效`);
  };
  const rows = (value, field) => {
    check(Array.isArray(value) && value.every(object), field);
    return value;
  };
  const optional = (value, test, field) => {
    if (value !== undefined) check(test(value), field);
  };
  check(object(report) && report.schemaVersion === 1, "schemaVersion");
  check(recordId(report.id), "id");
  for (const key of ["title", "subject", "subjectName", "examType"]) check(text(report[key]), key);
  check(typeof report.subjectCode === "string" && Object.hasOwn(subjects, report.subjectCode), "subjectCode");
  check(report.maxScore === subjects[report.subjectCode].max, "maxScore");
  check(integer(report.examYear) && report.examYear >= 1900 && report.examYear <= 9999, "examYear");
  check(integer(report.attempt), "attempt");
  check(date(report.recordDate), "recordDate");
  optional(report.gradingDate, date, "gradingDate");

  const sections = new Map();
  const expected = new Map();
  for (const section of rows(report.sections, "sections")) {
    const { id, title, type, maxScore, questionNumbers, pointsPerQuestion } = section;
    check(recordId(id) && !sections.has(id) && text(title) &&
      ["objective", "subjective"].includes(type) && number(maxScore) && maxScore > 0 &&
      Array.isArray(questionNumbers) && questionNumbers.length > 0, "sections");
    optional(pointsPerQuestion, (v) => number(v) && v > 0, `${id}.pointsPerQuestion`);
    sections.set(id, section);
    for (const n of questionNumbers) {
      check(integer(n) && !expected.has(n), `${id}.questionNumbers`);
      expected.set(n, section);
    }
  }

  const seen = new Set();
  const wrong = new Map();
  const caps = new Map();
  for (const [field, type] of [["questions", "objective"], ["subjectiveQuestions", "subjective"]]) {
    for (const q of rows(report[field], field)) {
      const section = expected.get(q.number);
      const loc = `${field} 第 ${q.number} 题`;
      check(section?.id === q.sectionId && section?.type === type && !seen.has(q.number), loc);
      seen.add(q.number);
      const cap = q.maxScore ?? section.pointsPerQuestion;
      check(number(cap) && cap > 0, `${loc} 满分`);
      caps.set(section.id, (caps.get(section.id) || 0) + cap);
      if (type === "objective") {
        check(answerValue(q.answer) && answerValue(q.correctAnswer) && answerParts(q.correctAnswer).length, `${loc} 答案`);
        if (!matchesAnswer(q.answer, q.correctAnswer)) wrong.set(q.number, q.sectionId);
      } else {
        check(number(q.score) && q.score <= cap, `${loc} 得分`);
        optional(q.language, (v) => typeof v === "string" && /^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{1,8})*$/.test(v), `${loc} language`);
        for (const key of ["assessment", "originalText", "studentAnswer", "referenceAnswer", "reviewAdvice"]) {
          optional(q[key], prose, `${loc} ${key}`);
        }
        for (const [key, fields] of [
          ["corrections", ["originalExpression", "studentExpression", "suggestion", "suggestedExpression", "explanation"]],
          ["contentAnalysis", ["title", "text"]],
        ]) {
          if (q[key] === undefined) continue;
          for (const row of rows(q[key], `${loc} ${key}`)) {
            check(fields.some((name) => text(row[name])) &&
              fields.every((name) => row[name] === undefined || prose(row[name])), `${loc} ${key}`);
          }
        }
        if (q.chart !== undefined) {
          check(object(q.chart) && q.chart.type === "bar" && typeof q.chart.unit === "string" &&
            Array.isArray(q.chart.data) && q.chart.data.length &&
            q.chart.data.every((row) => object(row) && text(row.label) && number(row.value)), `${loc} chart`);
          optional(q.chart.title, text, `${loc} chart.title`);
        }
      }
    }
  }
  check(seen.size === expected.size, "答题记录题号");
  check([...sections.values()].every((section) => same(caps.get(section.id), section.maxScore)) &&
    same([...caps.values()].reduce((sum, cap) => sum + cap, 0), report.maxScore), "题型和试卷满分合计");

  const references = (ids) => Array.isArray(ids) && ids.length > 0 &&
    new Set(ids).size === ids.length && ids.every((id) => sections.has(id));
  for (const group of rows(report.wrongQuestionGroups ?? [], "wrongQuestionGroups")) {
    check(text(group.title) && references(group.sectionIds), "wrongQuestionGroups");
    optional(group.passageSummary, prose, "passageSummary");
  }
  const explained = new Set();
  for (const q of rows(report.wrongQuestions, "wrongQuestions")) {
    const loc = `wrongQuestions 第 ${q.number} 题`;
    check(wrong.get(q.number) === q.sectionId && wrong.has(q.number) && !explained.has(q.number), loc);
    explained.add(q.number);
    for (const key of ["answerComparison", "knowledgePoint", "location", "correctAnalysis", "distractorAnalysis", "reviewPoint", "prompt"]) {
      optional(q[key], prose, `${loc} ${key}`);
    }
  }

  if (report.diagnosis !== undefined) {
    const d = report.diagnosis;
    check(object(d), "diagnosis");
    optional(d.summary, prose, "diagnosis.summary");
    for (const row of rows(d.bySection ?? [], "diagnosis.bySection")) {
      check(text(row.title) && references(row.sectionIds) && prose(row.mainIssues), "diagnosis.bySection");
    }
    for (const row of rows(d.reviewAdvice ?? [], "diagnosis.reviewAdvice")) {
      check(text(row.title) && prose(row.text), "diagnosis.reviewAdvice");
    }
  }
  const targets = new Set();
  for (const target of rows(report.targets ?? [], "targets")) {
    check(number(target.totalScore) && target.totalScore <= report.maxScore &&
      !targets.has(target.totalScore), "targets.totalScore");
    targets.add(target.totalScore);
    const covered = new Set();
    let total = 0;
    for (const row of rows(target.sections, "targets.sections")) {
      check(text(row.title) && references(row.sectionIds) &&
        row.sectionIds.every((id) => !covered.has(id)) && number(row.targetScore) &&
        row.targetScore <= row.sectionIds.reduce((sum, id) => sum + sections.get(id).maxScore, 0), "targets.sections");
      row.sectionIds.forEach((id) => covered.add(id));
      total += row.targetScore;
    }
    check(covered.size !== sections.size || same(total, target.totalScore), "阶段性目标分数合计");
  }
  return report;
}

export function validateIndex(index) {
  if (!object(index) || index.schemaVersion !== 1 || !Array.isArray(index.reports) ||
    !index.reports.every(recordId) || new Set(index.reports).size !== index.reports.length) {
    throw new Error("考试记录索引格式无效");
  }
  return index.reports;
}

export function subjectHistory(entries) {
  const ordered = [...entries].sort((a, b) =>
    a.report.recordDate.localeCompare(b.report.recordDate) ||
    a.report.attempt - b.report.attempt || a.report.id.localeCompare(b.report.id));
  const values = ordered.map(({ scores }) => scores.score);
  return {
    ordered,
    latest: values.at(-1),
    highest: values.length ? Math.max(...values) : null,
    average: values.length ? values.reduce((sum, score) => sum + score, 0) / values.length : null,
  };
}

export function scoreReport(report) {
  const objective = new Map(report.questions.map((q) => [q.number, q]));
  const subjective = new Map(report.subjectiveQuestions.map((q) => [q.number, q]));
  const sections = report.sections.map((section) => {
    let score = 0;
    const wrong = [];
    for (const n of section.questionNumbers) {
      if (section.type === "subjective") {
        score += subjective.get(n).score;
      } else {
        const q = objective.get(n);
        if (matchesAnswer(q.answer, q.correctAnswer)) score += q.maxScore ?? section.pointsPerQuestion;
        else wrong.push(n);
      }
    }
    return {
      id: section.id, title: section.title, type: section.type, max: section.maxScore,
      score: round(score), loss: round(section.maxScore - score), wrong,
    };
  });
  const totals = (type) => {
    const selected = sections.filter((s) => s.type === type);
    return {
      score: round(selected.reduce((sum, s) => sum + s.score, 0)),
      max: round(selected.reduce((sum, s) => sum + s.max, 0)),
    };
  };
  const objectiveTotal = totals("objective");
  const subjectiveTotal = totals("subjective");
  const incorrect = sections.reduce((sum, s) => sum + s.wrong.length, 0);
  const count = report.questions.length;
  return {
    sections, objective: objectiveTotal, subjective: subjectiveTotal, incorrect, count,
    correct: count - incorrect, accuracy: count ? (count - incorrect) / count : null,
    score: round(objectiveTotal.score + subjectiveTotal.score), max: report.maxScore,
  };
}
