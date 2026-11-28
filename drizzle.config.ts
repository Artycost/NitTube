import { defineConfig } from 'drizzle-kit';
import { readFileSync } from 'node:fs';

function loadEnv() {
	if (process.env.DATABASE_URL) return;
	try {
		const raw = readFileSync('.env', 'utf8');
		for (const line of raw.split(/\r?\n/)) {
			const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
			if (match) process.env[match[1]] ??= match[2];
		}
	} catch {
		// ignore
	}
}

loadEnv();

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'sqlite',
	dbCredentials: { url: process.env.DATABASE_URL },
	verbose: true,
	strict: true
});
