import { prisma } from "../lib/prisma.js";
import { verifyAccessToken, sanitizeUser, isAdminEmail } from "../lib/auth.js";

export async function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      error: "Authentication required",
      code: "AUTH_REQUIRED",
    });
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user) {
      return res.status(401).json({
        error: "Invalid user",
        code: "AUTH_INVALID_USER",
      });
    }

    req.user = {
      ...sanitizeUser(user),
      isAdmin: isAdminEmail(user.email),
    };

    return next();
  } catch (error) {
    if (
      error?.name === "TokenExpiredError"
      || error?.name === "JsonWebTokenError"
      || error?.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        error: "Invalid or expired session",
        code: "AUTH_SESSION_INVALID",
      });
    }

    return next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({
      error: "Admin access required",
      code: "AUTH_ADMIN_REQUIRED",
    });
  }
  return next();
}
