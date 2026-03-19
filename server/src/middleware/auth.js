import { prisma } from "../lib/prisma.js";
import { verifyAccessToken, sanitizeUser, isAdminEmail } from "../lib/auth.js";

export async function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Authentification requise" });
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user) {
      return res.status(401).json({ error: "Utilisateur invalide" });
    }

    req.user = {
      ...sanitizeUser(user),
      isAdmin: isAdminEmail(user.email),
    };

    return next();
  } catch {
    return res.status(401).json({ error: "Session invalide ou expiree" });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Acces reserve a l'administrateur" });
  }
  return next();
}
