export type ParcoursType = "MDI" | "ASR" | "IG" | "IA";

export interface ParametresVoyage {
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

export interface Etudiant {
  id: number;
  matricule: string;
  nom: string;
  prenom: string;
  parcours: ParcoursType;
  email: string;
  telephone: string;
  photo: string | null;
  photo_url?: string | null;
  qr_token: string;
  voiture_numero?: number | null;
  voiture_id?: number | null;
}

export interface ProgrammeItem {
  id: number;
  jour: number;
  periode: "MATIN" | "MIDI";
  heure_debut: string;
  heure_fin: string | null;
  activite: string;
  lieu: string;
}

export interface Voiture {
  id: number;
  numero_voiture: number;
  capacite: number;
  immatriculation: string;
  modele?: string;
  chauffeur: string;
  telephone_chauffeur: string;
  photo?: string | null;
  photo_url?: string | null;
  chef_voiture?: number | null;
  chef_voiture_detail?: Etudiant | null;
  validee?: boolean;
  places_occupees?: number;
  places_disponibles?: number;
  etudiants?: Etudiant[];
}

export interface Affectation {
  id: number;
  etudiant: number;
  voiture: number;
  etudiant_detail?: Etudiant | null;
  voiture_detail?: Voiture | null;
}

export interface BadgeInfoResponse {
  etudiant: Etudiant;
  voiture: Voiture | null;
  programme: ProgrammeItem[];
  parametres: ParametresVoyage;
  qr_url: string;
  badge_public_url: string;
}