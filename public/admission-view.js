const numeric = (...values) => values.find(Number.isFinite);

export const planFields = [
  ["planned", "计划招生人数"],
  ["promotionPlanned", "计划推免人数"],
  ["examPlanned", "计划统考人数"],
  ["regularExamPlanned", "普通统考计划"],
  ["specialPlanPlanned", "专项招生计划"],
];
export const admissionBreakdownFields = [
  ["regularExamAdmissions", "普通统考录取人数"],
  ["specialPlanAdmissions", "专项录取人数"],
  ["transferAdmissions", "调剂录取人数"],
];
export const scaleFields = [
  ...planFields,
  ["promotionAdmissions", "实际推免人数"],
  ["examAdmissions", "统考录取人数"],
];
export const competitionFields = [
  ["applicants", "报名人数"],
  ["examAttendees", "实考人数"],
  ["interviewees", "复试人数"],
  ["interviewEligible", "进入复试人数"],
  ["examAdmissions", "统考录取人数"],
];
export const ratioFields = [
  ["applicationRatio", "报录比"],
  ["examAttendanceRatio", "实考录取比"],
  ["interviewRatio", "复录比"],
];
export const scoreFields = [
  ["cutoff", "复试线"],
  ["schoolCutoff", "校级复试线"],
  ["minimum", "录取最低分"],
  ["maximum", "录取最高分"],
  ["average", "录取平均分"],
  ["median", "录取中位数"],
];

export function sourceKind(source) {
  if (source.kind) return source.kind;
  const title = source.title || "";
  if (/复试.*(?:细则|办法|方案|通知|安排)|复试工作/.test(title))
    return "retest";
  if (/培养方案|收费|学费/.test(title)) return "training";
  if (
    /考试录取情况|报考录取|报录|录取(?!工作)|复试线|分数线|名单|择校|公示数据/.test(
      title,
    )
  )
    return "history";
  if (
    /目录|招生计划|统考计划|招生简章|招生章程|招生说明|招生专业一览/.test(title)
  )
    return "catalog";
  return "";
}

function separateScope(text) {
  if (/专项未分离|含专项|包含专项|含卓工/.test(text)) return "统考录取含专项";
  if (/不含专项|剔除专项|排除专项/.test(text) && !/未知|是否|未独立/.test(text))
    return "统考录取不含专项";
  return "";
}

export function numbers(record) {
  const { annual = record, admission = {} } = record;
  const details = annual.details || {};
  const scope = admission.scope || "";
  const specialPlanPlanned = numeric(
    annual.specialPlanPlanned,
    details["专项计划"],
  );
  const splitPlan =
    Number.isFinite(annual.examPlanned) && Number.isFinite(specialPlanPlanned);
  const examAdmissions = numeric(
    admission.examAdmissionsTotal,
    admission.examAdmissions,
    admission.reportedAdmissionsScope === "examAdmissions"
      ? admission.reportedAdmissions
      : null,
  );
  const hasBreakdown =
    (Number.isFinite(admission.specialPlanAdmissions) &&
      admission.specialPlanAdmissions > 0) ||
    (Number.isFinite(admission.transferAdmissions) &&
      admission.transferAdmissions > 0);
  const uncertainCutoff =
    admission.cutoffSource !== "official" &&
    /可能为名单最低分/.test(scope) &&
    !admission.sources?.some(
      (s) => s.sourceType === "official" && /复试.*(?:线|细则)/.test(s.title),
    );
  return {
    planned: numeric(annual.planned),
    promotionPlanned: numeric(annual.promotionPlanned),
    examPlanned: numeric(
      splitPlan ? undefined : annual.examPlanned,
      details["目录公布统考计划"],
      details["目录统考计划"],
      details["目录考试计划"],
      details["包含目录口径的统考计划"],
    ),
    regularExamPlanned: numeric(
      annual.regularExamPlanned,
      splitPlan ? annual.examPlanned : undefined,
    ),
    specialPlanPlanned,
    promotionAdmissions: numeric(admission.promotionAdmissions),
    // A list sample and forecast do not establish the overall admission count.
    examAdmissions,
    regularExamAdmissions:
      Number.isFinite(admission.examAdmissionsTotal) &&
      examAdmissions !== admission.examAdmissions
        ? numeric(admission.examAdmissions)
        : undefined,
    specialPlanAdmissions: numeric(
      admission.specialPlanAdmissions,
      details["专项录取"],
    ),
    transferAdmissions: numeric(
      admission.transferAdmissions,
      details["调剂录取"],
    ),
    applicants: numeric(admission.applicants),
    examAttendees: numeric(admission.examAttendees, details["实际初试人数"]),
    interviewees: numeric(admission.interviewees),
    interviewEligible: numeric(
      admission.interviewEligible,
      details["达到复试资格人数"],
    ),
    applicationRatio: numeric(admission.applicationRatio),
    examAttendanceRatio: numeric(admission.examAttendanceRatio),
    interviewRatio: numeric(admission.interviewRatio),
    cutoff: uncertainCutoff ? undefined : numeric(admission.cutoff),
    schoolCutoff: numeric(admission.schoolCutoff),
    minimum: numeric(admission.minimum),
    maximum: numeric(admission.maximum),
    average: numeric(admission.average),
    median: numeric(admission.median),
    q1: numeric(admission.q1),
    q3: numeric(admission.q3),
    admissionScope: hasBreakdown
      ? ""
      : admission.metricScope ||
        (Number.isFinite(examAdmissions) ? separateScope(scope) : ""),
    interviewRatioScope: admission.interviewRatioScope || "",
  };
}

export function hasCatalog(record) {
  const { annual, sharedGroups } = record;
  const metric = numbers(record);
  return (
    annual.status !== "pending" &&
    (annual.examCombo ||
      annual.subjects?.length ||
      planFields.some(([key]) => Number.isFinite(metric[key])) ||
      sharedGroups.some((g) =>
        planFields.some(([key]) => Number.isFinite(numbers(g)[key])),
      ) ||
      annual.sources.some((s) => sourceKind(s) === "catalog"))
  );
}

export function admitSeries(records) {
  const grouped = new Map();
  const project = [];
  for (const record of records) {
    project.push({ ...numbers(record), record, year: record.year });
    for (const group of record.sharedGroups) {
      const template = group.id.replace(
        new RegExp(`(^|-)${group.year}(?=-|$)`),
        "$1year",
      );
      const key = JSON.stringify([
        template,
        [...group.projectIds].sort(),
        (group.displayScope || group.scope).replaceAll(
          String(group.year),
          "年度",
        ),
      ]);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped
        .get(key)
        .push({ ...numbers(group), record: group, year: group.year });
    }
  }
  return [
    { rows: project },
    ...[...grouped.values()].map((rows) => ({ rows, group: rows[0].record })),
  ];
}

export function scoreBins(admission = {}) {
  const normalized = new Map();
  if (admission.scoreBandOutcomes?.length)
    return admission.scoreBandOutcomes
      .map(({ min, max, interviewees, admitted, openEnded }) => ({
        low: min,
        high: max,
        interview: interviewees,
        admitted,
        openEnded,
      }))
      .sort((a, b) => a.low - b.low);
  const admittedBins = admission.scoreDistribution?.length
    ? admission.scoreDistribution
    : admission.publishedDistribution;
  for (const bin of admittedBins || []) {
    const low = numeric(bin.min, bin.low);
    const high = numeric(bin.max, bin.high);
    const admitted = numeric(bin.admitted, bin.admittedCount, bin.count);
    const interview = numeric(
      bin.interview,
      bin.interviewCount,
      bin.interviewees,
    );
    if (low != null && high >= low && (admitted != null || interview != null))
      normalized.set(`${low}–${high}`, { low, high, admitted, interview });
  }
  for (const bin of admission.interviewScoreDistribution || []) {
    const low = numeric(bin.min, bin.low);
    const high = numeric(bin.max, bin.high);
    const interview = numeric(
      bin.interview,
      bin.interviewCount,
      bin.interviewees,
      bin.count,
    );
    if (low == null || high < low || interview == null) continue;
    const key = `${low}–${high}`;
    normalized.set(key, { ...normalized.get(key), low, high, interview });
  }
  return [...normalized.values()].sort((a, b) => a.low - b.low);
}

const subjectNames = {
  politics: "思想政治理论",
  english: "英语",
  mathematics: "数学",
  math: "数学",
  business2: "专业课",
  foreignLanguage: "外国语",
  subject1: "业务课一",
  subject2: "专业课",
  101: "思想政治理论",
  201: "英语一",
  204: "英语二",
  301: "数学一",
  302: "数学二",
  408: "计算机学科专业基础",
};

export function subjectSeries(rows) {
  const series = new Map();
  for (const { record, year } of rows) {
    const subjects =
      record.admission?.subjectScoreStats ||
      (record.annual || record).details?.["分科成绩"] ||
      record.admission?.subjectScores ||
      {};
    for (const [key, value] of Object.entries(subjects)) {
      const code =
        {
          politics: "101",
          english: "20",
          foreignLanguage: "20",
          math: "30",
          mathematics: "30",
          business2: "",
          subject1: "30",
          subject2: "",
        }[key] ?? key;
      const actual = code
        ? record.annual?.subjects?.find((s) => s.code.startsWith(code))
        : record.annual?.subjects?.[3] || record.annual?.professionalSubject;
      const label = record.admission?.subjectScoreStats
        ? subjectNames[key] || key
        : actual?.name || subjectNames[key] || key;
      if (!series.has(label)) series.set(label, []);
      series.get(label).push({
        year,
        subject: actual?.name,
        minimum: numeric(value.minimum, value.min),
        maximum: numeric(value.maximum, value.max),
        average: numeric(value.average, value.mean),
        median: numeric(value.median),
        q1: numeric(value.q1),
        q3: numeric(value.q3),
      });
    }
  }
  return series;
}
