import type { IncomingMessage, ServerResponse } from "http";
import express from "express";
import crypto from "crypto";
import multer from "multer";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { getPool } from "./db.js";

dotenv.config();

function getGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
}

// ✅ Mémoire uniquement : compatible Vercel et local, les photos vont dans PostgreSQL (BYTEA)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 },
});

const ADMIN_USER = {
    id: 1,
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "eni2026",
    email: "admin@eni.mg",
    first_name: "Administrateur",
    last_name: "ENI",
};

const AUTH_SECRET =
    process.env.AUTH_SECRET ||
    `${ADMIN_USER.username}:${ADMIN_USER.password}:voyagee-eni-secret`;

function createSignedToken(type: "access" | "refresh"): string {
    const payload = Buffer.from(
        JSON.stringify({ sub: ADMIN_USER.username, type, iat: Date.now() })
    ).toString("base64url");
    const sig = crypto
        .createHmac("sha256", AUTH_SECRET)
        .update(payload)
        .digest("base64url");
    return `${payload}.${sig}`;
}

function verifySignedToken(token: string): boolean {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [payload, sig] = parts;
    const expected = crypto
        .createHmac("sha256", AUTH_SECRET)
        .update(payload)
        .digest("base64url");
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

function validHttpUrl(value?: string): string {
    if (!value) return "";
    const trimmed = value.trim().replace(/\/$/, "");
    return /^https?:\/\/.+/i.test(trimmed) ? trimmed : "";
}

function getBaseUrl(req: express.Request): {
    frontend: string;
    backend: string;
    mediaBase: string;
} {
    const host = req.get("host");
    const origin = host ? `${req.protocol}://${host}` : "";
    const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
    const frontend =
        validHttpUrl(process.env.PUBLIC_FRONTEND_URL) ||
        validHttpUrl(process.env.APP_URL) ||
        origin ||
        vercelUrl;
    const explicitBackend = validHttpUrl(process.env.PUBLIC_BACKEND_URL);
    const backend = explicitBackend || validHttpUrl(process.env.APP_URL) || origin || vercelUrl;
    const mediaBase = explicitBackend || "";
    return { frontend, backend, mediaBase };
}

function formatEtudiant(row: Record<string, any>, mediaBase: string) {
    return {
        id: row.id,
        matricule: row.matricule,
        nom: row.nom,
        prenom: row.prenom,
        parcours: row.parcours,
        email: row.email,
        telephone: row.telephone,
        photo: row.photo || null,
        photo_url: row.photo ? `${mediaBase}${row.photo}` : null,
        qr_token: row.qr_token,
        voiture_numero: row.voiture_numero ?? null,
        voiture_id: row.voiture_id ?? null,
    };
}

function requireAuth(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        res.status(401).json({ detail: "Authentification requise." });
        return;
    }
    const token = header.slice(7);
    if (!verifySignedToken(token)) {
        res.status(401).json({ detail: "Token invalide ou expiré." });
        return;
    }
    next();
}

export async function createApp() {
    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());

    // ============ AUTH ============
    app.post("/api/auth/login/", (req, res) => {
        const { username, password } = req.body || {};
        if (username === ADMIN_USER.username && password === ADMIN_USER.password) {
            res.json({
                access: createSignedToken("access"),
                refresh: createSignedToken("refresh"),
            });
            return;
        }
        res.status(401).json({ detail: "Identifiants invalides." });
    });

    app.post("/api/auth/refresh/", (_req, res) => {
        res.json({ access: createSignedToken("access") });
    });

    app.get("/api/auth/me/", requireAuth, (_req, res) => {
        res.json({
            id: ADMIN_USER.id,
            username: ADMIN_USER.username,
            email: ADMIN_USER.email,
            first_name: ADMIN_USER.first_name,
            last_name: ADMIN_USER.last_name,
        });
    });

    // ============ CORE PARAMETRES ============
    app.get("/api/core/parametres/", async (_req, res) => {
        try {
            const pool = getPool();
            const { rows } = await pool.query(
                "SELECT id, date_debut, date_fin, destination, ecole, annee_promotion, nom_responsable, tel_responsable, nom_responsable_sante, tel_responsable_sante FROM parametres_voyage WHERE id = 1"
            );
            res.json(rows);
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    const updateParametres = async (req: express.Request, res: express.Response) => {
        try {
            const pool = getPool();
            const b = req.body || {};
            const { rows } = await pool.query(
                `UPDATE parametres_voyage SET
          date_debut = COALESCE($1, date_debut),
          date_fin = COALESCE($2, date_fin),
          destination = COALESCE($3, destination),
          ecole = COALESCE($4, ecole),
          annee_promotion = COALESCE($5, annee_promotion),
          nom_responsable = COALESCE($6, nom_responsable),
          tel_responsable = COALESCE($7, tel_responsable),
          nom_responsable_sante = COALESCE($8, nom_responsable_sante),
          tel_responsable_sante = COALESCE($9, tel_responsable_sante),
          updated_at = NOW()
        WHERE id = 1
        RETURNING id, date_debut, date_fin, destination, ecole, annee_promotion, nom_responsable, tel_responsable, nom_responsable_sante, tel_responsable_sante`,
                [
                    b.date_debut ?? null,
                    b.date_fin ?? null,
                    b.destination ?? null,
                    b.ecole ?? null,
                    b.annee_promotion ?? null,
                    b.nom_responsable ?? null,
                    b.tel_responsable ?? null,
                    b.nom_responsable_sante ?? null,
                    b.tel_responsable_sante ?? null,
                ]
            );
            res.json(rows[0]);
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    };

    app.post("/api/core/parametres/", requireAuth, updateParametres);
    app.put("/api/core/parametres/:id/", requireAuth, updateParametres);
    app.patch("/api/core/parametres/:id/", requireAuth, updateParametres);

    // ============ ETUDIANTS ============
    app.get("/api/etudiants/", async (req, res) => {
        try {
            const pool = getPool();
            const { mediaBase } = getBaseUrl(req);
            const search = String(req.query.search || "").trim().toLowerCase();
            const parcours = String(req.query.parcours || "").trim().toUpperCase();

            const params: any[] = [];
            const conditions: string[] = [];

            if (search) {
                params.push(`%${search}%`);
                conditions.push(
                    `(LOWER(e.nom) LIKE $${params.length} OR LOWER(e.prenom) LIKE $${params.length} OR LOWER(e.matricule) LIKE $${params.length})`
                );
            }
            if (parcours) {
                params.push(parcours);
                conditions.push(`e.parcours = $${params.length}`);
            }

            const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
            const { rows } = await pool.query(
                `SELECT e.id, e.matricule, e.nom, e.prenom, e.parcours, e.email, e.telephone, e.photo, e.qr_token,
                v.id AS voiture_id, v.numero_voiture
         FROM etudiants e
         LEFT JOIN affectations a ON a.etudiant = e.id
         LEFT JOIN voitures v ON v.id = a.voiture
         ${whereClause}
         ORDER BY e.id DESC`,
                params
            );

            res.json(rows.map((r) => formatEtudiant(r, mediaBase)));
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.get("/api/etudiants/:id/photo/", async (req, res) => {
        try {
            const pool = getPool();
            const { rows } = await pool.query(
                "SELECT photo_data, photo_mime FROM etudiants WHERE id = $1",
                [Number(req.params.id)]
            );
            if (!rows[0] || !rows[0].photo_data) {
                res.status(404).end();
                return;
            }
            res.setHeader("Content-Type", rows[0].photo_mime || "image/jpeg");
            res.setHeader("Cache-Control", "no-store");
            res.send(rows[0].photo_data);
        } catch {
            res.status(500).end();
        }
    });

    app.post("/api/etudiants/", requireAuth, upload.single("photo"), async (req, res) => {
        try {
            const pool = getPool();
            const { mediaBase } = getBaseUrl(req);
            const body = req.body || {};

            if (!body.matricule || !body.nom || !body.prenom || !body.parcours) {
                res.status(400).json({ detail: "Matricule, nom, prénom et parcours sont obligatoires." });
                return;
            }

            const existing = await pool.query(
                "SELECT id FROM etudiants WHERE LOWER(matricule) = LOWER($1)",
                [String(body.matricule).trim()]
            );
            if (existing.rows.length > 0) {
                res.status(400).json({ matricule: ["Ce matricule existe déjà."] });
                return;
            }

            const qrToken = crypto.randomUUID();
            const { rows } = await pool.query(
                `INSERT INTO etudiants (matricule, nom, prenom, parcours, email, telephone, photo_data, photo_mime, qr_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, matricule, nom, prenom, parcours, email, telephone, photo, qr_token`,
                [
                    String(body.matricule).trim(),
                    String(body.nom).trim().toUpperCase(),
                    String(body.prenom).trim(),
                    String(body.parcours).trim().toUpperCase(),
                    body.email || "",
                    body.telephone || "",
                    req.file ? req.file.buffer : null,
                    req.file ? req.file.mimetype : null,
                    qrToken,
                ]
            );

            let student = rows[0];
            if (req.file) {
                const photoPath = `/api/etudiants/${student.id}/photo/?v=${Date.now()}`;
                const updated = await pool.query(
                    "UPDATE etudiants SET photo = $1 WHERE id = $2 RETURNING id, matricule, nom, prenom, parcours, email, telephone, photo, qr_token",
                    [photoPath, student.id]
                );
                student = updated.rows[0];
            }

            res.status(201).json(formatEtudiant(student, mediaBase));
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.patch("/api/etudiants/:id/", requireAuth, upload.single("photo"), async (req, res) => {
        try {
            const pool = getPool();
            const { mediaBase } = getBaseUrl(req);
            const id = Number(req.params.id);
            const body = req.body || {};

            const current = await pool.query("SELECT id FROM etudiants WHERE id = $1", [id]);
            if (current.rows.length === 0) {
                res.status(404).json({ detail: "Étudiant introuvable." });
                return;
            }

            const photoPath = req.file ? `/api/etudiants/${id}/photo/?v=${Date.now()}` : null;
            await pool.query(
                `UPDATE etudiants SET
          matricule = COALESCE($1, matricule),
          nom = COALESCE($2, nom),
          prenom = COALESCE($3, prenom),
          parcours = COALESCE($4, parcours),
          email = COALESCE($5, email),
          telephone = COALESCE($6, telephone),
          photo = COALESCE($7, photo),
          photo_data = COALESCE($8, photo_data),
          photo_mime = COALESCE($9, photo_mime)
        WHERE id = $10`,
                [
                    body.matricule !== undefined ? String(body.matricule).trim() : null,
                    body.nom !== undefined ? String(body.nom).trim().toUpperCase() : null,
                    body.prenom !== undefined ? String(body.prenom).trim() : null,
                    body.parcours !== undefined ? String(body.parcours).trim().toUpperCase() : null,
                    body.email !== undefined ? String(body.email) : null,
                    body.telephone !== undefined ? String(body.telephone) : null,
                    photoPath,
                    req.file ? req.file.buffer : null,
                    req.file ? req.file.mimetype : null,
                    id,
                ]
            );

            const { rows } = await pool.query(
                `SELECT e.id, e.matricule, e.nom, e.prenom, e.parcours, e.email, e.telephone, e.photo, e.qr_token,
                v.id AS voiture_id, v.numero_voiture
         FROM etudiants e
         LEFT JOIN affectations a ON a.etudiant = e.id
         LEFT JOIN voitures v ON v.id = a.voiture
         WHERE e.id = $1`,
                [id]
            );
            res.json(formatEtudiant(rows[0], mediaBase));
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.delete("/api/etudiants/:id/", requireAuth, async (req, res) => {
        try {
            const pool = getPool();
            const id = Number(req.params.id);
            const result = await pool.query("DELETE FROM etudiants WHERE id = $1", [id]);
            if (result.rowCount === 0) {
                res.status(404).json({ detail: "Étudiant introuvable." });
                return;
            }
            res.status(204).end();
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    // ============ PROGRAMME ============
    app.get("/api/programme/", async (_req, res) => {
        try {
            const pool = getPool();
            const { rows } = await pool.query(
                "SELECT id, jour, periode, heure_debut, heure_fin, activite, lieu FROM programme_items ORDER BY jour ASC, heure_debut ASC"
            );
            res.json(rows);
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.post("/api/programme/", requireAuth, async (req, res) => {
        try {
            const pool = getPool();
            const body = req.body || {};
            const jour = Number(body.jour);
            if (jour < 1 || jour > 7) {
                res.status(400).json({ jour: ["Le jour doit être compris entre 1 et 7."] });
                return;
            }
            const { rows } = await pool.query(
                `INSERT INTO programme_items (jour, periode, heure_debut, heure_fin, activite, lieu)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, jour, periode, heure_debut, heure_fin, activite, lieu`,
                [
                    jour,
                    body.periode || "MATIN",
                    body.heure_debut || "08:00",
                    body.heure_fin || null,
                    body.activite || "",
                    body.lieu || "",
                ]
            );
            res.status(201).json(rows[0]);
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.patch("/api/programme/:id/", requireAuth, async (req, res) => {
        try {
            const pool = getPool();
            const id = Number(req.params.id);
            const b = req.body || {};
            const { rows } = await pool.query(
                `UPDATE programme_items SET
          jour = COALESCE($1, jour),
          periode = COALESCE($2, periode),
          heure_debut = COALESCE($3, heure_debut),
          heure_fin = COALESCE($4, heure_fin),
          activite = COALESCE($5, activite),
          lieu = COALESCE($6, lieu)
         WHERE id = $7
         RETURNING id, jour, periode, heure_debut, heure_fin, activite, lieu`,
                [
                    b.jour !== undefined ? Number(b.jour) : null,
                    b.periode ?? null,
                    b.heure_debut ?? null,
                    b.heure_fin !== undefined ? b.heure_fin || null : null,
                    b.activite ?? null,
                    b.lieu ?? null,
                    id,
                ]
            );
            if (!rows[0]) {
                res.status(404).json({ detail: "Activité introuvable." });
                return;
            }
            res.json(rows[0]);
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.delete("/api/programme/:id/", requireAuth, async (req, res) => {
        try {
            const pool = getPool();
            const result = await pool.query("DELETE FROM programme_items WHERE id = $1", [
                Number(req.params.id),
            ]);
            if (result.rowCount === 0) {
                res.status(404).json({ detail: "Activité introuvable." });
                return;
            }
            res.status(204).end();
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    // ============ VOITURES ============
    app.get("/api/voitures/liste/", async (req, res) => {
        try {
            const pool = getPool();
            const { mediaBase } = getBaseUrl(req);
            const [vRes, eRes, aRes] = await Promise.all([
                pool.query("SELECT * FROM voitures ORDER BY numero_voiture ASC"),
                pool.query(
                    `SELECT e.id, e.matricule, e.nom, e.prenom, e.parcours, e.email, e.telephone, e.photo, e.qr_token,
                  v.id AS voiture_id, v.numero_voiture
           FROM etudiants e
           LEFT JOIN affectations a ON a.etudiant = e.id
           LEFT JOIN voitures v ON v.id = a.voiture`
                ),
                pool.query("SELECT id, etudiant, voiture FROM affectations ORDER BY id ASC"),
            ]);

            const etuMap = new Map(eRes.rows.map((e) => [e.id, formatEtudiant(e, mediaBase)]));
            const enriched = vRes.rows.map((v) => {
                const affs = aRes.rows.filter((a) => a.voiture === v.id);
                const chef = v.chef_voiture ? etuMap.get(v.chef_voiture) || null : null;
                const passagers = affs
                    .map((a) => etuMap.get(a.etudiant))
                    .filter((e): e is ReturnType<typeof formatEtudiant> => Boolean(e));
                return {
                    ...v,
                    chef_voiture_detail: chef,
                    places_occupees: passagers.length,
                    places_disponibles: Math.max(0, v.capacite - passagers.length),
                    etudiants: passagers,
                };
            });
            res.json(enriched);
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.post("/api/voitures/liste/", requireAuth, async (req, res) => {
        try {
            const pool = getPool();
            const body = req.body || {};
            const num = Number(body.numero_voiture);
            const exists = await pool.query("SELECT id FROM voitures WHERE numero_voiture = $1", [num]);
            if (exists.rows.length > 0) {
                res.status(400).json({ numero_voiture: ["Ce numéro de voiture existe déjà."] });
                return;
            }
            const { rows } = await pool.query(
                `INSERT INTO voitures (numero_voiture, capacite, immatriculation, chauffeur, telephone_chauffeur, chef_voiture, validee)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE)
         RETURNING *`,
                [
                    num,
                    Number(body.capacite || 26),
                    body.immatriculation || "",
                    body.chauffeur || "",
                    body.telephone_chauffeur || "",
                    body.chef_voiture ? Number(body.chef_voiture) : null,
                ]
            );
            res.status(201).json({
                ...rows[0],
                chef_voiture_detail: null,
                places_occupees: 0,
                places_disponibles: rows[0].capacite,
                etudiants: [],
            });
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.patch("/api/voitures/liste/:id/", requireAuth, async (req, res) => {
        try {
            const pool = getPool();
            const id = Number(req.params.id);
            const b = req.body || {};
            const { rows } = await pool.query(
                `UPDATE voitures SET
          numero_voiture = COALESCE($1, numero_voiture),
          capacite = COALESCE($2, capacite),
          immatriculation = COALESCE($3, immatriculation),
          chauffeur = COALESCE($4, chauffeur),
          telephone_chauffeur = COALESCE($5, telephone_chauffeur),
          chef_voiture = COALESCE($6, chef_voiture),
          validee = COALESCE($7, validee)
         WHERE id = $8
         RETURNING *`,
                [
                    b.numero_voiture !== undefined ? Number(b.numero_voiture) : null,
                    b.capacite !== undefined ? Number(b.capacite) : null,
                    b.immatriculation ?? null,
                    b.chauffeur ?? null,
                    b.telephone_chauffeur ?? null,
                    b.chef_voiture !== undefined ? (b.chef_voiture ? Number(b.chef_voiture) : null) : null,
                    b.validee !== undefined ? Boolean(b.validee) : null,
                    id,
                ]
            );
            if (!rows[0]) {
                res.status(404).json({ detail: "Voiture introuvable." });
                return;
            }
            res.json(rows[0]);
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.delete("/api/voitures/liste/:id/", requireAuth, async (req, res) => {
        try {
            const pool = getPool();
            const result = await pool.query("DELETE FROM voitures WHERE id = $1", [
                Number(req.params.id),
            ]);
            if (result.rowCount === 0) {
                res.status(404).json({ detail: "Voiture introuvable." });
                return;
            }
            res.status(204).end();
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.post("/api/voitures/liste/:id/designer_chef/", requireAuth, async (req, res) => {
        try {
            const pool = getPool();
            const id = Number(req.params.id);
            const etudiantId = Number(req.body.etudiant);
            const vRes = await pool.query("SELECT * FROM voitures WHERE id = $1", [id]);
            const voiture = vRes.rows[0];
            if (!voiture) {
                res.status(404).json({ detail: "Voiture introuvable." });
                return;
            }

            const affRes = await pool.query("SELECT * FROM affectations WHERE etudiant = $1", [etudiantId]);
            const existingAff = affRes.rows[0];
            if (existingAff && existingAff.voiture !== id) {
                res.status(400).json({ detail: "Cet étudiant est déjà affecté à une autre voiture." });
                return;
            }
            if (!existingAff) {
                const occRes = await pool.query(
                    "SELECT COUNT(*)::int AS cnt FROM affectations WHERE voiture = $1",
                    [id]
                );
                if (occRes.rows[0].cnt >= voiture.capacite) {
                    res.status(400).json({ detail: `La voiture N°${voiture.numero_voiture} est pleine.` });
                    return;
                }
                await pool.query("INSERT INTO affectations (etudiant, voiture) VALUES ($1, $2)", [
                    etudiantId,
                    id,
                ]);
            }

            await pool.query("UPDATE voitures SET chef_voiture = $1 WHERE id = $2", [etudiantId, id]);
            res.json({ detail: "Chef de voiture désigné.", chef_voiture: etudiantId });
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.post("/api/voitures/liste/:id/valider/", requireAuth, async (req, res) => {
        try {
            const pool = getPool();
            const id = Number(req.params.id);
            const vRes = await pool.query("SELECT * FROM voitures WHERE id = $1", [id]);
            const voiture = vRes.rows[0];
            if (!voiture) {
                res.status(404).json({ detail: "Voiture introuvable." });
                return;
            }

            const validee = req.body?.validee !== undefined ? Boolean(req.body.validee) : true;
            const affsRes = await pool.query(
                "SELECT etudiant FROM affectations WHERE voiture = $1 ORDER BY id ASC",
                [id]
            );
            if (validee && affsRes.rows.length === 0) {
                res.status(400).json({ detail: "Impossible de valider une voiture vide." });
                return;
            }

            let chefId = voiture.chef_voiture;
            if (req.body?.chef_voiture) {
                chefId = Number(req.body.chef_voiture);
            } else if (validee && !chefId && affsRes.rows.length > 0) {
                chefId = affsRes.rows[0].etudiant;
            }

            await pool.query("UPDATE voitures SET validee = $1, chef_voiture = $2 WHERE id = $3", [
                validee,
                chefId,
                id,
            ]);
            res.json({
                detail: validee
                    ? `Voiture N°${voiture.numero_voiture} validée.`
                    : `Voiture N°${voiture.numero_voiture} rouverte.`,
                validee,
                chef_voiture: chefId,
            });
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.post("/api/voitures/liste/:id/embarquer/", async (req, res) => {
        try {
            const pool = getPool();
            const id = Number(req.params.id);
            const etudiantId = Number(req.body.etudiant);
            const vRes = await pool.query("SELECT * FROM voitures WHERE id = $1", [id]);
            const voiture = vRes.rows[0];
            if (!voiture) {
                res.status(404).json({ detail: "Voiture introuvable." });
                return;
            }
            if (voiture.validee) {
                res.status(400).json({ detail: "Cette voiture est déjà validée par l'administration." });
                return;
            }
            const already = await pool.query("SELECT id FROM affectations WHERE etudiant = $1", [
                etudiantId,
            ]);
            if (already.rows.length > 0) {
                res.status(400).json({ detail: "Cet étudiant est déjà affecté à une voiture." });
                return;
            }
            const occRes = await pool.query(
                "SELECT COUNT(*)::int AS cnt FROM affectations WHERE voiture = $1",
                [id]
            );
            if (occRes.rows[0].cnt >= voiture.capacite) {
                res.status(400).json({ detail: `La voiture N°${voiture.numero_voiture} est complète.` });
                return;
            }

            const { rows } = await pool.query(
                "INSERT INTO affectations (etudiant, voiture) VALUES ($1, $2) RETURNING id, etudiant, voiture",
                [etudiantId, id]
            );
            if (!voiture.chef_voiture) {
                await pool.query("UPDATE voitures SET chef_voiture = $1 WHERE id = $2", [etudiantId, id]);
            }
            res.status(201).json(rows[0]);
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.post("/api/voitures/liste/auto_affecter/", requireAuth, async (_req, res) => {
        const pool = getPool();
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            const unassignedRes = await client.query(
                "SELECT id FROM etudiants WHERE id NOT IN (SELECT etudiant FROM affectations) ORDER BY id ASC"
            );
            const voituresRes = await client.query(
                `SELECT v.id, v.capacite, v.validee, v.chef_voiture, COUNT(a.id)::int AS occ
         FROM voitures v
         LEFT JOIN affectations a ON a.voiture = v.id
         GROUP BY v.id
         ORDER BY v.numero_voiture ASC`
            );

            let count = 0;
            const cars = voituresRes.rows;
            for (const etu of unassignedRes.rows) {
                const target = cars.find((v) => !v.validee && v.occ < v.capacite);
                if (!target) break;
                await client.query("INSERT INTO affectations (etudiant, voiture) VALUES ($1, $2)", [
                    etu.id,
                    target.id,
                ]);
                target.occ++;
                if (!target.chef_voiture) {
                    target.chef_voiture = etu.id;
                    await client.query("UPDATE voitures SET chef_voiture = $1 WHERE id = $2", [
                        etu.id,
                        target.id,
                    ]);
                }
                count++;
            }

            await client.query("COMMIT");
            res.json({
                affectes: count,
                restants: unassignedRes.rows.length - count,
                message: `${count} étudiant(s) affecté(s) automatiquement.`,
            });
        } catch (err: any) {
            await client.query("ROLLBACK");
            res.status(500).json({ detail: err.message });
        } finally {
            client.release();
        }
    });

    // ============ AFFECTATIONS ============
    app.get("/api/voitures/affectations/", async (req, res) => {
        try {
            const pool = getPool();
            const { mediaBase } = getBaseUrl(req);
            const [aRes, eRes, vRes] = await Promise.all([
                pool.query("SELECT id, etudiant, voiture FROM affectations ORDER BY id DESC"),
                pool.query(
                    `SELECT e.id, e.matricule, e.nom, e.prenom, e.parcours, e.email, e.telephone, e.photo, e.qr_token,
                  v.id AS voiture_id, v.numero_voiture
           FROM etudiants e
           LEFT JOIN affectations a ON a.etudiant = e.id
           LEFT JOIN voitures v ON v.id = a.voiture`
                ),
                pool.query("SELECT * FROM voitures"),
            ]);

            const etuMap = new Map(eRes.rows.map((e) => [e.id, formatEtudiant(e, mediaBase)]));
            const voiMap = new Map(vRes.rows.map((v) => [v.id, v]));

            res.json(
                aRes.rows.map((a) => ({
                    id: a.id,
                    etudiant: a.etudiant,
                    voiture: a.voiture,
                    etudiant_detail: etuMap.get(a.etudiant) || null,
                    voiture_detail: voiMap.get(a.voiture) || null,
                }))
            );
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.post("/api/voitures/affectations/", async (req, res) => {
        try {
            const pool = getPool();
            const etudiantId = Number(req.body.etudiant);
            const voitureId = Number(req.body.voiture);

            const vRes = await pool.query("SELECT * FROM voitures WHERE id = $1", [voitureId]);
            const voiture = vRes.rows[0];
            if (!voiture) {
                res.status(404).json({ detail: "Voiture introuvable." });
                return;
            }
            if (voiture.validee) {
                res.status(400).json({ detail: `La voiture N°${voiture.numero_voiture} est déjà validée.` });
                return;
            }
            const already = await pool.query("SELECT id FROM affectations WHERE etudiant = $1", [
                etudiantId,
            ]);
            if (already.rows.length > 0) {
                res.status(400).json({ detail: "Cet étudiant est déjà affecté à une voiture." });
                return;
            }
            const occRes = await pool.query(
                "SELECT COUNT(*)::int AS cnt FROM affectations WHERE voiture = $1",
                [voitureId]
            );
            if (occRes.rows[0].cnt >= voiture.capacite) {
                res.status(400).json({ detail: `La voiture N°${voiture.numero_voiture} est pleine.` });
                return;
            }

            const { rows } = await pool.query(
                "INSERT INTO affectations (etudiant, voiture) VALUES ($1, $2) RETURNING id, etudiant, voiture",
                [etudiantId, voitureId]
            );
            if (!voiture.chef_voiture) {
                await pool.query("UPDATE voitures SET chef_voiture = $1 WHERE id = $2", [
                    etudiantId,
                    voitureId,
                ]);
            }
            res.status(201).json(rows[0]);
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.delete("/api/voitures/affectations/:id/", async (req, res) => {
        try {
            const pool = getPool();
            const id = Number(req.params.id);
            const affRes = await pool.query("SELECT * FROM affectations WHERE id = $1", [id]);
            const aff = affRes.rows[0];
            if (!aff) {
                res.status(404).json({ detail: "Affectation introuvable." });
                return;
            }
            const vRes = await pool.query("SELECT * FROM voitures WHERE id = $1", [aff.voiture]);
            const voiture = vRes.rows[0];
            if (voiture?.validee) {
                res.status(400).json({
                    detail: "Impossible de retirer un étudiant d'une voiture déjà validée.",
                });
                return;
            }

            await pool.query("DELETE FROM affectations WHERE id = $1", [id]);
            if (voiture && voiture.chef_voiture === aff.etudiant) {
                const rem = await pool.query(
                    "SELECT etudiant FROM affectations WHERE voiture = $1 ORDER BY id ASC LIMIT 1",
                    [voiture.id]
                );
                await pool.query("UPDATE voitures SET chef_voiture = $1 WHERE id = $2", [
                    rem.rows[0]?.etudiant ?? null,
                    voiture.id,
                ]);
            }
            res.status(204).end();
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    // ============ AGENT IA ============
    app.post("/api/agent-ia/ask/", async (req, res) => {
        try {
            const { message, history } = req.body || {};
            const question = String(message || "").trim();
            if (!question) {
                res.status(400).json({ detail: "Veuillez saisir une question." });
                return;
            }
            const ai = getGeminiClient();
            if (!ai) {
                res.status(500).json({ detail: "Clé GEMINI_API_KEY manquante côté serveur." });
                return;
            }

            const pool = getPool();
            const [pRes, eRes, vRes, aRes, progRes] = await Promise.all([
                pool.query("SELECT * FROM parametres_voyage WHERE id = 1"),
                pool.query("SELECT id, matricule, nom, prenom, parcours, telephone, email FROM etudiants ORDER BY id ASC"),
                pool.query("SELECT * FROM voitures ORDER BY numero_voiture ASC"),
                pool.query("SELECT etudiant, voiture FROM affectations"),
                pool.query("SELECT jour, periode, heure_debut, heure_fin, activite, lieu FROM programme_items ORDER BY jour ASC, heure_debut ASC"),
            ]);

            const affByStudent = new Map(aRes.rows.map((a) => [a.etudiant, a.voiture]));
            const voitureById = new Map(vRes.rows.map((v) => [v.id, v]));
            const studentById = new Map(eRes.rows.map((e) => [e.id, e]));

            const dbSnapshot = {
                statistiques: {
                    total_etudiants: eRes.rows.length,
                    total_affectes: aRes.rows.length,
                    total_non_affectes: eRes.rows.length - aRes.rows.length,
                    total_voitures: vRes.rows.length,
                    voitures_validees: vRes.rows.filter((v) => v.validee).length,
                },
                parametres: pRes.rows[0] || null,
                etudiants: eRes.rows.map((e) => {
                    const vId = affByStudent.get(e.id);
                    const v = vId ? voitureById.get(vId) : null;
                    return {
                        ...e,
                        voiture_numero: v ? v.numero_voiture : null,
                        est_chef_de_voiture: v ? v.chef_voiture === e.id : false,
                    };
                }),
                voitures: vRes.rows.map((v) => {
                    const passagers = aRes.rows
                        .filter((a) => a.voiture === v.id)
                        .map((a) => studentById.get(a.etudiant))
                        .filter(Boolean);
                    const chef = v.chef_voiture ? studentById.get(v.chef_voiture) : null;
                    return {
                        numero_voiture: v.numero_voiture,
                        immatriculation: v.immatriculation,
                        chauffeur: v.chauffeur,
                        telephone_chauffeur: v.telephone_chauffeur,
                        capacite: v.capacite,
                        places_occupees: passagers.length,
                        places_disponibles: Math.max(0, v.capacite - passagers.length),
                        validee_par_admin: v.validee,
                        chef_voiture: chef
                            ? { matricule: chef.matricule, nom: chef.nom, prenom: chef.prenom, telephone: chef.telephone }
                            : null,
                        passagers,
                    };
                }),
                programme: progRes.rows,
            };

            const formattedHistory = Array.isArray(history)
                ? history
                    .slice(-6)
                    .map((h: { role?: string; text?: string }) =>
                        `${h.role === "user" ? "Utilisateur" : "Agent"}: ${String(h.text || "")}`
                    )
                    .join("\n")
                : "";

            const systemInstruction = [
                "Tu es l'Agent IA officiel de VoyageE — ENI (École Nationale d'Informatique).",
                "Tu aides les administrateurs et les responsables (chefs de voiture) à consulter instantanément toutes les informations du voyage d'étude.",
                "Réponds toujours en français, de manière claire, précise et structurée.",
                "RÈGLE STRICTE : Base tes réponses UNIQUEMENT sur les données JSON en direct de la base fournies ci-dessous. N'invente jamais un matricule, un nom, un numéro de voiture ou un horaire.",
                `DONNÉES EN DIRECT DE LA BASE :\n${JSON.stringify(dbSnapshot, null, 2)}`,
            ].join("\n\n");

            const prompt = formattedHistory
                ? `Historique récent :\n${formattedHistory}\n\nNouvelle question : ${question}`
                : question;

            const response = await ai.models.generateContent({
                model: "gemini-3.6-flash",
                contents: prompt,
                config: { systemInstruction },
            });

            res.json({ reply: response.text || "Aucune réponse générée." });
        } catch (err: any) {
            res.status(500).json({ detail: err.message || "Erreur Agent IA." });
        }
    });

    // ============ BADGES ============
    app.get("/api/badges/:uuid/info/", async (req, res) => {
        try {
            const pool = getPool();
            const { frontend, mediaBase } = getBaseUrl(req);
            const { rows } = await pool.query(
                `SELECT e.id, e.matricule, e.nom, e.prenom, e.parcours, e.email, e.telephone, e.photo, e.qr_token,
                v.id AS voiture_id, v.numero_voiture
         FROM etudiants e
         LEFT JOIN affectations a ON a.etudiant = e.id
         LEFT JOIN voitures v ON v.id = a.voiture
         WHERE e.qr_token = $1`,
                [req.params.uuid]
            );
            if (!rows[0]) {
                res.status(404).json({ detail: "Badge introuvable." });
                return;
            }
            const etuRow = rows[0];
            const [vRes, progRes, paramRes] = await Promise.all([
                etuRow.voiture_id
                    ? pool.query("SELECT * FROM voitures WHERE id = $1", [etuRow.voiture_id])
                    : Promise.resolve({ rows: [] }),
                pool.query("SELECT * FROM programme_items ORDER BY jour ASC, heure_debut ASC"),
                pool.query("SELECT * FROM parametres_voyage WHERE id = 1"),
            ]);

            res.json({
                etudiant: formatEtudiant(etuRow, mediaBase),
                voiture: vRes.rows[0] || null,
                programme: progRes.rows,
                parametres: paramRes.rows[0],
                qr_url: `${mediaBase}/api/badges/${etuRow.qr_token}/qr/`,
                badge_public_url: `${frontend}/badge/${etuRow.qr_token}`,
            });
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.get("/api/badges/:uuid/qr/", async (req, res) => {
        try {
            const pool = getPool();
            const { frontend } = getBaseUrl(req);
            const { rows } = await pool.query("SELECT qr_token FROM etudiants WHERE qr_token = $1", [
                req.params.uuid,
            ]);
            if (!rows[0]) {
                res.status(404).json({ detail: "Badge introuvable." });
                return;
            }
            const pngBuffer = await QRCode.toBuffer(`${frontend}/badge/${rows[0].qr_token}`, {
                type: "png",
                width: 320,
                margin: 2,
                color: { dark: "#14532d", light: "#ffffff" },
            });
            res.setHeader("Content-Type", "image/png");
            res.setHeader("Cache-Control", "no-store");
            res.send(pngBuffer);
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.get("/api/badges/:uuid/pdf/", async (req, res) => {
        try {
            const pool = getPool();
            const { frontend } = getBaseUrl(req);
            const { rows } = await pool.query(
                `SELECT e.*, v.numero_voiture
         FROM etudiants e
         LEFT JOIN affectations a ON a.etudiant = e.id
         LEFT JOIN voitures v ON v.id = a.voiture
         WHERE e.qr_token = $1`,
                [req.params.uuid]
            );
            const etu = rows[0];
            if (!etu) {
                res.status(404).json({ detail: "Badge introuvable." });
                return;
            }

            const [progRes, paramRes] = await Promise.all([
                pool.query("SELECT * FROM programme_items ORDER BY jour ASC, heure_debut ASC"),
                pool.query("SELECT * FROM parametres_voyage WHERE id = 1"),
            ]);
            const parametres = paramRes.rows[0];
            const sortedProgramme = progRes.rows;
            const qrBuffer = await QRCode.toBuffer(`${frontend}/badge/${etu.qr_token}`, {
                type: "png",
                width: 240,
                margin: 1,
                color: { dark: "#14532d", light: "#ffffff" },
            });

            const doc = new PDFDocument({ size: "A6", margin: 18 });
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="badge_${etu.matricule}.pdf"`);
            doc.pipe(res);

            doc.rect(0, 0, doc.page.width, 62).fill("#14532d");
            doc.fillColor("#facc15").fontSize(12).font("Helvetica-Bold").text("VOYAGE D'ÉTUDES — ENI", 18, 16);
            doc.fillColor("#ffffff").fontSize(9).font("Helvetica").text(`Destination : ${parametres.destination} · Promo ${parametres.annee_promotion}`, 18, 34);

            let y = 74;
            for (let j = 1; j <= 7; j++) {
                const items = sortedProgramme.filter((p) => p.jour === j);
                doc.fillColor("#15803d").fontSize(8.5).font("Helvetica-Bold").text(`J-0${j}`, 18, y);
                const summary = items.length
                    ? items.map((i) => `${i.periode === "MATIN" ? "M" : "A"}: ${i.activite}`).join(" | ")
                    : "Programme libre";
                doc.fillColor("#1e293b").fontSize(7.5).font("Helvetica").text(summary, 44, y, { width: doc.page.width - 62, lineGap: 1 });
                y = Math.max(y + 22, doc.y + 6);
            }

            doc.roundedRect(18, doc.page.height - 54, doc.page.width - 36, 36, 6).fill("#facc15");
            doc.fillColor("#14532d").fontSize(14).font("Helvetica-Bold").text(
                etu.numero_voiture ? `VOITURE N° ${etu.numero_voiture}` : "VOITURE NON AFFECTÉE",
                18,
                doc.page.height - 42,
                { width: doc.page.width - 36, align: "center" }
            );

            doc.addPage({ size: "A6", margin: 18 });
            doc.rect(0, 0, doc.page.width, 54).fill("#166534");
            doc.fillColor("#ffffff").fontSize(11).font("Helvetica-Bold").text("BADGE ÉTUDIANT", 18, 15);
            doc.fillColor("#fde047").fontSize(8.5).font("Helvetica").text(`${parametres.ecole} · ${parametres.destination}`, 18, 31);

            doc.fillColor("#0f172a").fontSize(13).font("Helvetica-Bold").text(`${etu.nom} ${etu.prenom}`, 18, 72, { width: doc.page.width - 36, align: "center" });
            doc.fillColor("#475569").fontSize(9.5).font("Helvetica").text(`Matricule : ${etu.matricule} · Parcours : ${etu.parcours}`, 18, 92, { width: doc.page.width - 36, align: "center" });

            doc.roundedRect(50, 114, doc.page.width - 100, 26, 5).fill("#dcfce7");
            doc.fillColor("#14532d").fontSize(11).font("Helvetica-Bold").text(
                etu.numero_voiture ? `VOITURE V${etu.numero_voiture}` : "NON AFFECTÉ",
                50,
                121,
                { width: doc.page.width - 100, align: "center" }
            );

            doc.image(qrBuffer, (doc.page.width - 110) / 2, 154, { width: 110, height: 110 });

            doc.fillColor("#334155").fontSize(8).font("Helvetica-Bold").text("Contacts d'urgence :", 18, 282);
            doc.fillColor("#475569").fontSize(7.5).font("Helvetica").text(`Resp. Voyage : ${parametres.nom_responsable} (${parametres.tel_responsable})`, 18, 296);
            doc.text(`Resp. Santé : ${parametres.nom_responsable_sante} (${parametres.tel_responsable_sante})`, 18, 310);

            doc.end();
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    }

    return app;
}

let appPromise: ReturnType<typeof createApp> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    try {
        if (!appPromise) {
            appPromise = createApp();
        }
        const app = await appPromise;
        return app(req, res);
    } catch (err) {
        console.error("Vercel handler error:", err);
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(
            JSON.stringify({
                detail: err instanceof Error ? err.message : String(err),
            })
        );
    }
}