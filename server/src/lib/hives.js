export const HIVE_KINDS = {
  STANDARD: "STANDARD",
  DCO: "DCO",
};

export const VALID_HIVE_KINDS = Object.values(HIVE_KINDS);

export function normalizeHiveKind(value) {
  const raw = String(value || "").trim().toUpperCase();
  return VALID_HIVE_KINDS.includes(raw) ? raw : HIVE_KINDS.STANDARD;
}
