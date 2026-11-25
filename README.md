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
| `schools.json` | 院校数组。保留 `id`，用 `name`、`city`、`province` 和 `aliases` 提供名称及搜索别名。可添加 `sections`、`sources`。 |
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
- 如果多个方向共享名额，在 `sharedPlans` 中按年度记录一份，填 `projectIds` 和具体 `scope`。成员年度只填同一 `sharedPlanId`，对应的共享名额字段留 `null`。尚未建档的方向写入 `scope`。页面给共享数值加标识，各方向的共享名额不能相加。

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
  "sharedPlanId": "whu-211-085404-full-time",
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
