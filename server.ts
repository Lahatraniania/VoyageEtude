import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import QRCode from "qrcode";
import PDFDocument from "pdfkit";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });
}

const PORT = 3000;

// ✅ VERCEL : Sur Vercel, seul /tmp est inscriptible. En local, on garde uploads/.
const UPLOAD_DIR = process.env.VERCEL
  ? "/tmp/uploads/etudiants/photos"
  : path.resolve(process.cwd(), "uploads", "etudiants", "photos");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});
const upload = multer({ storage });

interface ParametresVoyage {
  id: number;
  date_debut: string;
  date_fin: string;
  destination: string;
  ecole: string;
  annee_promotion: string;
  nom_responsable: string;
  tel_responsable: string;
  nom_responsable_sante: string;
  tel_responsable_sante: string;
}

interface Etudiant {
  id: number;
  matricule: string;
  nom: string;
  prenom: string;
  parcours: "MDI" | "ASR" | "IG" | "IA";
  email: string;
  telephone: string;
  photo: string | null;
  qr_token: string;
}

interface ProgrammeItem {
  id: number;
  jour: number;
  periode: "MATIN" | "MIDI";
  heure_debut: string;
  heure_fin: string | null;
  activite: string;
  lieu: string;
}

interface Voiture {
  id: number;
  numero_voiture: number;
  capacite: number;
  immatriculation: string;
  chauffeur: string;
  telephone_chauffeur: string;
  chef_voiture: number | null;
  validee: boolean;
}

interface Affectation {
  id: number;
  etudiant: number;
  voiture: number;
}

const ADMIN_USER = {
  id: 1,
  username: process.env.ADMIN_USERNAME || "admin",
  password: process.env.ADMIN_PASSWORD || "eni2026",
  email: "admin@eni.mg",
  first_name: "Administrateur",
  last_name: "ENI",
};

const VALID_TOKENS = new Set<string>();

let parametres: ParametresVoyage = {
  id: 1,
  date_debut: "2026-06-15",
  date_fin: "2026-06-21",
  destination: "TOLIARA",
  ecole: "ENI",
  annee_promotion: "2025-2026",
  nom_responsable: "Pr. Rakotomalala Jean",
  tel_responsable: "+261 34 12 345 67",
  nom_responsable_sante: "Dr. Rasoanirina Miora",
  tel_responsable_sante: "+261 33 98 765 43",
};

let nextEtudiantId = 9;
const etudiants: Etudiant[] = [
  { id: 1, matricule: "2401-ENI", nom: "RANDRIANARIVO", prenom: "Lucas", parcours: "IG", email: "lucas.r@eni.mg", telephone: "034 11 223 34", photo: null, qr_token: "a1b2c3d4-1111-4000-8000-000000000001" },
  { id: 2, matricule: "2402-ENI", nom: "RAKOTONDRABE", prenom: "Sarobidy", parcours: "IA", email: "sarobidy.r@eni.mg", telephone: "034 22 334 45", photo: null, qr_token: "a1b2c3d4-1111-4000-8000-000000000002" },
  { id: 3, matricule: "2403-ENI", nom: "ANDRIAMANANA", prenom: "Tiana", parcours: "ASR", email: "tiana.a@eni.mg", telephone: "032 45 678 90", photo: null, qr_token: "a1b2c3d4-1111-4000-8000-000000000003" },
  { id: 4, matricule: "2404-ENI", nom: "RAZAFINDRATSIMA", prenom: "Feno", parcours: "MDI", email: "feno.r@eni.mg", telephone: "033 55 112 23", photo: null, qr_token: "a1b2c3d4-1111-4000-8000-000000000004" },
  { id: 5, matricule: "2405-ENI", nom: "RABEMANANJARA", prenom: "Koloina", parcours: "IA", email: "koloina.r@eni.mg", telephone: "034 88 990 11", photo: null, qr_token: "a1b2c3d4-1111-4000-8000-000000000005" },
  { id: 6, matricule: "2406-ENI", nom: "RAMAROSON", prenom: "Hery", parcours: "IG", email: "hery.r@eni.mg", telephone: "034 77 665 44", photo: null, qr_token: "a1b2c3d4-1111-4000-8000-000000000006" },
  { id: 7, matricule: "2407-ENI", nom: "RATSIMBAZAFY", prenom: "Nomena", parcours: "ASR", email: "nomena.r@eni.mg", telephone: "032 10 203 04", photo: null, qr_token: "a1b2c3d4-1111-4000-8000-000000000007" },
  { id: 8, matricule: "2408-ENI", nom: "RASOLOFOMANANA", prenom: "Mialy", parcours: "MDI", email: "mialy.r@eni.mg", telephone: "033 44 556 67", photo: null, qr_token: "a1b2c3d4-1111-4000-8000-000000000008" },
];

let nextProgrammeId = 15;
const programmes: ProgrammeItem[] = [
  { id: 1, jour: 1, periode: "MATIN", heure_debut: "05:30", heure_fin: "12:00", activite: "Rassemblement ENI & Départ convoi RN7", lieu: "Campus Tanambao, Fianarantsoa" },
  { id: 2, jour: 1, periode: "MIDI", heure_debut: "13:00", heure_fin: "19:30", activite: "Escale Ihosy & Arrivée à Toliara", lieu: "Hôtel Le Grand Bleu, Toliara" },
  { id: 3, jour: 2, periode: "MATIN", heure_debut: "08:00", heure_fin: "12:00", activite: "Visite infrastructure télécom & datacenter régional", lieu: "Telma / Yas Hub Toliara" },
  { id: 4, jour: 2, periode: "MIDI", heure_debut: "14:00", heure_fin: "17:00", activite: "Conférence Cloud & Cybersécurité avec l'Université", lieu: "Université de Toliara" },
  { id: 5, jour: 3, periode: "MATIN", heure_debut: "08:30", heure_fin: "12:00", activite: "Immersion systèmes embarqués & énergie solaire", lieu: "Centrale Solaire Toliara" },
  { id: 6, jour: 3, periode: "MIDI", heure_debut: "14:00", heure_fin: "17:30", activite: "Atelier IA appliquée à la biodiversité marine", lieu: "IHSM Toliara" },
  { id: 7, jour: 4, periode: "MATIN", heure_debut: "08:00", heure_fin: "12:00", activite: "Audit SI & gestion logistique portuaire", lieu: "Port de Toliara" },
  { id: 8, jour: 4, periode: "MIDI", heure_debut: "14:30", heure_fin: "18:00", activite: "Découverte culturelle & cohésion d'équipe", lieu: "Ifaty / Mangily" },
  { id: 9, jour: 5, periode: "MATIN", heure_debut: "08:30", heure_fin: "12:00", activite: "Table ronde entreprises numériques du Sud", lieu: "Chambre de Commerce Toliara" },
  { id: 10, jour: 5, periode: "MIDI", heure_debut: "14:00", heure_fin: "17:00", activite: "Hackathon inter-parcours MDI/ASR/IG/IA", lieu: "Salle Conférence Hôtel" },
  { id: 11, jour: 6, periode: "MATIN", heure_debut: "09:00", heure_fin: "12:00", activite: "Restitution des travaux & remise attestations", lieu: "Université de Toliara" },
  { id: 12, jour: 6, periode: "MIDI", heure_debut: "15:00", heure_fin: "18:30", activite: "Visite Arboretum d'Antsokay", lieu: "Antsokay" },
  { id: 13, jour: 7, periode: "MATIN", heure_debut: "06:00", heure_fin: "12:30", activite: "Départ retour convoi Toliara → Fianarantsoa", lieu: "RN7" },
  { id: 14, jour: 7, periode: "MIDI", heure_debut: "13:30", heure_fin: "20:00", activite: "Arrivée finale & clôture du voyage d'étude", lieu: "Campus ENI Fianarantsoa" },
];

let nextVoitureId = 3;
const voitures: Voiture[] = [
  { id: 1, numero_voiture: 1, capacite: 26, immatriculation: "4521 TAB", chauffeur: "Rabe Patrice", telephone_chauffeur: "034 12 001 01", chef_voiture: 1, validee: false },
  { id: 2, numero_voiture: 2, capacite: 26, immatriculation: "7890 TBC", chauffeur: "Rakoto Solo", telephone_chauffeur: "034 12 002 02", chef_voiture: 4, validee: false },
];

let nextAffectationId = 7;
const affectations: Affectation[] = [
  { id: 1, etudiant: 1, voiture: 1 },
  { id: 2, etudiant: 2, voiture: 1 },
  { id: 3, etudiant: 3, voiture: 1 },
  { id: 4, etudiant: 4, voiture: 2 },
  { id: 5, etudiant: 5, voiture: 2 },
  { id: 6, etudiant: 6, voiture: 2 },
];

function getBaseUrl(req: express.Request): { frontend: string; backend: string } {
  const origin = `${req.protocol}://${req.get("host")}`;
  const frontend = process.env.PUBLIC_FRONTEND_URL || process.env.APP_URL || origin;
  const backend = process.env.PUBLIC_BACKEND_URL || process.env.APP_URL || origin;
  return { frontend: frontend.replace(/\/$/, ""), backend: backend.replace(/\/$/, "") };
}

function enrichEtudiant(e: Etudiant, backendUrl: string) {
  const aff = affectations.find((a) => a.etudiant === e.id);
  const voiture = aff ? voitures.find((v) => v.id === aff.voiture) || null : null;
  return {
    ...e,
    photo_url: e.photo ? `${backendUrl}${e.photo}` : null,
    voiture_numero: voiture ? voiture.numero_voiture : null,
    voiture_id: voiture ? voiture.id : null,
  };
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ detail: "Authentification requise." });
    return;
  }
  const token = header.slice(7);
  if (!VALID_TOKENS.has(token)) {
    res.status(401).json({ detail: "Token invalide ou expiré." });
    return;
  }
  next();
}

export async function createApp() {
  const app = express();
  app.set("trust proxy", true);
  app.use(express.json());

  // ✅ VERCEL : On sert les médias depuis /tmp sur Vercel, depuis uploads/ en local
  const MEDIA_ROOT = process.env.VERCEL
    ? "/tmp/uploads"
    : path.resolve(process.cwd(), "uploads");
  app.use("/media", express.static(MEDIA_ROOT));

  // ============ AUTH ============
  app.post("/api/auth/login/", (req, res) => {
    const { username, password } = req.body || {};
    if (username === ADMIN_USER.username && password === ADMIN_USER.password) {
      const access = `eni_${crypto.randomBytes(24).toString("hex")}`;
      const refresh = `eni_ref_${crypto.randomBytes(24).toString("hex")}`;
      VALID_TOKENS.add(access);
      res.json({ access, refresh });
      return;
    }
    res.status(401).json({ detail: "Identifiants invalides." });
  });

  app.post("/api/auth/refresh/", (_req, res) => {
    const access = `eni_${crypto.randomBytes(24).toString("hex")}`;
    VALID_TOKENS.add(access);
    res.json({ access });
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
  app.get("/api/core/parametres/", (_req, res) => {
    res.json([parametres]);
  });

  app.post("/api/core/parametres/", requireAuth, (req, res) => {
    parametres = { ...parametres, ...req.body, id: 1 };
    res.status(201).json(parametres);
  });

  app.put("/api/core/parametres/:id/", requireAuth, (req, res) => {
    parametres = { ...parametres, ...req.body, id: 1 };
    res.json(parametres);
  });

  app.patch("/api/core/parametres/:id/", requireAuth, (req, res) => {
    parametres = { ...parametres, ...req.body, id: 1 };
    res.json(parametres);
  });

  // ============ ETUDIANTS ============
  app.get("/api/etudiants/", (req, res) => {
    const { backend } = getBaseUrl(req);
    const search = String(req.query.search || "").trim().toLowerCase();
    const parcours = String(req.query.parcours || "").trim().toUpperCase();
    let list = etudiants.map((e) => enrichEtudiant(e, backend));
    if (search) {
      list = list.filter(
        (e) =>
          e.nom.toLowerCase().includes(search) ||
          e.prenom.toLowerCase().includes(search) ||
          e.matricule.toLowerCase().includes(search)
      );
    }
    if (parcours) {
      list = list.filter((e) => e.parcours === parcours);
    }
    res.json(list);
  });

  app.post("/api/etudiants/", requireAuth, upload.single("photo"), (req, res) => {
    const { backend } = getBaseUrl(req);
    const body = req.body || {};
    if (!body.matricule || !body.nom || !body.prenom || !body.parcours) {
      res.status(400).json({ detail: "Matricule, nom, prénom et parcours sont obligatoires." });
      return;
    }
    if (etudiants.some((e) => e.matricule.toLowerCase() === String(body.matricule).toLowerCase())) {
      res.status(400).json({ matricule: ["Ce matricule existe déjà."] });
      return;
    }
    const created: Etudiant = {
      id: nextEtudiantId++,
      matricule: String(body.matricule).trim(),
      nom: String(body.nom).trim().toUpperCase(),
      prenom: String(body.prenom).trim(),
      parcours: body.parcours,
      email: body.email || "",
      telephone: body.telephone || "",
      photo: req.file ? `/media/etudiants/photos/${req.file.filename}` : null,
      qr_token: crypto.randomUUID(),
    };
    etudiants.unshift(created);
    res.status(201).json(enrichEtudiant(created, backend));
  });

  app.patch("/api/etudiants/:id/", requireAuth, upload.single("photo"), (req, res) => {
    const { backend } = getBaseUrl(req);
    const id = Number(req.params.id);
    const idx = etudiants.findIndex((e) => e.id === id);
    if (idx === -1) {
      res.status(404).json({ detail: "Étudiant introuvable." });
      return;
    }
    const body = req.body || {};
    etudiants[idx] = {
      ...etudiants[idx],
      matricule: body.matricule ?? etudiants[idx].matricule,
      nom: body.nom ? String(body.nom).toUpperCase() : etudiants[idx].nom,
      prenom: body.prenom ?? etudiants[idx].prenom,
      parcours: body.parcours ?? etudiants[idx].parcours,
      email: body.email ?? etudiants[idx].email,
      telephone: body.telephone ?? etudiants[idx].telephone,
      photo: req.file ? `/media/etudiants/photos/${req.file.filename}` : etudiants[idx].photo,
    };
    res.json(enrichEtudiant(etudiants[idx], backend));
  });

  app.delete("/api/etudiants/:id/", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const idx = etudiants.findIndex((e) => e.id === id);
    if (idx === -1) {
      res.status(404).json({ detail: "Étudiant introuvable." });
      return;
    }
    etudiants.splice(idx, 1);
    for (let i = affectations.length - 1; i >= 0; i--) {
      if (affectations[i].etudiant === id) affectations.splice(i, 1);
    }
    res.status(204).end();
  });

  // ============ PROGRAMME ============
  app.get("/api/programme/", (_req, res) => {
    const sorted = [...programmes].sort((a, b) => a.jour - b.jour || a.heure_debut.localeCompare(b.heure_debut));
    res.json(sorted);
  });

  app.post("/api/programme/", requireAuth, (req, res) => {
    const body = req.body || {};
    const jour = Number(body.jour);
    if (jour < 1 || jour > 7) {
      res.status(400).json({ jour: ["Le jour doit être compris entre 1 et 7."] });
      return;
    }
    const created: ProgrammeItem = {
      id: nextProgrammeId++,
      jour,
      periode: body.periode || "MATIN",
      heure_debut: body.heure_debut || "08:00",
      heure_fin: body.heure_fin || null,
      activite: body.activite || "",
      lieu: body.lieu || "",
    };
    programmes.push(created);
    res.status(201).json(created);
  });

  app.patch("/api/programme/:id/", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const idx = programmes.findIndex((p) => p.id === id);
    if (idx === -1) {
      res.status(404).json({ detail: "Activité introuvable." });
      return;
    }
    programmes[idx] = { ...programmes[idx], ...req.body, jour: Number(req.body.jour ?? programmes[idx].jour) };
    res.json(programmes[idx]);
  });

  app.delete("/api/programme/:id/", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const idx = programmes.findIndex((p) => p.id === id);
    if (idx === -1) {
      res.status(404).json({ detail: "Activité introuvable." });
      return;
    }
    programmes.splice(idx, 1);
    res.status(204).end();
  });

  // ============ VOITURES ============
  app.get("/api/voitures/liste/", (req, res) => {
    const { backend } = getBaseUrl(req);
    const enriched = [...voitures]
      .sort((a, b) => a.numero_voiture - b.numero_voiture)
      .map((v) => {
        const affs = affectations.filter((a) => a.voiture === v.id);
        const chef = v.chef_voiture ? etudiants.find((e) => e.id === v.chef_voiture) || null : null;
        return {
          ...v,
          chef_voiture_detail: chef ? enrichEtudiant(chef, backend) : null,
          places_occupees: affs.length,
          places_disponibles: Math.max(0, v.capacite - affs.length),
          etudiants: affs
            .map((a) => etudiants.find((e) => e.id === a.etudiant))
            .filter((e): e is Etudiant => Boolean(e))
            .map((e) => enrichEtudiant(e, backend)),
        };
      });
    res.json(enriched);
  });

  app.post("/api/voitures/liste/", requireAuth, (req, res) => {
    const body = req.body || {};
    const num = Number(body.numero_voiture);
    if (voitures.some((v) => v.numero_voiture === num)) {
      res.status(400).json({ numero_voiture: ["Ce numéro de voiture existe déjà."] });
      return;
    }
    const created: Voiture = {
      id: nextVoitureId++,
      numero_voiture: num,
      capacite: Number(body.capacite || 26),
      immatriculation: body.immatriculation || "",
      chauffeur: body.chauffeur || "",
      telephone_chauffeur: body.telephone_chauffeur || "",
      chef_voiture: body.chef_voiture ? Number(body.chef_voiture) : null,
      validee: false,
    };
    voitures.push(created);
    res.status(201).json({ ...created, chef_voiture_detail: null, places_occupees: 0, places_disponibles: created.capacite, etudiants: [] });
  });

  app.patch("/api/voitures/liste/:id/", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const idx = voitures.findIndex((v) => v.id === id);
    if (idx === -1) {
      res.status(404).json({ detail: "Voiture introuvable." });
      return;
    }
    voitures[idx] = {
      ...voitures[idx],
      ...req.body,
      numero_voiture: Number(req.body.numero_voiture ?? voitures[idx].numero_voiture),
      capacite: Number(req.body.capacite ?? voitures[idx].capacite),
    };
    res.json(voitures[idx]);
  });

  app.delete("/api/voitures/liste/:id/", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const idx = voitures.findIndex((v) => v.id === id);
    if (idx === -1) {
      res.status(404).json({ detail: "Voiture introuvable." });
      return;
    }
    voitures.splice(idx, 1);
    for (let i = affectations.length - 1; i >= 0; i--) {
      if (affectations[i].voiture === id) affectations.splice(i, 1);
    }
    res.status(204).end();
  });

  app.post("/api/voitures/liste/:id/designer_chef/", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const etudiantId = Number(req.body.etudiant);
    const voiture = voitures.find((v) => v.id === id);
    if (!voiture) {
      res.status(404).json({ detail: "Voiture introuvable." });
      return;
    }
    const existingAff = affectations.find((a) => a.etudiant === etudiantId);
    if (existingAff && existingAff.voiture !== id) {
      res.status(400).json({ detail: "Cet étudiant est déjà affecté à une autre voiture." });
      return;
    }
    if (!existingAff) {
      const occ = affectations.filter((a) => a.voiture === id).length;
      if (occ >= voiture.capacite) {
        res.status(400).json({ detail: `La voiture N°${voiture.numero_voiture} est pleine.` });
        return;
      }
      affectations.push({ id: nextAffectationId++, etudiant: etudiantId, voiture: id });
    }
    voiture.chef_voiture = etudiantId;
    res.json({ detail: "Chef de voiture désigné.", chef_voiture: etudiantId });
  });

  app.post("/api/voitures/liste/:id/valider/", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const voiture = voitures.find((v) => v.id === id);
    if (!voiture) {
      res.status(404).json({ detail: "Voiture introuvable." });
      return;
    }
    const validee = req.body?.validee !== undefined ? Boolean(req.body.validee) : true;
    const carAffs = affectations.filter((a) => a.voiture === id);
    if (validee && carAffs.length === 0) {
      res.status(400).json({ detail: "Impossible de valider une voiture vide." });
      return;
    }
    if (req.body?.chef_voiture) {
      voiture.chef_voiture = Number(req.body.chef_voiture);
    } else if (validee && !voiture.chef_voiture && carAffs.length > 0) {
      voiture.chef_voiture = carAffs[0].etudiant;
    }
    voiture.validee = validee;
    res.json({
      detail: validee ? `Voiture N°${voiture.numero_voiture} validée.` : `Voiture N°${voiture.numero_voiture} rouverte.`,
      validee: voiture.validee,
      chef_voiture: voiture.chef_voiture,
    });
  });

  app.post("/api/voitures/liste/:id/embarquer/", (req, res) => {
    const id = Number(req.params.id);
    const etudiantId = Number(req.body.etudiant);
    const voiture = voitures.find((v) => v.id === id);
    if (!voiture) {
      res.status(404).json({ detail: "Voiture introuvable." });
      return;
    }
    if (voiture.validee) {
      res.status(400).json({ detail: "Cette voiture est déjà validée par l'administration." });
      return;
    }
    if (affectations.some((a) => a.etudiant === etudiantId)) {
      res.status(400).json({ detail: "Cet étudiant est déjà affecté à une voiture." });
      return;
    }
    const occ = affectations.filter((a) => a.voiture === id).length;
    if (occ >= voiture.capacite) {
      res.status(400).json({ detail: `La voiture N°${voiture.numero_voiture} est complète.` });
      return;
    }
    const created = { id: nextAffectationId++, etudiant: etudiantId, voiture: id };
    affectations.push(created);
    if (!voiture.chef_voiture) {
      voiture.chef_voiture = etudiantId;
    }
    res.status(201).json(created);
  });

  app.post("/api/voitures/liste/auto_affecter/", requireAuth, (_req, res) => {
    const assignedIds = new Set(affectations.map((a) => a.etudiant));
    const unassigned = etudiants.filter((e) => !assignedIds.has(e.id));
    const sortedVoitures = [...voitures].sort((a, b) => a.numero_voiture - b.numero_voiture);
    let count = 0;

    for (const etu of unassigned) {
      const target = sortedVoitures.find((v) => {
        if (v.validee) return false;
        const occ = affectations.filter((a) => a.voiture === v.id).length;
        return occ < v.capacite;
      });
      if (!target) break;
      affectations.push({ id: nextAffectationId++, etudiant: etu.id, voiture: target.id });
      if (!target.chef_voiture) target.chef_voiture = etu.id;
      count++;
    }

    res.json({
      affectes: count,
      restants: unassigned.length - count,
      message: `${count} étudiant(s) affecté(s) automatiquement.`,
    });
  });

  // ============ AFFECTATIONS ============
  app.get("/api/voitures/affectations/", (req, res) => {
    const { backend } = getBaseUrl(req);
    const list = affectations.map((a) => {
      const etu = etudiants.find((e) => e.id === a.etudiant);
      const voi = voitures.find((v) => v.id === a.voiture);
      return {
        ...a,
        etudiant_detail: etu ? enrichEtudiant(etu, backend) : null,
        voiture_detail: voi || null,
      };
    });
    res.json(list);
  });

  app.post("/api/voitures/affectations/", (req, res) => {
    const etudiantId = Number(req.body.etudiant);
    const voitureId = Number(req.body.voiture);
    const voiture = voitures.find((v) => v.id === voitureId);
    if (!voiture) {
      res.status(404).json({ detail: "Voiture introuvable." });
      return;
    }
    if (voiture.validee) {
      res.status(400).json({ detail: `La voiture N°${voiture.numero_voiture} est déjà validée.` });
      return;
    }
    if (affectations.some((a) => a.etudiant === etudiantId)) {
      res.status(400).json({ detail: "Cet étudiant est déjà affecté à une voiture." });
      return;
    }
    const occ = affectations.filter((a) => a.voiture === voitureId).length;
    if (occ >= voiture.capacite) {
      res.status(400).json({ detail: `La voiture N°${voiture.numero_voiture} est pleine.` });
      return;
    }
    const created = { id: nextAffectationId++, etudiant: etudiantId, voiture: voitureId };
    affectations.push(created);
    if (!voiture.chef_voiture) {
      voiture.chef_voiture = etudiantId;
    }
    res.status(201).json(created);
  });

  app.delete("/api/voitures/affectations/:id/", (req, res) => {
    const id = Number(req.params.id);
    const idx = affectations.findIndex((a) => a.id === id);
    if (idx === -1) {
      res.status(404).json({ detail: "Affectation introuvable." });
      return;
    }
    const aff = affectations[idx];
    const voiture = voitures.find((v) => v.id === aff.voiture);
    if (voiture?.validee) {
      res.status(400).json({ detail: "Impossible de retirer un étudiant d'une voiture déjà validée." });
      return;
    }
    affectations.splice(idx, 1);
    if (voiture && voiture.chef_voiture === aff.etudiant) {
      const remaining = affectations.find((a) => a.voiture === voiture.id);
      voiture.chef_voiture = remaining ? remaining.etudiant : null;
    }
    res.status(204).end();
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
        res.status(500).json({
          detail: "Clé GEMINI_API_KEY manquante côté serveur.",
        });
        return;
      }

      const assignedIds = new Set(affectations.map((a) => a.etudiant));
      const dbSnapshot = {
        statistiques: {
          total_etudiants: etudiants.length,
          total_affectes: assignedIds.size,
          total_non_affectes: etudiants.length - assignedIds.size,
          total_voitures: voitures.length,
          voitures_validees: voitures.filter((v) => v.validee).length,
        },
        parametres,
        etudiants: etudiants.map((e) => {
          const aff = affectations.find((a) => a.etudiant === e.id);
          const voiture = aff ? voitures.find((v) => v.id === aff.voiture) : null;
          return {
            id: e.id,
            matricule: e.matricule,
            nom: e.nom,
            prenom: e.prenom,
            parcours: e.parcours,
            telephone: e.telephone,
            email: e.email,
            voiture_numero: voiture ? voiture.numero_voiture : null,
            est_chef_de_voiture: voiture ? voiture.chef_voiture === e.id : false,
          };
        }),
        voitures: voitures.map((v) => {
          const affs = affectations.filter((a) => a.voiture === v.id);
          const chef = v.chef_voiture ? etudiants.find((e) => e.id === v.chef_voiture) : null;
          const passagers = affs
            .map((a) => etudiants.find((e) => e.id === a.etudiant))
            .filter((e): e is Etudiant => Boolean(e))
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
            chauffeur: v.chauffeur,
            telephone_chauffeur: v.telephone_chauffeur,
            capacite: v.capacite,
            places_occupees: passagers.length,
            places_disponibles: Math.max(0, v.capacite - passagers.length),
            validee_par_admin: v.validee,
            chef_voiture: chef
              ? {
                matricule: chef.matricule,
                nom: chef.nom,
                prenom: chef.prenom,
                telephone: chef.telephone,
              }
              : null,
            passagers,
          };
        }),
        programme: [...programmes].sort(
          (a, b) => a.jour - b.jour || a.heure_debut.localeCompare(b.heure_debut)
        ),
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
        "RÈGLE STRICTE : Base tes réponses UNIQUEMENT sur les données JSON en direct de la base fournies ci-dessous. N'invente jamais un matricule, un nom, un numéro de voiture ou un horaire. Si un matricule ou une information n'existe pas dans la base, dis-le clairement.",
        `DONNÉES EN DIRECT DE LA BASE :\n${JSON.stringify(dbSnapshot, null, 2)}`,
      ].join("\n\n");

      const prompt = formattedHistory
        ? `Historique récent :\n${formattedHistory}\n\nNouvelle question : ${question}`
        : question;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", // ✅ modèle stable
        contents: prompt,
        config: { systemInstruction },
      });

      res.json({ reply: response.text || "Aucune réponse générée." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'appel à l'Agent IA.";
      res.status(500).json({ detail: msg });
    }
  });

  // ============ BADGES ============
  app.get("/api/badges/:uuid/info/", (req, res) => {
    const { frontend, backend } = getBaseUrl(req);
    const etu = etudiants.find((e) => e.qr_token === req.params.uuid);
    if (!etu) {
      res.status(404).json({ detail: "Badge introuvable." });
      return;
    }
    const aff = affectations.find((a) => a.etudiant === etu.id);
    const voiture = aff ? voitures.find((v) => v.id === aff.voiture) || null : null;
    const sortedProgramme = [...programmes].sort(
      (a, b) => a.jour - b.jour || a.heure_debut.localeCompare(b.heure_debut)
    );

    res.json({
      etudiant: enrichEtudiant(etu, backend),
      voiture,
      programme: sortedProgramme,
      parametres,
      qr_url: `${backend}/api/badges/${etu.qr_token}/qr/`,
      badge_public_url: `${frontend}/badge/${etu.qr_token}`,
    });
  });

  app.get("/api/badges/:uuid/qr/", async (req, res) => {
    const { frontend } = getBaseUrl(req);
    const etu = etudiants.find((e) => e.qr_token === req.params.uuid);
    if (!etu) {
      res.status(404).json({ detail: "Badge introuvable." });
      return;
    }
    const targetUrl = `${frontend}/badge/${etu.qr_token}`;
    const pngBuffer = await QRCode.toBuffer(targetUrl, {
      type: "png",
      width: 320,
      margin: 2,
      color: { dark: "#14532d", light: "#ffffff" },
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    res.send(pngBuffer);
  });

  app.get("/api/badges/:uuid/pdf/", async (req, res) => {
    const { frontend } = getBaseUrl(req);
    const etu = etudiants.find((e) => e.qr_token === req.params.uuid);
    if (!etu) {
      res.status(404).json({ detail: "Badge introuvable." });
      return;
    }
    const aff = affectations.find((a) => a.etudiant === etu.id);
    const voiture = aff ? voitures.find((v) => v.id === aff.voiture) || null : null;
    const sortedProgramme = [...programmes].sort(
      (a, b) => a.jour - b.jour || a.heure_debut.localeCompare(b.heure_debut)
    );
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

    // RECTO
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

    // VERSO
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
  });

  // ============ VITE / STATIC ============
  // ✅ VERCEL : En production (déploiement), on sert le dossier dist/
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}

// ✅ VERCEL : On démarre seulement en local, on exporte sur Vercel
export default createApp;