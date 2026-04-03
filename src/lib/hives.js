import cardsData from "../data/cards.json";

export const DCO_ROLE = "Délégué au Contrat d'Objectifs";

export const HIVE_KINDS = {
  STANDARD: "STANDARD",
  DCO: "DCO",
};

const DCO_CARD_IDS = new Set(
  cardsData
    .filter((card) => card?.DCO === "yes")
    .map((card) => String(card.id)),
);

export function normalizeHiveKind(value) {
  const raw = String(value || "").trim().toUpperCase();
  return raw === HIVE_KINDS.DCO ? HIVE_KINDS.DCO : HIVE_KINDS.STANDARD;
}

export function isDcoRole(roleLabel) {
  return roleLabel === DCO_ROLE;
}

export function resolveDefaultHiveKind(roleLabel) {
  return isDcoRole(roleLabel) ? HIVE_KINDS.DCO : HIVE_KINDS.STANDARD;
}

export function filterCardsForHiveKind(cards, hiveKind) {
  if (normalizeHiveKind(hiveKind) !== HIVE_KINDS.DCO) {
    return cards;
  }

  return cards.filter((card) => DCO_CARD_IDS.has(String(card.id)));
}
