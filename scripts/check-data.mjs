import { readFile } from "node:fs/promises";
import { dataFiles, projectRef } from "../public/data.js";

const failure = [];
const check = (ok, at, message) => {
  if (!ok) failure.push(`${at}: ${message}`);
  return ok;
};
const object = (value, at) =>
  check(
    value && typeof value === "object" && !Array.isArray(value),
    at,
    "应为对象",
  );
const list = (value, at) =>
  check(Array.isArray(value), at, "应为数组") ? value : [];
const text = (value, at) =>
  check(typeof value === "string" && value.trim(), at, "应为非空字符串");
const id = (value, at) =>
  text(value, at) && check(!/[\s/]/.test(value), at, "ID 不得含空白或斜杠");
const year = (value, at) => number(value, at, 1900, 2200, true, false);
function number(value, at, min, max, integer = false, nullable = true) {
  if (nullable && value == null) return;
  check(
    Number.isFinite(value) &&
      value >= min &&
      value <= max &&
      (!integer || Number.isInteger(value)),
    at,
    `应为 ${min}–${max} 内的${integer ? "整数" : "数值"}${nullable ? "或 null" : ""}`,
  );
}
function date(value, at, required = false) {
  if (!required && value == null) return;
  const valid =
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value));
  check(
    valid && new Date(value).toISOString().slice(0, 10) === value,
    at,
    "应为有效日期 YYYY-MM-DD",
  );
}
function url(value, at) {
  try {
    check(/^https?:$/.test(new URL(value).protocol), at, "仅支持 HTTP(S) 链接");
  } catch {
    check(false, at, "无效来源链接");
  }
}
function unique(key, seen, at) {
  check(!seen.has(key), at, `重复标识 ${key}`);
  seen.add(key);
}
function objects(values, at, validate) {
  list(values, at).forEach((value, i) => {
    const item = `${at}[${i}]`;
    if (object(value, item)) validate(value, item);
  });
}
function timestamps(value, at) {
  date(value.updatedAt, at + ".updatedAt");
  date(value.verifiedOn, at + ".verifiedOn");
  if (value.scope != null) text(value.scope, at + ".scope");
}
function refs(values, at, required = false, expectedYear) {
  if (required)
    check(Array.isArray(values) && values.length, at, "需填写至少一条来源");
  if (!required && values == null) return;
  objects(values, at, (source, item) => {
    text(source.title, item + ".title");
    url(source.url, item + ".url");
    if (source.year != null || expectedYear !== undefined)
      year(source.year, item + ".year");
    if (expectedYear !== undefined)
      check(
        source.year === expectedYear,
        item + ".year",
        "应与记录适用年度一致",
      );
    for (const key of ["scope", "publisher", "shortTitle"])
      if (source[key] != null) text(source[key], item + "." + key);
    timestamps(source, item);
  });
}
function content(record, at) {
  timestamps(record, at);
  refs(record.sources, at + ".sources");
  if (record.sections == null) return;
  objects(record.sections, at + ".sections", (section, key) => {
    text(section.title, key + ".title");
    if (section.paragraphs != null)
      list(section.paragraphs, key + ".paragraphs").forEach((p, i) =>
        text(p, `${key}.paragraphs[${i}]`),
      );
    if (section.table != null && object(section.table, key + ".table")) {
      const headers = list(section.table.headers, key + ".table.headers");
      check(headers.length > 0, key + ".table.headers", "至少需要一列");
      headers.forEach((header, i) =>
        text(header, `${key}.table.headers[${i}]`),
      );
      list(section.table.rows, key + ".table.rows").forEach((row, i) => {
        check(
          Array.isArray(row) &&
            row.length === headers.length &&
            row.every(
              (cell) =>
                cell === null ||
                typeof cell === "string" ||
                Number.isFinite(cell),
            ),
          `${key}.table.rows[${i}]`,
          "列数与表头一致，单元格使用文字、数值或 null",
        );
      });
    }
    if (section.chart != null && object(section.chart, key + ".chart")) {
      text(section.chart.title, key + ".chart.title");
      if (section.chart.unit != null)
        text(section.chart.unit, key + ".chart.unit");
      objects(
        section.chart.points,
        key + ".chart.points",
        (point, pointKey) => {
          check(
            (typeof point.label === "string" && point.label.trim()) ||
              Number.isFinite(point.label),
            pointKey + ".label",
            "应为文字或数值",
          );
          number(point.value, pointKey + ".value", -1e12, 1e12);
        },
      );
    }
    refs(section.sources, key + ".sources");
  });
}
function index(values, at, validate) {
  const ids = new Set();
  objects(values, at, (record, key) => {
    if (id(record.id, key + ".id")) unique(record.id, ids, key + ".id");
    validate(record, key);
  });
  return ids;
}
const entries = await Promise.all(
  Object.entries(dataFiles).map(async ([key, file]) => {
    try {
      return [
        key,
        JSON.parse(
          await readFile(
            new URL(`../public/data/${file}.json`, import.meta.url),
            "utf8",
          ),
        ),
      ];
    } catch (e) {
      failure.push(`${file}.json: ${e.message}`);
      return [key, null];
    }
  }),
);
const data = Object.fromEntries(entries);

const schools = index(data.schools, "schools", (row, at) => {
  for (const key of ["name", "city", "province"])
    text(row[key], at + "." + key);
  list(row.aliases, at + ".aliases").forEach((alias) =>
    text(alias, at + ".aliases"),
  );
  content(row, at);
});
const careers = index(data.careers, "careers", (row, at) => {
  for (const key of ["title", "summary", "industry"])
    text(row[key], at + "." + key);
  content(row, at);
});
const majors = index(data.majors, "majors", (row, at) => {
  for (const key of ["title", "summary", "degree"])
    text(row[key], at + "." + key);
  list(row.careerIds, at + ".careerIds").forEach((key) =>
    check(careers.has(key), at + ".careerIds", `未找到职业 ${key}`),
  );
  content(row, at);
});
index(data.knowledge, "knowledge", (row, at) => {
  text(row.title, at + ".title");
  text(row.summary, at + ".summary");
  content(row, at);
});
index(data.news, "news", (row, at) => {
  text(row.title, at + ".title");
  date(row.date, at + ".date");
  if (row.schoolId != null)
    check(
      schools.has(row.schoolId),
      at + ".schoolId",
      `未找到院校 ${row.schoolId}`,
    );
  refs(row.sources, at + ".sources", true);
  timestamps(row, at);
});

const planFields = ["planned", "promotionPlanned", "examPlanned"];
const counts = (record, at, fields) =>
  fields.forEach((key) => number(record[key], at + "." + key, 0, 1e7, true));
const annualRecords = new Map();
const sharedPlans = new Map();
const catalog = object(data.catalog, "projects") ? data.catalog : {};
const projectIds = index(catalog.projects, "projects.projects", (row, at) => {
  check(
    schools.has(row.schoolId),
    at + ".schoolId",
    `未找到院校 ${row.schoolId}`,
  );
  check(majors.has(row.majorId), at + ".majorId", `未找到专业 ${row.majorId}`);
  check(!/-\d{4}$/.test(row.id), at + ".id", "项目 ID 不能以 -YYYY 结尾");
  text(row.college, at + ".college");
  check(
    Array.isArray(row.years) && row.years.length,
    at + ".years",
    "项目至少需要一条年度记录",
  );
  objects(row.years, at + ".years", (annual, key) => {
    year(annual.year, key + ".year");
    const ref = projectRef(row.id, annual.year);
    check(!annualRecords.has(ref), key, `重复年度 ${ref}`);
    annualRecords.set(ref, annual);
    if (annual.examCombo != null) text(annual.examCombo, key + ".examCombo");
    objects(annual.subjects, key + ".subjects", (s, subject) => {
      text(s.code, subject + ".code");
      text(s.name, subject + ".name");
    });
    counts(annual, key, planFields);
    refs(annual.sources, key + ".sources", true, annual.year);
    timestamps(annual, key);
  });
});
objects(catalog.sharedPlans, "projects.sharedPlans", (row, at) => {
  id(row.id, at + ".id");
  year(row.year, at + ".year");
  text(row.scope, at + ".scope");
  counts(row, at, planFields);
  const key = projectRef(row.id, row.year);
  check(!sharedPlans.has(key), at, `重复共享计划 ${key}`);
  sharedPlans.set(key, row);
  check(
    Array.isArray(row.projectIds) && row.projectIds.length,
    at + ".projectIds",
    "至少指定一个已收录项目",
  );
  const members = new Set();
  list(row.projectIds, at + ".projectIds").forEach((projectId) => {
    unique(projectId, members, at + ".projectIds");
    const annual = annualRecords.get(projectRef(projectId, row.year));
    check(
      (
        annual?.groupIds ?? (annual?.sharedPlanId ? [annual.sharedPlanId] : [])
      ).includes(row.id),
      at,
      `项目年度缺少指向本计划的关联 ${projectId}`,
    );
  });
  refs(row.sources, at + ".sources", true, row.year);
  timestamps(row, at);
});
for (const [ref, annual] of annualRecords) {
  const seen = new Set();
  const ids =
    annual.groupIds ?? (annual.sharedPlanId ? [annual.sharedPlanId] : []);
  for (const id of list(ids, "projects: " + ref + ".groupIds")) {
    unique(id, seen, "projects: " + ref + ".groupIds");
    const plan = sharedPlans.get(projectRef(id, annual.year));
    const projectId = ref.slice(0, ref.lastIndexOf("-"));
    check(
      Array.isArray(plan?.projectIds) && plan.projectIds.includes(projectId),
      "projects: " + ref,
      `无效统计组 ${id}`,
    );
  }
}
function yearly(values, at, validate) {
  const seen = new Set();
  objects(values, at, (row, key) => {
    year(row.year, key + ".year");
    const ref = projectRef(row.projectId, row.year);
    check(
      projectIds.has(row.projectId) && annualRecords.has(ref),
      key,
      `未找到项目年度 ${ref}`,
    );
    unique(ref, seen, key);
    refs(row.sources, key + ".sources", true, row.year);
    timestamps(row, key);
    validate(row, key);
  });
}
yearly(data.admissions, "admissions", (row, at) => {
  counts(row, at, [
    "applicants",
    "examAttendees",
    "interviewees",
    "interviewEligible",
    "examAdmissions",
    "promotionAdmissions",
  ]);
  for (const key of [
    "applicationRatio",
    "examAttendanceRatio",
    "interviewRatio",
  ])
    number(row[key], at + "." + key, 0, 1e5);
  for (const key of ["cutoff", "minimum", "maximum", "average", "median"]) {
    number(row[key], at + "." + key, 0, 500);
    if (key !== "cutoff" && row[key] != null)
      check(
        (row.minimum == null || row[key] >= row.minimum) &&
          (row.maximum == null || row[key] <= row.maximum),
        at + "." + key,
        "分数应在录取最低分和最高分之间",
      );
  }
  for (const field of ["scoreDistribution", "interviewScoreDistribution"])
    if (row[field] != null)
      objects(row[field], at + "." + field, (bin, key) => {
        number(bin.min, key + ".min", 0, 500, false, false);
        number(bin.max, key + ".max", 0, 500, false, false);
        number(bin.count, key + ".count", 0, 1e7, true, false);
        check(bin.min <= bin.max, key, "分段最低分不得高于最高分");
      });
});
yearly(data.training, "training", (row, at) => {
  number(row.tuitionPerYear, at + ".tuitionPerYear", 0, 1e6);
  number(row.durationYears, at + ".durationYears", 0.25, 15);
  for (const key of ["city", "location"])
    if (row[key] != null) text(row[key], at + "." + key);
});
if (object(data.national, "national-stats")) {
  text(data.national.title, "national-stats.title");
  text(data.national.unit, "national-stats.unit");
  timestamps(data.national, "national-stats");
  if (object(data.national.target, "national-stats.target")) {
    year(data.national.target.year, "national-stats.target.year");
    date(data.national.target.examDate, "national-stats.target.examDate", true);
    check(
      /^\d{4}-(0[1-9]|1[0-2])$/.test(data.national.target.enrollmentMonth),
      "national-stats.target.enrollmentMonth",
      "应为 YYYY-MM",
    );
  }
  const seen = new Set();
  objects(data.national.series, "national-stats.series", (row, at) => {
    year(row.year, at + ".year");
    unique(row.year, seen, at);
    number(row.value, at + ".value", 0, 1e5);
    refs(row.sources, at + ".sources", true, row.year);
    timestamps(row, at);
  });
}

const research = index(data.research, "research-directions", (row, at) => {
  text(row.title, at + ".title");
  content(row, at);
  for (const major of row.majorIds ?? [])
    check(majors.has(major), at, `未找到专业 ${major}`);
});
for (const row of [
  ...(data.majors ?? []),
  ...(data.knowledge ?? []),
  ...(data.research ?? []),
]) {
  for (const id of row?.researchIds ?? [])
    check(research.has(id), row.id, `未找到研究方向 ${id}`);
}
if (object(data.market, "career-market")) {
  const indexes = {};
  for (const key of [
    "industries",
    "employers",
    "cities",
    "salaryStatistics",
    "recruitmentExamples",
  ]) {
    indexes[key] = index(
      data.market[key],
      "career-market." + key,
      (row, at) => {
        if (key === "salaryStatistics") {
          for (const field of ["value", "min", "max"])
            number(row[field], at + "." + field, 0, 1e8);
          check(
            row.min == null || row.max == null || row.min <= row.max,
            at,
            "薪资上限小于下限",
          );
        }
        refs(row.sources, at + ".sources");
      },
    );
  }
  for (const row of [
    ...(data.careers ?? []),
    ...Object.values(data.market).filter(Array.isArray).flat(),
  ]) {
    if (!row?.id) continue;
    for (const [field, set] of Object.entries({
      careerIds: careers,
      industryIds: indexes.industries,
      employerIds: indexes.employers,
      cityIds: indexes.cities,
      salaryStatisticsIds: indexes.salaryStatistics,
      recruitmentExampleIds: indexes.recruitmentExamples,
    })) {
      for (const id of row[field] ?? [])
        check(set.has(id), row.id + "." + field, `未找到 ${id}`);
    }
    if (row.employerId)
      check(indexes.employers.has(row.employerId), row.id, "招聘企业关联无效");
    if (row.cityId)
      check(indexes.cities.has(row.cityId), row.id, "城市关联无效");
  }
}
if (object(data.employment, "employment")) {
  const nameSet = new Set();
  objects(data.employment.schools, "employment.schools", (row, at) => {
    unique(row.schoolId, nameSet, at);
    check(schools.has(row.schoolId), at, "院校关联无效");
  });
  for (const key of [
    "employmentRecords",
    "employmentCases",
    "industryPartnerships",
  ]) {
    index(data.employment[key], "employment." + key, (row, at) => {
      check(schools.has(row.schoolId), at, "院校关联无效");
      if (row.graduationYear != null)
        year(row.graduationYear, at + ".graduationYear");
      refs(row.sources, at + ".sources", true);
      for (const [field, value] of Object.entries(row)) {
        if (field.endsWith("Rate")) number(value, at + "." + field, 0, 100);
        if (field.endsWith("Count"))
          number(value, at + "." + field, 0, 1e7, true);
      }
    });
  }
}
if (failure.length) {
  console.error(failure.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `数据有效：${schools.size} 所院校，${projectIds.size} 个招生项目，${annualRecords.size} 条年度记录。`,
  );
}
