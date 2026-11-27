export const dataFiles = {
  schools: "schools",
  catalog: "projects",
  admissions: "admissions",
  training: "training",
  majors: "majors",
  careers: "careers",
  knowledge: "knowledge",
  handbook: "handbook",
  news: "news",
  national: "national-stats",
  research: "research-directions",
  market: "career-market",
  employment: "employment",
};

export const projectRef = (id, year) => `${id}-${year}`;

export async function loadPublicData() {
  const entries = await Promise.all(
    Object.entries(dataFiles).map(async ([key, file]) => {
      const response = await fetch(`data/${file}.json`);
      if (!response.ok)
        throw Error(`data/${file}.json: HTTP ${response.status}`);
      return [key, await response.json()];
    }),
  );
  return Object.fromEntries(entries);
}

export function latestDataDate(value) {
  if (!value || typeof value !== "object") return null;
  let latest = null;
  for (const [key, child] of Object.entries(value)) {
    const date =
      ["updatedAt", "verifiedOn", "date", "surveyDate"].includes(key) &&
      typeof child === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(child)
        ? child
        : latestDataDate(child);
    if (date && (!latest || date > latest)) latest = date;
  }
  return latest;
}

export function admissionRecords(data) {
  const schools = new Map(data.schools.map((school) => [school.id, school]));
  const majors = new Map(data.majors.map((major) => [major.id, major]));
  const byYear = (list, key) =>
    new Map(
      list.map((record) => [projectRef(record[key], record.year), record]),
    );
  const admissions = byYear(data.admissions, "projectId");
  const training = byYear(data.training, "projectId");
  const shared = byYear(data.catalog.sharedPlans, "id");
  const historyByProject = new Map();
  const byRef = new Map();
  const latest = [];
  const all = [];
  for (const project of data.catalog.projects) {
    const school = schools.get(project.schoolId);
    const major = majors.get(project.majorId);
    const history = [...project.years]
      .sort((a, b) => b.year - a.year)
      .map((annual) => {
        const ref = projectRef(project.id, annual.year);
        const trainingRecord = training.get(ref);
        const result = {
          ...project,
          school,
          major,
          annual,
          ref,
          year: annual.year,
          city: trainingRecord?.city ?? school.city,
          admission: admissions.get(ref),
          training: trainingRecord,
          sharedGroups: (
            annual.groupIds ??
            (annual.sharedPlanId ? [annual.sharedPlanId] : [])
          )
            .map((id) => shared.get(projectRef(id, annual.year)))
            .filter(Boolean),
        };
        delete result.years;
        byRef.set(ref, result);
        all.push(result);
        return result;
      });
    historyByProject.set(project.id, history);
    if (history.length) {
      latest.push(history[0]);
      byRef.set(project.id, history[0]);
    }
  }
  return { all, latest, byRef, historyByProject };
}
