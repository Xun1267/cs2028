# CS 2028

面向计算机考研的静态信息网站。维护时直接编辑 `public/data/` 的 JSON，网页会读取并关联这些记录。

## 本机运行

需要 Python 3 和 Node.js 22.7 或更新版本。网站本身无需安装依赖。

```sh
node scripts/check-data.mjs
python3 -m http.server 8028 --bind 127.0.0.1 --directory public
```

使用 [本机预览](http://127.0.0.1:8028/)核对数据和来源。校验脚本检查 JSON 解析、重复 ID 和年度、关联、数值范围及共享计划的重复记录。来源的真实性和数据口径需查阅原文。

## 数据文件

以下路径均相对于 `public/data/`。

| 文件 | 结构和用途 |
| --- | --- |
| `schools.json` | 院校数组。保留 `id`，用 `name`、`city`、`province` 和 `aliases` 提供名称及搜索别名。计算机学科评估可填 `computingAssessment`，包含 `grade`、`round`、`year` 和 `sources`。可添加 `sections`、`sources`。 |
| `projects.json` | 包含 `projects` 和 `sharedPlans` 两个数组。项目通过 `schoolId`、`majorId` 关联院校和专业，在 `years` 中逐年补充考试与计划。 |
| `admissions.json` | 按 `projectId` 和 `year` 记录实际报名、复试、录取、报录比、复录比、成绩与复试要求。 |
| `training.json` | 按 `projectId` 和 `year` 记录 `tuitionPerYear`（元/年）、`durationYears`（年）、`location`（地点）、`city`（用于筛选）及 `note`。 |
| `majors.json` | 专业数组。专业代码作为字符串 `id`，另有 `title`、`degree`、`summary`、`careerIds` 和 `sections`。 |
| `careers.json` | 职业数组。使用稳定的 `id`、`title`、`summary`、`industry` 和 `sections`。专业与职业的关联由专业的 `careerIds` 生成。 |
| `knowledge.json` | 知识条目数组。每条包含 `id`、`title`、`summary` 和 `sections`。 |
| `news.json` | 公告数组。每条包含 `id`、`title`、`date`、`schoolId` 和 `sources`。全国性公告的 `schoolId` 可用 `null`。 |
| `national-stats.json` | 全国报名统计。含 `title`、`unit`、`scope`、报考目标 `target` 和按年度记录的 `series`。 |

## 填写规则与示例

- 先查招生单位、主管部门或用人单位的原始资料。日期写 `YYYY-MM-DD`，年度写整数，例如 `2027`。人数、分数、费用和比值写数字，未知值写 `null`。专业代码和科目代码保留字符串形式，例如 `"085404"`。
- 纠错时直接修改对应记录，并填写或更新 `updatedAt`。可用 `sources[].verifiedOn` 记录最近核对原文的日期。首页从记录日期、核验日期和公告日期中取最近一天。
- 同一院校、学院、专业、方向和学习方式的项目保持原 `id`。新增年度在该项目 `years` 追加，项目 ID 自身不带年份。在院校和专业页展示最近一个有记录的年度，院校筛选和对比也可选历史年度。项目链接 `#project/项目ID` 打开最新记录，`#project/项目ID-年度` 打开指定年度。已有链接和浏览器收藏仍可使用。
- 如果多个方向共享名额，在 `sharedPlans` 中按年度记录一份，填 `projectIds` 和具体 `scope`。成员年度在 `groupIds` 关联该统计组，对应的共享名额字段留 `null`。尚未建档的方向写入 `scope`。页面给共享数值加标识，各方向的共享名额不能相加。

项目 `years` 中的一条年度记录示例，完整项目和共享计划见 [projects.json](public/data/projects.json)。

```json
{
  "year": 2027,
  "examCombo": "22408",
  "subjects": [
    {"code": "101", "name": "思想政治理论"},
    {"code": "204", "name": "英语二"},
    {"code": "302", "name": "数学二"},
    {"code": "408", "name": "计算机学科专业基础"}
  ],
  "planned": null,
  "promotionPlanned": null,
  "examPlanned": null,
  "groupIds": ["whu-211-085404-full-time"],
  "updatedAt": "2026-11-25",
  "sources": [{
    "title": "211计算机学院（2027年）",
    "url": "https://gs.whu.edu.cn/info/2581/108911.htm",
    "year": 2027,
    "scope": "085404 全日制方向 01 和 02 合计",
    "publisher": "武汉大学"
  }]
}
```

`admissions.json` 的人数使用 `applicants`、`interviewees`、`examAdmissions`、`promotionAdmissions`。普通统考报录比、复录比使用 `applicationRatio`、`interviewRatio`，例如 `3.5` 表示 3.5∶1。分数使用 `cutoff`、`minimum`、`maximum`、`average`、`median`，分段用 `scoreDistribution: [{"min": 340, "max": 349, "count": 8}]`。用 `interviewRequirements` 记录复试要求，用 `scope` 注明具体统计范围，并提供适用年度对应的 `sources`。以上分段数值仅演示格式。

实考人数使用 `examAttendees`，进入复试名单的人数使用 `interviewEligible`，实际参加复试的人数使用 `interviewees`。实考人数与统考录取人数口径一致时，可以补充 `examAttendanceRatio`。录取分段填 `scoreDistribution`，复试名单分段填 `interviewScoreDistribution`，两者均使用 `min`、`max`、`count`。确认旧 `reportedAdmissions` 与实际统考录取口径一致时，优先填入 `examAdmissions`。同一年度的招生计划、录取结果及成绩资料可分别用来源的 `kind` 指定位置，取值为 `catalog`、`history`、`scores`、`retest` 或 `training`，链接文字可填 `shortTitle`。

文章的 `sections` 可包含多个对象。每节使用 `title`，按需要填写 `paragraphs`（每段一个字符串）、`table`、`chart` 和 `sources`。表格和图表示例：

```json
{
  "title": "统计表阅读示例",
  "paragraphs": ["先核对招生年度、考试科目与统计范围。"],
  "table": {"headers": ["年度", "人数"], "rows": [[2026, 12], [2027, null]]},
  "chart": {
    "title": "年度人数示例",
    "unit": "人",
    "points": [{"label": "2025", "value": 10}, {"label": "2026", "value": 12}]
  }
}
```

## 提交与发布

修正或补充 JSON 后运行校验，检查网页，再提交至 GitHub。生产项目在 Vercel 使用仓库根目录，`vercel.json` 直接发布 `public/`。在项目的 Git 设置连接 `Xun1267/cs2028` 并选择 `main` 作为 Production Branch 后，合入 `main` 会触发生产部署。

收藏、备注和对比方案存放在当前浏览器。可从数据管理页导出或恢复个人 JSON 备份。

## 调查数据补充

`projects.json` 的项目和年度使用 `status` 标记核验状态。取值包括 `current`（已核验目录）、`historical`（历史资料）、`pending`（待核验）和 `excluded`（专项、推免等范围外项目）。目录状态与录取资料来源分别核对。普通统考实际录取填 `examAdmissions`，口径未明确的资料所列人数填 `reportedAdmissions`，名单所见最低分填 `observedMinimum`。箱线图需要 `minimum`、`q1`、`median`、`q3`、`maximum` 五个同口径分数。

同一项目年度可填写 `groupIds` 关联多条 `sharedPlans` 统计组。填写每组的 `projectIds`、`scope`、`sources` 和组级人数；组级录取成绩及人数放在 `admission`。同组数值不可按方向相加。方向独立公布、且口径不同的数据可以留在项目年度或 `admissions.json`。培养总学费用 `tuitionTotal`（元），已公布的年学费用 `tuitionPerYear`（元/年）。

历史大类用独立项目保存，由后续项目的 `historicalPredecessorIds` 引用。年度的 `officialMajorCode` 保留当年代码。录取人数有细分时，`examAdmissionsTotal` 填统考总人数，`examAdmissions` 填已明确的普通统考人数，专项和调剂分别用 `specialPlanAdmissions`、`transferAdmissions`。同一分段的复试及录取数用 `scoreBandOutcomes`，每项包含 `min`、`max`、`interviewees`、`admitted`。开放上限可加 `openEnded: true`。

| 文件 | 用途 |
| --- | --- |
| `research-directions.json` | 研究专题文章。用 `majorIds` 及 `researchIds` 关联专业和其他研究方向。 |
| `career-market.json` | 行业、企业、就业城市、薪资记录及招聘案例。薪资保留 `dataType`、`unit`、`population`、时间、样本及来源。工资统计、招聘报价、个人 Offer 与参考区间分开录入。城市挂牌租金以元/平方米/月记录，生活预算注明假设。 |
| `employment.json` | 高校就业覆盖、毕业统计、去向案例、校企合作。按 `schoolId` 关联院校，按 `scope`、`college`、`major`、`graduationYear` 区分样本。各类比例使用 0–100 的数值，分布记录注明 `denominator`。合作计划与毕业去向分开。 |

新增或修正数据后运行校验。历史记录、待核验记录及第三方统计可以保留真实信息与出处，未知的年度或数值留空，资料完全缺失的占位记录无需录入。
