export const USER_ROLES = [
  "Délégué PECA",
  "Délégué au Contrat d'Objectifs",
  "Direction",
  "Enseignant",
  "Educateur",
  "Membre d'un CPMS",
  "Futur enseignant",
  "Intervenant culturel",
  "Etudiant en Ecole Superieure des Arts",
  "Référent culturel",
  "Référent scolaire",
  "Autre",
];

export function normalizeRole(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const key = raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  const byKey = new Map(
    USER_ROLES.map((role) => [
      role
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase(),
      role,
    ]),
  );

  return byKey.get(key) || raw;
}
