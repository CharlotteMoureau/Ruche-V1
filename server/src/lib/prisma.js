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

function ensureParam(urlValue, key, value) {
	try {
		const url = new URL(urlValue);
		if (!url.searchParams.has(key)) {
			url.searchParams.set(key, value);
		}
		return url.toString();
	} catch {
		return urlValue;
	}
}

function normalizeSupabaseUrl(urlValue, { pooled = false } = {}) {
	if (!urlValue || !urlValue.includes("supabase.co")) {
		return urlValue;
	}

	let normalized = ensureParam(urlValue, "schema", "public");
	normalized = ensureParam(normalized, "sslmode", "require");

	if (pooled || normalized.includes(".pooler.supabase.com")) {
		normalized = ensureParam(normalized, "pgbouncer", "true");
		normalized = ensureParam(normalized, "connection_limit", "1");
	}

	return normalized;
}

process.env.DATABASE_URL = normalizeSupabaseUrl(process.env.DATABASE_URL, {
	pooled: process.env.DATABASE_URL?.includes(".pooler.supabase.com") || false,
});

if (process.env.DIRECT_URL) {
	process.env.DIRECT_URL = normalizeSupabaseUrl(process.env.DIRECT_URL);
}

export const prisma = new PrismaClient();
