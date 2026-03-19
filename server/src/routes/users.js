import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const usersRouter = Router();

const deleteMeSchema = z.object({
  confirmation: z.string(),
  password: z.string().min(1),
});

usersRouter.delete("/me", requireAuth, async (req, res) => {
  const parsed = deleteMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Confirmation invalide" });
  }

  if (parsed.data.confirmation !== "DELETE") {
    return res.status(400).json({ error: "Veuillez confirmer avec DELETE" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    return res.status(404).json({ error: "Utilisateur introuvable" });
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Mot de passe incorrect" });
  }

  await prisma.user.delete({ where: { id: req.user.id } });
  return res.json({ message: "Profil supprime" });
});
