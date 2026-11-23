import {
  getDaliAuditHealth,
  getDaliAuditInspections,
  getDaliAuditReport,
  getDaliAuditStores,
  referDaliAuditComplaint,
} from "../services/daliAuditClient.js";

const listRecords = (response, collection) => {
  const records = Array.isArray(response)
    ? response
    : Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.[collection])
        ? response[collection]
        : null;
  if (!records || records.some((record) => !record || typeof record !== "object" || Array.isArray(record))) {
    throw new Error(`DALIAudit returned an invalid ${collection} response.`);
  }

  return records.map((record) => ({
    fields: Object.entries(record).map(([key, value]) => ({
      label: key
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]/g, " ")
        .replace(/^\w/, (letter) => letter.toUpperCase()),
      value: value === null || value === undefined
        ? "—"
        : typeof value === "object" ? JSON.stringify(value) : String(value),
    })),
  }));
};

const errorMessage = (reason) =>
  reason instanceof Error ? reason.message : "An unknown error occurred.";

export const daliAuditPage = async (req, res) => {
  const filters = { storeCode: "", status: "" };
  const filterErrors = [];

  for (const field of Object.keys(filters)) {
    const value = req.query[field];
    if (value === undefined) continue;
    if (
      typeof value !== "string" ||
      (field === "storeCode" && !/^[A-Za-z0-9_-]{1,32}$/.test(value.trim())) ||
      (field === "status" && (!value.trim() || value.trim().length > 64))
    ) {
      filterErrors.push(field === "storeCode"
        ? "Store code must contain 1-32 letters, numbers, underscores, or hyphens."
        : "Status must be a non-empty value of at most 64 characters.");
      continue;
    }
    filters[field] = value.trim();
  }

  const storesTask = getDaliAuditStores().then((response) => listRecords(response, "stores"));
  const inspectionsTask = filterErrors.length
    ? Promise.resolve(null)
    : getDaliAuditInspections({
      ...(filters.storeCode ? { storeCode: filters.storeCode } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    }).then((response) => listRecords(response, "inspections"));

  const [storesResult, inspectionsResult] = await Promise.allSettled([storesTask, inspectionsTask]);
  const storesError = storesResult.status === "rejected" ? errorMessage(storesResult.reason) : null;
  const inspectionsError = filterErrors.length
    ? filterErrors.join(" ")
    : inspectionsResult.status === "rejected" ? errorMessage(inspectionsResult.reason) : null;

  res.render("daliaudit", {
    title: "DALIAudit",
    stores: storesResult.status === "fulfilled" ? storesResult.value : [],
    storesError,
    inspections: inspectionsResult.status === "fulfilled" && inspectionsResult.value
      ? inspectionsResult.value
      : [],
    inspectionsError,
    filters,
  });
};

export const daliAuditHealth = async (req, res) => {
  res.json(await getDaliAuditHealth());
};

export const daliAuditStores = async (req, res) => {
  res.json(await getDaliAuditStores());
};

export const daliAuditInspections = async (req, res) => {
  res.json(await getDaliAuditInspections({
    storeCode: req.query.storeCode,
    status: req.query.status,
  }));
};

export const daliAuditReport = async (req, res) => {
  res.json(await getDaliAuditReport(req.params.reportCode));
};

export const daliAuditComplaintReferral = async (req, res) => {
  res.status(201).json(await referDaliAuditComplaint(req.body));
};
