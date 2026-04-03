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

const ROLE_ALIASES = {
  "Délégué PECA": ["PECA representative", "PECA-afgevaardigde"],
  "Délégué au Contrat d'Objectifs": [
    "Objectives Contract delegate",
    "Afgevaardigde van het doelstellingencontract",
  ],
  Direction: ["School leadership", "Directie"],
  Enseignant: ["Teacher", "Leerkracht"],
  Educateur: ["Educator", "Opvoeder"],
  "Membre d'un CPMS": ["CPMS member", "Lid van een CLB"],
  "Futur enseignant": ["Future teacher", "Toekomstige leerkracht"],
  "Intervenant culturel": ["Cultural practitioner", "Cultureel begeleider"],
  "Etudiant en Ecole Superieure des Arts": [
    "Arts college student",
    "Student aan een kunsthogeschool",
  ],
  "Référent culturel": ["Cultural coordinator", "Cultureel referentiepersoon"],
  "Référent scolaire": ["School coordinator", "Schoolreferentiepersoon"],
  Autre: ["Other", "Andere"],
};

function normalizeRoleKey(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const roleByNormalizedKey = new Map();

USER_ROLES.forEach((role) => {
  roleByNormalizedKey.set(normalizeRoleKey(role), role);

  (ROLE_ALIASES[role] || []).forEach((alias) => {
    roleByNormalizedKey.set(normalizeRoleKey(alias), role);
  });
});

export function normalizeRole(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  return roleByNormalizedKey.get(normalizeRoleKey(raw)) || raw;
}
