import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, "../../../.env");

dotenv.config({ path: rootEnvPath });

if (!process.env.DATABASE_URL) {
	process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ruche_dev?schema=public";
}

export const prisma = new PrismaClient();
