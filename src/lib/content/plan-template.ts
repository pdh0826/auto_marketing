export const CONTENT_PLAN_TEMPLATE = {
  titleCandidates: [],
  targetKeyword: "",
  searchIntent: "",
  audience: "",
  coreMessage: "",
  outline: [],
  ctaPlan: "",
  mediaPlan: [],
  faq: [],
  risks: []
} satisfies Record<string, unknown>;

export function formatPlanJson(planJson: Record<string, unknown> | null | undefined) {
  return JSON.stringify(planJson ?? CONTENT_PLAN_TEMPLATE, null, 2);
}

export function hasUsablePlanJson(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const plan = value as Record<string, unknown>;
  return Object.values(plan).some((entry) => {
    if (Array.isArray(entry)) {
      return entry.length > 0;
    }
    if (typeof entry === "string") {
      return entry.trim().length > 0;
    }
    return entry !== null && entry !== undefined;
  });
}
