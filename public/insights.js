const sectionsByMarket = {
  industries: ["行业", "industry"],
  employers: ["企业", "employer"],
  cities: ["就业城市", "city"],
  salaryStatistics: ["薪资统计与案例", "salary"],
  recruitmentExamples: ["招聘与 Offer 案例", "recruitment"],
};
const salaryTypes = {
  actual_wage_statistics: "工资统计",
  graduate_survey: "毕业生调查",
  community_offer_observation: "个人 Offer 案例",
  community_reported_offer: "个人 Offer 案例",
  community_offer_sample_summary: "个人 Offer 样本汇总",
  recruitment_quote: "招聘报价",
  recruitment_quote_statistics: "招聘报价统计",
  recruiter_reference_range: "猎头参考区间",
  recruiter_report_reference: "猎头报告参考",
  editorial_planning_estimate: "编辑参考区间",
};
const moneyUnits = {
  "CNY/month": "元/月",
  "CNY/year": "元/年",
  "CNY/m²/month": "元/平方米/月",
  "CNY/m2/month": "元/平方米/月",
  "CNY/day": "元/日",
};
const employmentFields = {
  graduateCount: "毕业人数",
  sampleSize: "统计样本",
  mastersGraduateCount: "硕士毕业人数",
  doctoratesGraduateCount: "博士毕业人数",
  doctorateGraduateCount: "博士毕业人数",
  bachelorGraduateCount: "本科毕业人数",
  degreeAwardedCount: "授予学位人数",
  destinationResolvedCount: "落实毕业去向人数",
  destinationResolutionRate: "毕业去向落实率",
  destinationResolutionRateLowerBound: "去向落实率下界",
  keySectorEmploymentRateLowerBound: "重点单位就业率下界",
  employmentRate: "就业率",
  directEmploymentCount: "直接就业人数",
  directEmploymentRate: "直接就业率",
  signedEmploymentCount: "签约就业人数",
  signedEmploymentRate: "签约就业率",
  flexibleEmploymentCount: "灵活就业人数",
  furtherStudyCount: "深造人数",
  furtherStudyRate: "深造比例",
  domesticFurtherStudyCount: "境内深造人数",
  overseasFurtherStudyCount: "出国（境）深造人数",
  overseasFurtherStudyRate: "出国（境）深造比例",
  unresolvedCount: "去向未落实人数",
  reportedDestinationCount: "报告列示去向人数",
};
const graduateLevels = {
  all: "全学历",
  master: "硕士",
  doctoral: "博士",
  doctorate: "博士",
  bachelor: "本科",
  undergraduate: "本科",
  postgraduate: "研究生",
};
const graduateDegrees = { professional: "专业学位", academic: "学术学位" };
const scopeNames = {
  school: "全校",
  school_degree: "校级分学历",
  school_full_time: "全校全日制",
  school_full_time_degree: "校级全日制分学历",
  school_main_campus: "学校主校区",
  school_report_unspecified_campus: "校级报告（校区未指明）",
  school_beijing_student_registration: "北京学籍",
  school_beijing_student_registration_degree: "北京学籍分学历",
  school_main_campus_full_time: "主校区全日制",
  school_main_campus_full_time_degree: "主校区全日制分学历",
  school_analysis_population: "校级报告分析样本",
  school_historical: "校级历史数据",
  school_degree_signed_nondirected: "校级非定向签约毕业生",
  college: "学院",
  college_group: "学院组",
  college_degree: "学院分学历",
  college_group_degree: "学院组分学历",
  college_historical: "学院历史数据",
  major: "专业",
  major_historical: "专业历史数据",
  degree_authorization_point: "学位授权点",
  research_group: "课题组",
  research_group_reported_list: "课题组去向名单",
  program_prospectus: "项目招生介绍",
};
const careerBands = {
  bachelor: "应届本科",
  master: "应届硕士",
  doctoral: "应届博士",
  phd: "应届博士",
  years1to3: "1–3 年",
  years3to5: "3–5 年",
  years5to10: "5–10 年",
  years5plus: "5 年以上",
  years10plus: "10 年以上",
};
const salaryStatisticNames = {
  mean: "均值",
  median: "中位数",
  range: "区间",
  observation: "单条观察",
  quote: "报价",
};

export function createInsights(data, ui) {
  const {
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
  } = ui;
  const { market, employment } = data;
  const schools = new Map(data.schools.map((record) => [record.id, record]));
  const careerNames = new Map(
    data.careers.map((record) => [record.id, record.title]),
  );
  const lookups = Object.fromEntries(
    Object.entries(market).map(([key, rows]) => [
      key,
      new Map(rows.map((row) => [row.id, row])),
    ]),
  );
  const employmentBySchool = new Map(
    data.schools.map((school) => [
      school.id,
      Object.fromEntries(
        Object.entries(employment).map(([key, rows]) => [
          key,
          rows.filter((row) => row.schoolId === school.id),
        ]),
      ),
    ]),
  );
  const name = (key, id) => lookups[key]?.get(id)?.name || id;
  const custom = (title, body) =>
    body ? `<section>${sect(title)}${body}</section>` : "";
  const details = (title, body) =>
    `<details class="record-disclosure"><summary>${esc(title)}</summary><div>${body}</div></details>`;
  const note = (text) => (text ? `<p>${esc(text)}</p>` : "");
  const unit = (u) => moneyUnits[u] ?? (u || "");
  const amount = (row) => {
    if (row?.min != null && row?.max != null)
      return `${row.min.toLocaleString("zh-CN")}–${row.max.toLocaleString("zh-CN")} ${unit(row.unit)}`;
    if (row?.value != null)
      return `${row.value.toLocaleString("zh-CN")} ${unit(row.unit)}`;
    if (row?.min != null)
      return `≥ ${row.min.toLocaleString("zh-CN")} ${unit(row.unit) || "元（计薪周期未标明）"}`;
    if (row?.max != null)
      return `≤ ${row.max.toLocaleString("zh-CN")} ${unit(row.unit) || "元（计薪周期未标明）"}`;
    return "—";
  };
  const formatType = (type) => salaryTypes[type] || type || "来源未分类";
  const links = (ids, item) => (ids || []).map(item).join(" · ");
  const marketLink = (key, id) =>
    link(sectionsByMarket[key][1], name(key, id), id);
  const sourceSummary = (record) => sources(record?.sources);
  const scope = (record) =>
    [
      scopeNames[record.scope] || record.scope,
      record.college,
      record.major,
      graduateLevels[record.degreeLevel] || record.degreeLevel,
      graduateDegrees[record.degreeType] || record.degreeType,
    ]
      .filter(Boolean)
      .join(" · ");
  const categoryLinks = (item) =>
    [
      ["industries", item.industryIds],
      ["employers", item.employerIds],
      ["cities", item.cityIds],
    ]
      .filter(([, ids]) => ids?.length)
      .map(([key, ids]) =>
        custom(
          sectionsByMarket[key][0],
          `<p class="related-links">${links(ids, (id) => marketLink(key, id))}</p>`,
        ),
      )
      .join("");

  function salaryTable(records) {
    if (!records.length) return "";
    const metricTypes = new Map();
    for (const record of records) {
      const type = formatType(record.dataType);
      if (!metricTypes.has(type)) metricTypes.set(type, []);
      metricTypes.get(type).push(record);
    }
    return [...metricTypes]
      .map(([type, rows]) =>
        details(
          `${type}（${rows.length}）`,
          table(
            ["指标／样本", "金额", "年份与人群"],
            rows.map((record) => [
              link("salary", record.name, record.id),
              esc(amount(record)),
              esc(
                [
                  ...new Set(
                    [record.year, record.population, record.education].filter(
                      Boolean,
                    ),
                  ),
                ].join(" · "),
              ) + sourceSummary(record),
            ]),
          ),
        ),
      )
      .join("");
  }
  function caseTable(records) {
    if (!records.length) return "";
    return table(
      ["企业与岗位", "类型", "届别", "地点", "薪资"],
      records.map((record) => [
        link(
          "recruitment",
          `${name("employers", record.employerId)} · ${record.jobTitle}`,
          record.id,
        ),
        esc(record.salary ? formatType(record.salary.dataType) : "招聘资料"),
        esc(show(record.cohort)),
        esc(
          (record.cityIds ?? []).map((id) => name("cities", id)).join("、") ||
            "—",
        ),
        esc(amount(recruitmentAmount(record.salary))),
      ]),
    );
  }
  function recruitmentAmount(salary) {
    if (!salary) return null;
    if (salary.min != null || salary.value != null) return salary;
    for (const [key, price] of Object.entries(salary)) {
      if (!/monthly|annual|baseSalary|totalComp/i.test(key)) continue;
      if (typeof price === "number")
        return {
          value: price,
          unit: key.toLowerCase().includes("annual") ? "CNY/year" : "CNY/month",
        };
      if (price?.min != null || price?.value != null) return price;
    }
    return null;
  }
  function marketSections(record) {
    const stats = (record.salaryStatisticsIds || [])
      .map((id) => lookups.salaryStatistics.get(id))
      .filter(Boolean);
    const examples = (record.recruitmentExampleIds || [])
      .map((id) => lookups.recruitmentExamples.get(id))
      .filter(Boolean);
    return (
      categoryLinks(record) +
      (record.careerIds?.length
        ? custom(
            "职业方向",
            `<p class="related-links">${links(record.careerIds, (id) => link("job", careerNames.get(id), id))}</p>`,
          )
        : "") +
      custom("薪资资料", salaryTable(stats)) +
      (examples.length
        ? details(
            `招聘与 Offer 案例（${examples.length}）`,
            caseTable(examples),
          )
        : "")
    );
  }
  function careerContext(record) {
    const ai = record.aiImpact;
    return ai
      ? custom(
          "AI 对岗位任务的影响",
          facts([
            ["分析时段", ai.period],
            ["可辅助的任务", ai.automatableTasks],
            ["仍需掌握的技能", ai.skillsToDevelop],
            ["职业影响判断", ai.employmentImplications],
          ]) +
            note("资料为岗位任务层面的定性分析。") +
            sourceSummary(ai),
        )
      : "";
  }
  function bandTable(record) {
    const rows = [
      ...Object.entries(record.entryLevelSalary || {}),
      ...Object.entries(record.experiencedSalary || {}),
    ].filter(([, v]) => v?.min != null && v?.max != null);
    if (!rows.length) return "";
    const comparable = rows.filter(([, v]) => v.unit === "CNY/month");
    const scale = Math.max(1, ...comparable.map(([, v]) => v.max));
    return custom(
      "分学历与工龄参考薪资",
      note(
        "金额为择业预算参考，按资料所列工龄和学历分组。实际工资、招聘报价及个人样本见薪资资料。",
      ) +
        table(
          ["群体", "参考区间", "范围", "年份"],
          rows.map(([key, v]) => [
            esc(careerBands[key] || key),
            esc(amount(v)),
            v.unit === "CNY/month"
              ? `<span class="range-scale"><i style="left:${(v.min / scale) * 100}%;right:${100 - (v.max / scale) * 100}%"></i></span>`
              : "—",
            esc(show(v.year)) + sourceSummary(v),
          ]),
        ),
    );
  }
  function cityRows() {
    return table(
      ["城市", "薪资参考｜城市梯队", "挂牌租金", "合租生活预算"],
      market.cities.map((city) => [
        marketLink("cities", city.id),
        esc(cityMarketPay(city)),
        esc(
          city.rent?.average == null
            ? "—"
            : `${city.rent.average} 元/平方米/月 · ${city.rent.period || "时期未标示"}`,
        ),
        esc(amount(city.livingCosts?.sharedHousingTotalMonthlyBudget)),
      ]),
      "market-table",
    );
  }
  function cityMarketPay(city) {
    const range = city.cityMarketSalaryReference?.annualIndustryMeanBand;
    return range?.length === 2
      ? amount({
          min: range[0],
          max: range[1],
          unit: city.cityMarketSalaryReference.unit,
        })
      : "—";
  }
  function marketIndex(key) {
    if (key === "schoolEmployment") {
      return (
        heading("高校就业") +
        table(
          ["院校", "就业资料", "去向案例", "培养合作"],
          data.schools.map((school) => {
            const items = employmentBySchool.get(school.id);
            return [
              link("school", school.name, school.id),
              esc(items.employmentRecords.length),
              esc(items.employmentCases.length),
              esc(items.industryPartnerships.length),
            ];
          }),
        )
      );
    }
    if (key === "cities")
      return (
        heading("就业城市") +
        '<p class="measure-note">薪资为城市梯队参考，租金为挂牌数据，生活预算按相应假设估算。各项的时间与来源见城市详情。</p>' +
        cityRows()
      );
    if (key === "salaryStatistics")
      return heading("薪资资料") + salaryTable(market[key]);
    if (key === "recruitmentExamples")
      return (
        heading("招聘与 Offer 案例") +
        '<p class="measure-note">历史资料，岗位状态及报名条件请查阅原招聘页面。</p>' +
        caseTable(market[key])
      );
    return (
      heading(sectionsByMarket[key][0]) +
      grid(
        market[key].map((record) => [
          "",
          record.name,
          record.mainBusiness,
          sectionsByMarket[key][1],
          record.id,
        ]),
      )
    );
  }
  function marketDetail(key, id) {
    const r = lookups[key].get(id);
    if (key === "salaryStatistics")
      return (
        heading(r.name, formatType(r.dataType)) +
        facts([
          ["金额", amount(r)],
          ["统计类型", salaryStatisticNames[r.statistic] || r.statistic],
          ["适用时期", r.period || r.year],
          ["样本", r.population],
          ["样本量", r.sampleSize],
          ["学历", r.education],
          ["工龄", r.experienceYears?.join("–")],
          ["税费口径", r.taxBasis],
        ]) +
        categoryLinks(r) +
        sourceSummary(r)
      );
    if (key === "recruitmentExamples")
      return (
        heading(r.jobTitle, name("employers", r.employerId)) +
        facts([
          [
            "资料类别",
            r.salary ? formatType(r.salary.dataType) : "历史招聘资料",
          ],
          ["届别", r.cohort],
          ["学历要求", r.educationRequirement],
          ["专业要求", r.majorRequirement],
          ["金额", amount(recruitmentAmount(r.salary))],
          [
            "招聘城市",
            (r.cityIds || []).map((id) => name("cities", id)).join("、"),
          ],
        ]) +
        note(r.details) +
        marketSections(r) +
        custom("关联企业", marketLink("employers", r.employerId)) +
        sourceSummary(r)
      );
    const cityData =
      key === "cities"
        ? [
            ["产业", r.mainComputerIndustries],
            ["常见岗位", r.commonJobs],
            ["薪资参考", cityMarketPay(r)],
            ["薪资口径", r.cityMarketSalaryReference?.scope],
            [
              "挂牌租金",
              r.rent?.average == null ? null : `${r.rent.average} 元/平方米/月`,
            ],
            ["租金时期", r.rent?.period],
            ["租金样本", r.rent?.sample],
            [
              "合租生活预算",
              amount(r.livingCosts?.sharedHousingTotalMonthlyBudget),
            ],
            [
              "整租生活预算",
              amount(r.livingCosts?.wholeHousingTotalMonthlyBudget),
            ],
            ["预算假设", r.livingCosts?.nonHousingMonthlyCost?.notes],
          ]
        : [
            ["主要业务", r.mainBusiness],
            ["人才需求", r.talentDemand],
            ["学历要求", r.educationRequirements],
            ["专业要求", r.majorRequirements],
          ];
    return (
      heading(r.name, sectionsByMarket[key][0]) +
      facts(cityData) +
      note(r.development || r.recentDevelopment) +
      (r.officialRecruitmentUrl
        ? sources([{ url: r.officialRecruitmentUrl, title: "企业招聘官网" }])
        : "") +
      sourceSummary(r.rent) +
      sourceSummary(r.livingCosts) +
      sourceSummary(r.cityMarketSalaryReference) +
      marketSections(r) +
      sourceSummary(r)
    );
  }

  function distribution(label, rows) {
    if (!rows?.length) return "";
    const objectRows = rows
      .map((row) => (typeof row === "string" ? { name: row } : row))
      .filter((row) => row.name);
    if (!objectRows.length) return "";
    const rate = objectRows.every((row) => row.rate != null);
    const count = objectRows.every((row) => row.count != null);
    if (objectRows.every((row) => row.count == null && row.rate == null)) {
      return `<h3>${esc(label)}</h3><p>${esc([...new Set(objectRows.map((row) => row.name))].join("、"))}</p>`;
    }
    const key = rate ? "rate" : count ? "count" : null;
    const max = rate
      ? 100
      : Math.max(1, ...objectRows.map((row) => row.count || 0));
    return (
      `<h3>${esc(label)}</h3>` +
      table(
        key
          ? ["去向", "人数", "比例", "分布", "统计分母"]
          : ["去向", "人数", "比例", "统计分母"],
        objectRows.map((row) => [
          esc(row.name),
          esc(show(row.count)),
          esc(show(row.rate, "%")),
          ...(key
            ? [
                `<meter min="0" max="${max}" value="${row[key]}" aria-label="${esc(row.name)}"></meter>`,
              ]
            : []),
          esc(show(row.denominator)),
        ]),
      )
    );
  }
  function employmentRecord(record) {
    const stats = Object.entries(employmentFields)
      .filter(([key]) => record[key] != null)
      .map(([key, title]) => [
        title,
        show(record[key], key.includes("Rate") ? "%" : " 人"),
      ]);
    if (record.salary?.averageAnnualCNY != null)
      stats.push([
        "平均入职年薪",
        show(record.salary.averageAnnualCNY, " 元/年"),
      ]);
    return (
      (stats.length ? facts(stats) : "") +
      note(record.employmentRateDefinition) +
      note(record.salary?.definition) +
      distribution("就业行业", record.industries) +
      distribution("就业单位类型", record.employerTypes) +
      distribution("就业地区", record.employmentRegions) +
      distribution("就业城市", record.employmentCities) +
      distribution("用人单位人数", record.employerCounts) +
      (record.representativeEmployers?.length
        ? note("原文列举单位包括" + record.representativeEmployers.join("、"))
        : "") +
      sourceSummary(record)
    );
  }
  function schoolEmployment(schoolId) {
    const items = employmentBySchool.get(schoolId);
    const records = items.employmentRecords;
    const cases = items.employmentCases;
    const partnerships = items.industryPartnerships;
    return custom(
      "高校就业资料",
      (records.length
        ? records
            .map((r) =>
              details(
                `${r.graduationYear ? r.graduationYear + " 届 · " : ""}${scope(r)}`,
                employmentRecord(r),
              ),
            )
            .join("")
        : "") +
        (cases.length
          ? `<h3>就业去向案例</h3>${cases.map((r) => details([r.graduationYear, r.college, r.major].filter(Boolean).join(" · ") || "去向案例", note(r.description) + sourceSummary(r))).join("")}`
          : "") +
        (partnerships.length
          ? `<h3>校企合作与培养资料</h3>${partnerships.map((r) => details(r.projectName, note(r.description) + sourceSummary(r))).join("")}`
          : "") +
        "",
    );
  }
  function forProject(project) {
    return employmentBySchool
      .get(project.schoolId)
      .employmentRecords.filter(
        (r) =>
          r.college === project.college &&
          (!r.major ||
            r.major === project.major.title ||
            r.major === project.majorLabel ||
            r.major.includes(project.majorId)),
      );
  }
  function comparisonEmployment(project) {
    const rows = forProject(project);
    return rows.length
      ? esc([...new Set(rows.map(scope))].join(" / "))
      : link("school", "院校就业资料 →", project.schoolId);
  }
  function searchRows() {
    return [
      ...Object.entries(market).flatMap(([key, rows]) =>
        rows.map((r) => [
          sectionsByMarket[key][1],
          r.id,
          r.name || `${name("employers", r.employerId)} · ${r.jobTitle}`,
          [
            r.mainBusiness,
            r.details,
            r.scope,
            r.population,
            r.notes,
            formatType(r.dataType),
          ]
            .filter(Boolean)
            .join(" "),
        ]),
      ),
      ...employment.employmentRecords.map((r) => [
        "school",
        r.schoolId,
        `${schools.get(r.schoolId).name} · 就业 · ${scope(r)}`,
        [
          r.graduationYear,
          r.notes,
          ...(r.representativeEmployers || []),
          ...(r.industries || []).map((v) => v.name || v),
          ...(r.employmentCities || []).map((v) => v.name || v),
          ...(r.employmentRegions || []).map((v) => v.name || v),
        ]
          .filter(Boolean)
          .join(" "),
      ]),
      ...[
        ...employment.employmentCases,
        ...employment.industryPartnerships,
      ].map((r) => [
        "school",
        r.schoolId,
        `${schools.get(r.schoolId).name} · ${r.projectName || "就业去向案例"}`,
        r.description,
      ]),
    ];
  }

  return {
    marketSections,
    careerContext,
    bandTable,
    marketIndex,
    marketDetail,
    schoolEmployment,
    comparisonEmployment,
    searchRows,
  };
}
