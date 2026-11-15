import express from "express";
import type { IncomingMessage, ServerResponse } from "http";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { getPool } from "./db.js";

dotenv.config();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 },
});

function getGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey });
}

function cleanAiReply(text: string): string {
    return text
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/\*/g, "")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/`{1,3}/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

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

function getBaseUrl(req: express.Request) {
    const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "https");
    const host = String(req.headers["x-forwarded-host"] || req.get("host") || "");
    const origin = host ? `${proto}://${host}` : "";
    const frontend =
        validHttpUrl(process.env.PUBLIC_FRONTEND_URL) ||
        validHttpUrl(process.env.APP_URL) ||
        origin;
    const explicitBackend = validHttpUrl(process.env.PUBLIC_BACKEND_URL);
    const mediaBase = explicitBackend || "";
    return { frontend, mediaBase };
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
    if (!verifySignedToken(header.slice(7))) {
        res.status(401).json({ detail: "Token invalide ou expiré." });
        return;
    }
    next();
}

function formatEtudiantRow(
    row: Record<string, any>,
    mediaBase: string
) {
    return {
        id: row.id,
        matricule: row.matricule,
        nom: row.nom,
        prenom: row.prenom,
        parcours: row.parcours,
        email: row.email || "",
        telephone: row.telephone || "",
        photo: row.has_photo ? `/api/etudiants/${row.id}/photo/` : null,
        photo_url: row.has_photo ? `${mediaBase}/api/etudiants/${row.id}/photo/` : null,
        qr_token: row.qr_token,
        voiture_numero: row.voiture_numero ?? null,
        voiture_id: row.voiture_id ?? null,
    };
}

let cachedApp: express.Express | null = null;

export async function createApp() {
    if (cachedApp) return cachedApp;

    const app = express();
    const pool = getPool();

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

    // ============ PARAMETRES ============
    app.get("/api/core/parametres/", async (_req, res) => {
        try {
            const { rows } = await pool.query(
                "SELECT * FROM parametres_voyage ORDER BY id ASC LIMIT 1"
            );
            res.json(rows);
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.post("/api/core/parametres/", requireAuth, async (req, res) => {
        try {
            const b = req.body || {};
            const { rows } = await pool.query(
                `INSERT INTO parametres_voyage (id, date_debut, date_fin, destination, ecole, annee_promotion, nom_responsable, tel_responsable, nom_responsable_sante, tel_responsable_sante)
         VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           date_debut = EXCLUDED.date_debut,
           date_fin = EXCLUDED.date_fin,
           destination = EXCLUDED.destination,
           ecole = EXCLUDED.ecole,
           annee_promotion = EXCLUDED.annee_promotion,
           nom_responsable = EXCLUDED.nom_responsable,
           tel_responsable = EXCLUDED.tel_responsable,
           nom_responsable_sante = EXCLUDED.nom_responsable_sante,
           tel_responsable_sante = EXCLUDED.tel_responsable_sante
         RETURNING *`,
                [
                    b.date_debut,
                    b.date_fin,
                    b.destination,
                    b.ecole || "ENI",
                    b.annee_promotion || "2025-2026",
                    b.nom_responsable || "",
                    b.tel_responsable || "",
                    b.nom_responsable_sante || "",
                    b.tel_responsable_sante || "",
                ]
            );
            res.status(201).json(rows[0]);
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    const updateParametres = async (req: express.Request, res: express.Response) => {
        try {
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
           tel_responsable_sante = COALESCE($9, tel_responsable_sante)
         WHERE id = $10
         RETURNING *`,
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
                    Number(req.params.id) || 1,
                ]
            );
            res.json(rows[0]);
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    };
    app.put("/api/core/parametres/:id/", requireAuth, updateParametres);
    app.patch("/api/core/parametres/:id/", requireAuth, updateParametres);

    // ============ ETUDIANTS ============
    app.get("/api/etudiants/:id/photo/", async (req, res) => {
        try {
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

    app.get("/api/etudiants/", async (req, res) => {
        try {
            const { mediaBase } = getBaseUrl(req);
            const search = String(req.query.search || "").trim();
            const parcours = String(req.query.parcours || "").trim().toUpperCase();

            const conditions: string[] = [];
            const values: any[] = [];
            if (search) {
                values.push(`%${search}%`);
                conditions.push(
                    `(e.nom ILIKE $${values.length} OR e.prenom ILIKE $${values.length} OR e.matricule ILIKE $${values.length})`
                );
            }
            if (parcours) {
                values.push(parcours);
                conditions.push(`e.parcours = $${values.length}`);
            }
            const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

            const { rows } = await pool.query(
                `SELECT e.id, e.matricule, e.nom, e.prenom, e.parcours, e.email, e.telephone,
                e.qr_token, (e.photo_data IS NOT NULL) AS has_photo,
                v.id AS voiture_id, v.numero_voiture AS voiture_numero
         FROM etudiants e
         LEFT JOIN affectations a ON a.etudiant = e.id
         LEFT JOIN voitures v ON v.id = a.voiture
         ${whereClause}
         ORDER BY e.id DESC`,
                values
            );

            res.json(rows.map((r) => formatEtudiantRow(r, mediaBase)));
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.post("/api/etudiants/", requireAuth, upload.single("photo"), async (req, res) => {
        try {
            const { mediaBase } = getBaseUrl(req);
            const b = req.body || {};
            if (!b.matricule || !b.nom || !b.prenom || !b.parcours) {
                res.status(400).json({ detail: "Matricule, nom, prénom et parcours sont obligatoires." });
                return;
            }

            const { rows } = await pool.query(
                `INSERT INTO etudiants (matricule, nom, prenom, parcours, email, telephone, photo_data, photo_mime, qr_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, matricule, nom, prenom, parcours, email, telephone, qr_token, (photo_data IS NOT NULL) AS has_photo`,
                [
                    String(b.matricule).trim(),
                    String(b.nom).trim().toUpperCase(),
                    String(b.prenom).trim(),
                    String(b.parcours).trim().toUpperCase(),
                    b.email || "",
                    b.telephone || "",
                    req.file ? req.file.buffer : null,
                    req.file ? req.file.mimetype : null,
                    crypto.randomUUID(),
                ]
            );
            res.status(201).json(formatEtudiantRow(rows[0], mediaBase));
        } catch (err: any) {
            if (err.code === "23505") {
                res.status(400).json({ matricule: ["Ce matricule existe déjà."] });
                return;
            }
            res.status(500).json({ detail: err.message });
        }
    });

    app.patch("/api/etudiants/:id/", requireAuth, upload.single("photo"), async (req, res) => {
        try {
            const { mediaBase } = getBaseUrl(req);
            const id = Number(req.params.id);
            const b = req.body || {};

            const { rows } = await pool.query(
                `UPDATE etudiants SET
           matricule = COALESCE($1, matricule),
           nom = COALESCE($2, nom),
           prenom = COALESCE($3, prenom),
           parcours = COALESCE($4, parcours),
           email = COALESCE($5, email),
           telephone = COALESCE($6, telephone),
           photo_data = COALESCE($7, photo_data),
           photo_mime = COALESCE($8, photo_mime)
         WHERE id = $9
         RETURNING id, matricule, nom, prenom, parcours, email, telephone, qr_token, (photo_data IS NOT NULL) AS has_photo`,
                [
                    b.matricule !== undefined ? String(b.matricule).trim() : null,
                    b.nom !== undefined ? String(b.nom).trim().toUpperCase() : null,
                    b.prenom !== undefined ? String(b.prenom).trim() : null,
                    b.parcours !== undefined ? String(b.parcours).trim().toUpperCase() : null,
                    b.email ?? null,
                    b.telephone ?? null,
                    req.file ? req.file.buffer : null,
                    req.file ? req.file.mimetype : null,
                    id,
                ]
            );
            if (!rows[0]) {
                res.status(404).json({ detail: "Étudiant introuvable." });
                return;
            }
            res.json(formatEtudiantRow(rows[0], mediaBase));
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.delete("/api/etudiants/:id/", requireAuth, async (req, res) => {
        try {
            const id = Number(req.params.id);
            await pool.query("UPDATE voitures SET chef_voiture = NULL WHERE chef_voiture = $1", [id]);
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
            const { rows } = await pool.query(
                "SELECT * FROM programme_items ORDER BY jour ASC, heure_debut ASC"
            );
            res.json(rows);
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.post("/api/programme/", requireAuth, async (req, res) => {
        try {
            const b = req.body || {};
            const jour = Number(b.jour);
            if (jour < 1 || jour > 7) {
                res.status(400).json({ jour: ["Le jour doit être compris entre 1 et 7."] });
                return;
            }
            const { rows } = await pool.query(
                `INSERT INTO programme_items (jour, periode, heure_debut, heure_fin, activite, lieu)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [jour, b.periode || "MATIN", b.heure_debut || "08:00", b.heure_fin || null, b.activite || "", b.lieu || ""]
            );
            res.status(201).json(rows[0]);
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.patch("/api/programme/:id/", requireAuth, async (req, res) => {
        try {
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
         WHERE id = $7 RETURNING *`,
                [
                    b.jour !== undefined ? Number(b.jour) : null,
                    b.periode ?? null,
                    b.heure_debut ?? null,
                    b.heure_fin ?? null,
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
            const result = await pool.query("DELETE FROM programme_items WHERE id = $1", [Number(req.params.id)]);
            if (result.rowCount === 0) {
                res.status(404).json({ detail: "Activité introuvable." });
                return;
            }
            res.status(204).end();
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    // ============ VOITURES (AVEC PHOTO EN BASE) ============
    app.get("/api/voitures/:id/photo/", async (req, res) => {
        try {
            const { rows } = await pool.query(
                "SELECT photo_data, photo_mime FROM voitures WHERE id = $1",
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

    app.get("/api/voitures/liste/", async (req, res) => {
        try {
            const { mediaBase } = getBaseUrl(req);
            const [vRes, eRes, aRes] = await Promise.all([
                pool.query(
                    `SELECT id, numero_voiture, capacite, immatriculation, modele, chauffeur,
                  telephone_chauffeur, chef_voiture, validee,
                  (photo_data IS NOT NULL) AS has_photo
           FROM voitures ORDER BY numero_voiture ASC`
                ),
                pool.query(
                    `SELECT id, matricule, nom, prenom, parcours, email, telephone,
                  qr_token, (photo_data IS NOT NULL) AS has_photo
           FROM etudiants`
                ),
                pool.query("SELECT * FROM affectations"),
            ]);

            const etuMap = new Map<number, any>();
            for (const e of eRes.rows) etuMap.set(e.id, formatEtudiantRow(e, mediaBase));

            const enriched = vRes.rows.map((v) => {
                const affs = aRes.rows.filter((a) => a.voiture === v.id);
                const chef = v.chef_voiture ? etuMap.get(v.chef_voiture) || null : null;
                return {
                    id: v.id,
                    numero_voiture: v.numero_voiture,
                    capacite: v.capacite,
                    immatriculation: v.immatriculation || "",
                    modele: v.modele || "",
                    chauffeur: v.chauffeur || "",
                    telephone_chauffeur: v.telephone_chauffeur || "",
                    photo: v.has_photo ? `/api/voitures/${v.id}/photo/` : null,
                    photo_url: v.has_photo ? `${mediaBase}/api/voitures/${v.id}/photo/` : null,
                    chef_voiture: v.chef_voiture,
                    validee: v.validee,
                    chef_voiture_detail: chef,
                    places_occupees: affs.length,
                    places_disponibles: Math.max(0, v.capacite - affs.length),
                    etudiants: affs.map((a) => etuMap.get(a.etudiant)).filter(Boolean),
                };
            });
            res.json(enriched);
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.post("/api/voitures/liste/", requireAuth, upload.single("photo"), async (req, res) => {
        try {
            const { mediaBase } = getBaseUrl(req);
            const b = req.body || {};
            const num = Number(b.numero_voiture);
            if (!Number.isFinite(num) || num < 1) {
                res.status(400).json({ detail: "Numéro de voiture invalide." });
                return;
            }
            const { rows } = await pool.query(
                `INSERT INTO voitures (numero_voiture, capacite, immatriculation, modele, chauffeur, telephone_chauffeur, photo_data, photo_mime, chef_voiture, validee)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
         RETURNING id, numero_voiture, capacite, immatriculation, modele, chauffeur, telephone_chauffeur, chef_voiture, validee, (photo_data IS NOT NULL) AS has_photo`,
                [
                    num,
                    Number(b.capacite || 26),
                    String(b.immatriculation || "").trim(),
                    String(b.modele || "").trim(),
                    String(b.chauffeur || "").trim(),
                    String(b.telephone_chauffeur || "").trim(),
                    req.file ? req.file.buffer : null,
                    req.file ? req.file.mimetype : null,
                    b.chef_voiture ? Number(b.chef_voiture) : null,
                ]
            );
            const v = rows[0];
            res.status(201).json({
                id: v.id,
                numero_voiture: v.numero_voiture,
                capacite: v.capacite,
                immatriculation: v.immatriculation,
                modele: v.modele,
                chauffeur: v.chauffeur,
                telephone_chauffeur: v.telephone_chauffeur,
                photo: v.has_photo ? `/api/voitures/${v.id}/photo/` : null,
                photo_url: v.has_photo ? `${mediaBase}/api/voitures/${v.id}/photo/` : null,
                chef_voiture: v.chef_voiture,
                validee: v.validee,
                chef_voiture_detail: null,
                places_occupees: 0,
                places_disponibles: v.capacite,
                etudiants: [],
            });
        } catch (err: any) {
            if (err.code === "23505") {
                res.status(400).json({ numero_voiture: ["Ce numéro de voiture existe déjà."] });
                return;
            }
            res.status(500).json({ detail: err.message });
        }
    });

    app.patch("/api/voitures/liste/:id/", requireAuth, upload.single("photo"), async (req, res) => {
        try {
            const { mediaBase } = getBaseUrl(req);
            const id = Number(req.params.id);
            const b = req.body || {};
            const removePhoto = b.remove_photo === "true" || b.remove_photo === true;

            let rows;
            if (req.file) {
                ({ rows } = await pool.query(
                    `UPDATE voitures SET
             numero_voiture = COALESCE($1, numero_voiture),
             capacite = COALESCE($2, capacite),
             immatriculation = COALESCE($3, immatriculation),
             modele = COALESCE($4, modele),
             chauffeur = COALESCE($5, chauffeur),
             telephone_chauffeur = COALESCE($6, telephone_chauffeur),
             photo_data = $7,
             photo_mime = $8
           WHERE id = $9
           RETURNING id, numero_voiture, capacite, immatriculation, modele, chauffeur, telephone_chauffeur, chef_voiture, validee, (photo_data IS NOT NULL) AS has_photo`,
                    [
                        b.numero_voiture !== undefined ? Number(b.numero_voiture) : null,
                        b.capacite !== undefined ? Number(b.capacite) : null,
                        b.immatriculation !== undefined ? String(b.immatriculation).trim() : null,
                        b.modele !== undefined ? String(b.modele).trim() : null,
                        b.chauffeur !== undefined ? String(b.chauffeur).trim() : null,
                        b.telephone_chauffeur !== undefined ? String(b.telephone_chauffeur).trim() : null,
                        req.file.buffer,
                        req.file.mimetype,
                        id,
                    ]
                ));
            } else if (removePhoto) {
                ({ rows } = await pool.query(
                    `UPDATE voitures SET
             numero_voiture = COALESCE($1, numero_voiture),
             capacite = COALESCE($2, capacite),
             immatriculation = COALESCE($3, immatriculation),
             modele = COALESCE($4, modele),
             chauffeur = COALESCE($5, chauffeur),
             telephone_chauffeur = COALESCE($6, telephone_chauffeur),
             photo_data = NULL,
             photo_mime = NULL
           WHERE id = $7
           RETURNING id, numero_voiture, capacite, immatriculation, modele, chauffeur, telephone_chauffeur, chef_voiture, validee, (photo_data IS NOT NULL) AS has_photo`,
                    [
                        b.numero_voiture !== undefined ? Number(b.numero_voiture) : null,
                        b.capacite !== undefined ? Number(b.capacite) : null,
                        b.immatriculation !== undefined ? String(b.immatriculation).trim() : null,
                        b.modele !== undefined ? String(b.modele).trim() : null,
                        b.chauffeur !== undefined ? String(b.chauffeur).trim() : null,
                        b.telephone_chauffeur !== undefined ? String(b.telephone_chauffeur).trim() : null,
                        id,
                    ]
                ));
            } else {
                ({ rows } = await pool.query(
                    `UPDATE voitures SET
             numero_voiture = COALESCE($1, numero_voiture),
             capacite = COALESCE($2, capacite),
             immatriculation = COALESCE($3, immatriculation),
             modele = COALESCE($4, modele),
             chauffeur = COALESCE($5, chauffeur),
             telephone_chauffeur = COALESCE($6, telephone_chauffeur)
           WHERE id = $7
           RETURNING id, numero_voiture, capacite, immatriculation, modele, chauffeur, telephone_chauffeur, chef_voiture, validee, (photo_data IS NOT NULL) AS has_photo`,
                    [
                        b.numero_voiture !== undefined ? Number(b.numero_voiture) : null,
                        b.capacite !== undefined ? Number(b.capacite) : null,
                        b.immatriculation !== undefined ? String(b.immatriculation).trim() : null,
                        b.modele !== undefined ? String(b.modele).trim() : null,
                        b.chauffeur !== undefined ? String(b.chauffeur).trim() : null,
                        b.telephone_chauffeur !== undefined ? String(b.telephone_chauffeur).trim() : null,
                        id,
                    ]
                ));
            }

            if (!rows[0]) {
                res.status(404).json({ detail: "Voiture introuvable." });
                return;
            }
            const v = rows[0];
            res.json({
                id: v.id,
                numero_voiture: v.numero_voiture,
                capacite: v.capacite,
                immatriculation: v.immatriculation,
                modele: v.modele,
                chauffeur: v.chauffeur,
                telephone_chauffeur: v.telephone_chauffeur,
                photo: v.has_photo ? `/api/voitures/${v.id}/photo/` : null,
                photo_url: v.has_photo ? `${mediaBase}/api/voitures/${v.id}/photo/` : null,
                chef_voiture: v.chef_voiture,
                validee: v.validee,
            });
        } catch (err: any) {
            if (err.code === "23505") {
                res.status(400).json({ numero_voiture: ["Ce numéro de voiture existe déjà."] });
                return;
            }
            res.status(500).json({ detail: err.message });
        }
    });

    app.delete("/api/voitures/liste/:id/", requireAuth, async (req, res) => {
        try {
            const result = await pool.query("DELETE FROM voitures WHERE id = $1", [Number(req.params.id)]);
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
            const id = Number(req.params.id);
            const etudiantId = Number(req.body.etudiant);
            const vRes = await pool.query("SELECT * FROM voitures WHERE id = $1", [id]);
            const voiture = vRes.rows[0];
            if (!voiture) {
                res.status(404).json({ detail: "Voiture introuvable." });
                return;
            }
            const existing = await pool.query("SELECT * FROM affectations WHERE etudiant = $1", [etudiantId]);
            if (existing.rows[0] && existing.rows[0].voiture !== id) {
                res.status(400).json({ detail: "Cet étudiant est déjà affecté à une autre voiture." });
                return;
            }
            if (!existing.rows[0]) {
                const countRes = await pool.query("SELECT COUNT(*)::int AS cnt FROM affectations WHERE voiture = $1", [id]);
                if (countRes.rows[0].cnt >= voiture.capacite) {
                    res.status(400).json({ detail: `La voiture N°${voiture.numero_voiture} est pleine.` });
                    return;
                }
                await pool.query("INSERT INTO affectations (etudiant, voiture) VALUES ($1, $2)", [etudiantId, id]);
            }
            await pool.query("UPDATE voitures SET chef_voiture = $1 WHERE id = $2", [etudiantId, id]);
            res.json({ detail: "Chef de voiture désigné.", chef_voiture: etudiantId });
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.post("/api/voitures/liste/:id/valider/", requireAuth, async (req, res) => {
        try {
            const id = Number(req.params.id);
            const vRes = await pool.query("SELECT * FROM voitures WHERE id = $1", [id]);
            const voiture = vRes.rows[0];
            if (!voiture) {
                res.status(404).json({ detail: "Voiture introuvable." });
                return;
            }
            const validee = req.body?.validee !== undefined ? Boolean(req.body.validee) : true;
            const affRes = await pool.query("SELECT * FROM affectations WHERE voiture = $1 ORDER BY id ASC", [id]);
            if (validee && affRes.rows.length === 0) {
                res.status(400).json({ detail: "Impossible de valider une voiture vide." });
                return;
            }
            let nextChef = voiture.chef_voiture;
            if (req.body?.chef_voiture) {
                nextChef = Number(req.body.chef_voiture);
            } else if (validee && !nextChef && affRes.rows.length > 0) {
                nextChef = affRes.rows[0].etudiant;
            }
            await pool.query("UPDATE voitures SET validee = $1, chef_voiture = $2 WHERE id = $3", [validee, nextChef, id]);
            res.json({
                detail: validee ? `Voiture N°${voiture.numero_voiture} validée.` : `Voiture N°${voiture.numero_voiture} rouverte.`,
                validee,
                chef_voiture: nextChef,
            });
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.post("/api/voitures/liste/:id/embarquer/", async (req, res) => {
        try {
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
            const existing = await pool.query("SELECT 1 FROM affectations WHERE etudiant = $1", [etudiantId]);
            if (existing.rows.length > 0) {
                res.status(400).json({ detail: "Cet étudiant est déjà affecté à une voiture." });
                return;
            }
            const countRes = await pool.query("SELECT COUNT(*)::int AS cnt FROM affectations WHERE voiture = $1", [id]);
            if (countRes.rows[0].cnt >= voiture.capacite) {
                res.status(400).json({ detail: `La voiture N°${voiture.numero_voiture} est complète.` });
                return;
            }
            const created = await pool.query(
                "INSERT INTO affectations (etudiant, voiture) VALUES ($1, $2) RETURNING *",
                [etudiantId, id]
            );
            if (!voiture.chef_voiture) {
                await pool.query("UPDATE voitures SET chef_voiture = $1 WHERE id = $2", [etudiantId, id]);
            }
            res.status(201).json(created.rows[0]);
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.post("/api/voitures/liste/auto_affecter/", requireAuth, async (_req, res) => {
        try {
            const unassignedRes = await pool.query(
                `SELECT e.id FROM etudiants e
         LEFT JOIN affectations a ON a.etudiant = e.id
         WHERE a.id IS NULL ORDER BY e.id ASC`
            );
            const voituresRes = await pool.query(
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
                await pool.query("INSERT INTO affectations (etudiant, voiture) VALUES ($1, $2)", [etu.id, target.id]);
                target.occ += 1;
                if (!target.chef_voiture) {
                    target.chef_voiture = etu.id;
                    await pool.query("UPDATE voitures SET chef_voiture = $1 WHERE id = $2", [etu.id, target.id]);
                }
                count++;
            }

            res.json({
                affectes: count,
                restants: unassignedRes.rows.length - count,
                message: `${count} étudiant(s) affecté(s) automatiquement.`,
            });
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    // ============ AFFECTATIONS ============
    app.get("/api/voitures/affectations/", async (req, res) => {
        try {
            const { mediaBase } = getBaseUrl(req);
            const [aRes, eRes, vRes] = await Promise.all([
                pool.query("SELECT * FROM affectations ORDER BY id ASC"),
                pool.query(
                    `SELECT id, matricule, nom, prenom, parcours, email, telephone, qr_token, (photo_data IS NOT NULL) AS has_photo
           FROM etudiants`
                ),
                pool.query(
                    `SELECT id, numero_voiture, capacite, immatriculation, modele, chauffeur, telephone_chauffeur, chef_voiture, validee
           FROM voitures`
                ),
            ]);

            const etuMap = new Map<number, any>();
            for (const e of eRes.rows) etuMap.set(e.id, formatEtudiantRow(e, mediaBase));
            const voiMap = new Map<number, any>();
            for (const v of vRes.rows) voiMap.set(v.id, v);

            res.json(
                aRes.rows.map((a) => ({
                    ...a,
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
            const existing = await pool.query("SELECT 1 FROM affectations WHERE etudiant = $1", [etudiantId]);
            if (existing.rows.length > 0) {
                res.status(400).json({ detail: "Cet étudiant est déjà affecté à une voiture." });
                return;
            }
            const countRes = await pool.query("SELECT COUNT(*)::int AS cnt FROM affectations WHERE voiture = $1", [voitureId]);
            if (countRes.rows[0].cnt >= voiture.capacite) {
                res.status(400).json({ detail: `La voiture N°${voiture.numero_voiture} est pleine.` });
                return;
            }
            const created = await pool.query(
                "INSERT INTO affectations (etudiant, voiture) VALUES ($1, $2) RETURNING *",
                [etudiantId, voitureId]
            );
            if (!voiture.chef_voiture) {
                await pool.query("UPDATE voitures SET chef_voiture = $1 WHERE id = $2", [etudiantId, voitureId]);
            }
            res.status(201).json(created.rows[0]);
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.delete("/api/voitures/affectations/:id/", async (req, res) => {
        try {
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
                res.status(400).json({ detail: "Impossible de retirer un étudiant d'une voiture déjà validée." });
                return;
            }
            await pool.query("DELETE FROM affectations WHERE id = $1", [id]);
            if (voiture && voiture.chef_voiture === aff.etudiant) {
                const nextPass = await pool.query(
                    "SELECT etudiant FROM affectations WHERE voiture = $1 ORDER BY id ASC LIMIT 1",
                    [voiture.id]
                );
                await pool.query("UPDATE voitures SET chef_voiture = $1 WHERE id = $2", [
                    nextPass.rows[0]?.etudiant ?? null,
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

            const [pRes, eRes, vRes, aRes, progRes] = await Promise.all([
                pool.query("SELECT * FROM parametres_voyage ORDER BY id ASC LIMIT 1"),
                pool.query("SELECT id, matricule, nom, prenom, parcours, telephone, email FROM etudiants ORDER BY id ASC"),
                pool.query("SELECT id, numero_voiture, capacite, immatriculation, modele, chauffeur, telephone_chauffeur, chef_voiture, validee FROM voitures ORDER BY numero_voiture ASC"),
                pool.query("SELECT * FROM affectations"),
                pool.query("SELECT * FROM programme_items ORDER BY jour ASC, heure_debut ASC"),
            ]);

            const assignedIds = new Set(aRes.rows.map((a) => a.etudiant));
            const dbSnapshot = {
                statistiques: {
                    total_etudiants: eRes.rows.length,
                    total_affectes: assignedIds.size,
                    total_non_affectes: eRes.rows.length - assignedIds.size,
                    total_voitures: vRes.rows.length,
                    voitures_validees: vRes.rows.filter((v) => v.validee).length,
                },
                parametres: pRes.rows[0] || null,
                etudiants: eRes.rows.map((e) => {
                    const aff = aRes.rows.find((a) => a.etudiant === e.id);
                    const voiture = aff ? vRes.rows.find((v) => v.id === aff.voiture) : null;
                    return {
                        ...e,
                        voiture_numero: voiture ? voiture.numero_voiture : null,
                        est_chef_de_voiture: voiture ? voiture.chef_voiture === e.id : false,
                    };
                }),
                voitures: vRes.rows.map((v) => {
                    const affs = aRes.rows.filter((a) => a.voiture === v.id);
                    const chef = v.chef_voiture ? eRes.rows.find((e) => e.id === v.chef_voiture) : null;
                    const passagers = affs
                        .map((a) => eRes.rows.find((e) => e.id === a.etudiant))
                        .filter(Boolean)
                        .map((e) => ({
                            matricule: e.matricule,
                            nom: e.nom,
                            prenom: e.prenom,
                            parcours: e.parcours,
                            telephone: e.telephone,
                        }));
                    return {
                        numero_voiture: v.numero_voiture,
                        immatriculation: v.immatriculation,
                        modele: v.modele,
                        chauffeur: v.chauffeur,
                        telephone_chauffeur: v.telephone_chauffeur,
                        capacite: v.capacite,
                        places_occupees: passagers.length,
                        places_disponibles: Math.max(0, v.capacite - passagers.length),
                        validee_par_admin: v.validee,
                        chef_voiture: chef ? { matricule: chef.matricule, nom: chef.nom, prenom: chef.prenom, telephone: chef.telephone } : null,
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
                "FORMATAGE OBLIGATOIRE : Rédige tes réponses en texte brut lisible et aéré. N'utilise JAMAIS de syntaxe Markdown : aucun astérisque (** ou *), aucun dièse (#), aucun backtick (`). Utilise uniquement des sauts de ligne, des tirets (-) ou des numéros (1., 2.).",
                "RÈGLE STRICTE : Base tes réponses UNIQUEMENT sur les données JSON en direct de la base fournies ci-dessous. N'invente jamais un matricule, un nom, un numéro de voiture ou un horaire. Si un matricule ou une information n'existe pas dans la base, dis-le clairement.",
                `DONNÉES EN DIRECT DE LA BASE :\n${JSON.stringify(dbSnapshot, null, 2)}`,
            ].join("\n\n");

            const prompt = formattedHistory
                ? `Historique récent :\n${formattedHistory}\n\nNouvelle question : ${question}`
                : question;

            const response = await ai.models.generateContent({
                model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
                contents: prompt,
                config: { systemInstruction },
            });

            res.json({
                reply: cleanAiReply(response.text || "Aucune réponse générée."),
            });
        } catch (err: any) {
            res.status(500).json({ detail: err.message || "Erreur Agent IA." });
        }
    });

    // ============ BADGES & PDF ============
    app.get("/api/badges/:uuid/info/", async (req, res) => {
        try {
            const { frontend, mediaBase } = getBaseUrl(req);
            const eRes = await pool.query(
                `SELECT id, matricule, nom, prenom, parcours, email, telephone, qr_token, (photo_data IS NOT NULL) AS has_photo
         FROM etudiants WHERE qr_token = $1`,
                [req.params.uuid]
            );
            const etu = eRes.rows[0];
            if (!etu) {
                res.status(404).json({ detail: "Badge introuvable." });
                return;
            }
            const [vRes, progRes, paramRes] = await Promise.all([
                pool.query(
                    `SELECT v.id, v.numero_voiture, v.capacite, v.immatriculation, v.modele, v.chauffeur, v.telephone_chauffeur, v.chef_voiture, v.validee
           FROM affectations a JOIN voitures v ON v.id = a.voiture WHERE a.etudiant = $1`,
                    [etu.id]
                ),
                pool.query("SELECT * FROM programme_items ORDER BY jour ASC, heure_debut ASC"),
                pool.query("SELECT * FROM parametres_voyage ORDER BY id ASC LIMIT 1"),
            ]);
            const voiture = vRes.rows[0] || null;
            res.json({
                etudiant: formatEtudiantRow(
                    { ...etu, voiture_id: voiture?.id ?? null, voiture_numero: voiture?.numero_voiture ?? null },
                    mediaBase
                ),
                voiture,
                programme: progRes.rows,
                parametres: paramRes.rows[0] || null,
                qr_url: `${mediaBase}/api/badges/${etu.qr_token}/qr/`,
                badge_public_url: `${frontend}/badge/${etu.qr_token}`,
            });
        } catch (err: any) {
            res.status(500).json({ detail: err.message });
        }
    });

    app.get("/api/badges/:uuid/qr/", async (req, res) => {
        try {
            const { frontend } = getBaseUrl(req);
            const eRes = await pool.query("SELECT qr_token FROM etudiants WHERE qr_token = $1", [req.params.uuid]);
            if (!eRes.rows[0]) {
                res.status(404).json({ detail: "Badge introuvable." });
                return;
            }
            const pngBuffer = await QRCode.toBuffer(`${frontend}/badge/${eRes.rows[0].qr_token}`, {
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
            const { frontend } = getBaseUrl(req);
            const eRes = await pool.query("SELECT * FROM etudiants WHERE qr_token = $1", [req.params.uuid]);
            const etu = eRes.rows[0];
            if (!etu) {
                res.status(404).json({ detail: "Badge introuvable." });
                return;
            }
            const [vRes, progRes, paramRes] = await Promise.all([
                pool.query("SELECT v.* FROM affectations a JOIN voitures v ON v.id = a.voiture WHERE a.etudiant = $1", [etu.id]),
                pool.query("SELECT * FROM programme_items ORDER BY jour ASC, heure_debut ASC"),
                pool.query("SELECT * FROM parametres_voyage ORDER BY id ASC LIMIT 1"),
            ]);
            const voiture = vRes.rows[0] || null;
            const sortedProgramme = progRes.rows;
            const parametres = paramRes.rows[0] || {
                destination: "TOLIARA",
                ecole: "ENI",
                annee_promotion: "2025-2026",
                nom_responsable: "",
                tel_responsable: "",
                nom_responsable_sante: "",
                tel_responsable_sante: "",
            };

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
                voiture ? `VOITURE N° ${voiture.numero_voiture}` : "VOITURE NON AFFECTÉE",
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
                voiture ? `VOITURE V${voiture.numero_voiture}` : "NON AFFECTÉ",
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

    // ============ VITE EN LOCAL UNIQUEMENT ============
    if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else if (!process.env.VERCEL) {
        const distPath = path.resolve(process.cwd(), "dist");
        app.use(express.static(distPath));
        app.get("*", (_req, res) => {
            res.sendFile(path.join(distPath, "index.html"));
        });
    }

    cachedApp = app;
    return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    try {
        const app = await createApp();
        return app(req, res);
    } catch (err: any) {
        console.error("Vercel handler error:", err);
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ detail: err?.message || "Server initialization error" }));
    }
}