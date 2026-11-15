import { Pool } from "pg";

declare global {
    var _voyagePgPool: Pool | undefined;
}

export function getPool(): Pool {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("Variable DATABASE_URL manquante (.env ou Vercel Environment Variables).");
    }

    if (!globalThis._voyagePgPool) {
        const isLocal =
            connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
        globalThis._voyagePgPool = new Pool({
            connectionString,
            max: 5,
            ssl: isLocal ? false : { rejectUnauthorized: false },
        });
    }

    return globalThis._voyagePgPool;
}