import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Pencil,
  Trash2,
  Car,
  RefreshCw,
  Search,
  CheckCircle,
  Clock,
  Phone,
  UserCheck,
  ImagePlus,
  X,
  ArrowRight,
} from "lucide-react";
import Layout from "../../components/Layout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Spinner from "../../components/ui/Spinner";
import EmptyState from "../../components/ui/EmptyState";
import axiosClient from "../../api/axiosClient";
import type { Voiture } from "../../types";

type VoitureFilter = "all" | "available" | "validated";

export const VoituresPage: React.FC = () => {
  const [voitures, setVoitures] = useState<Voiture[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoLoading, setAutoLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<VoitureFilter>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Voiture | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Voiture | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    numero_voiture: 1,
    capacite: 26,
    immatriculation: "",
    modele: "",
    chauffeur: "",
    telephone_chauffeur: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({});

  const fetchVoitures = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosClient.get<Voiture[]>("/voitures/liste/");
      setVoitures(data);
      setBrokenImages({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVoitures();
  }, [fetchVoitures]);

  useEffect(() => {
    if (photoFile) {
      const objectUrl = URL.createObjectURL(photoFile);
      setPhotoPreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    if (removeExistingPhoto) {
      setPhotoPreview(null);
      return;
    }
    setPhotoPreview(editing?.photo_url || null);
  }, [photoFile, editing, removeExistingPhoto]);

  const openCreate = () => {
    setEditing(null);
    setErrorMessage("");
    const nextNum = voitures.length > 0 ? Math.max(...voitures.map((v) => v.numero_voiture)) + 1 : 1;
    setForm({
      numero_voiture: nextNum,
      capacite: 26,
      immatriculation: "",
      modele: "",
      chauffeur: "",
      telephone_chauffeur: "",
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemoveExistingPhoto(false);
    setModalOpen(true);
  };

  const openEdit = (v: Voiture) => {
    setEditing(v);
    setErrorMessage("");
    setForm({
      numero_voiture: v.numero_voiture,
      capacite: v.capacite,
      immatriculation: v.immatriculation || "",
      modele: v.modele || "",
      chauffeur: v.chauffeur || "",
      telephone_chauffeur: v.telephone_chauffeur || "",
    });
    setPhotoFile(null);
    setRemoveExistingPhoto(false);
    setPhotoPreview(v.photo_url || null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage("");
    try {
      const fd = new FormData();
      fd.append("numero_voiture", String(form.numero_voiture));
      fd.append("capacite", String(form.capacite));
      fd.append("immatriculation", form.immatriculation);
      fd.append("modele", form.modele);
      fd.append("chauffeur", form.chauffeur);
      fd.append("telephone_chauffeur", form.telephone_chauffeur);
      if (photoFile) {
        fd.append("photo", photoFile);
      } else if (removeExistingPhoto) {
        fd.append("remove_photo", "true");
      }

      if (editing) {
        await axiosClient.patch(`/voitures/liste/${editing.id}/`, fd);
      } else {
        await axiosClient.post("/voitures/liste/", fd);
      }
      setModalOpen(false);
      await fetchVoitures();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { detail?: string; numero_voiture?: string[] } } })?.response?.data;
      setErrorMessage(data?.detail || data?.numero_voiture?.[0] || "Impossible d'enregistrer la voiture.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await axiosClient.delete(`/voitures/liste/${deleteTarget.id}/`);
      setDeleteTarget(null);
      await fetchVoitures();
    } finally {
      setSaving(false);
    }
  };

  const handleAutoAffecter = async () => {
    setAutoLoading(true);
    setStatusMessage("");
    setErrorMessage("");
    try {
      const { data } = await axiosClient.post<{ message: string }>("/voitures/liste/auto_affecter/");
      setStatusMessage(data.message);
      await fetchVoitures();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErrorMessage(detail || "Erreur lors de l'auto-affectation.");
    } finally {
      setAutoLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalCapacite = voitures.reduce((acc, v) => acc + v.capacite, 0);
    const totalOccupes = voitures.reduce((acc, v) => acc + (v.places_occupees || 0), 0);
    const validees = voitures.filter((v) => v.validee).length;
    return { totalCapacite, totalOccupes, validees };
  }, [voitures]);

  const filteredVoitures = useMemo(() => {
    const q = search.trim().toLowerCase();
    return voitures.filter((v) => {
      if (filter === "available" && (v.validee || (v.places_occupees || 0) >= v.capacite)) return false;
      if (filter === "validated" && !v.validee) return false;
      if (!q) return true;
      return (
        String(v.numero_voiture).includes(q) ||
        (v.immatriculation || "").toLowerCase().includes(q) ||
        (v.modele || "").toLowerCase().includes(q) ||
        (v.chauffeur || "").toLowerCase().includes(q)
      );
    });
  }, [voitures, search, filter]);

  return (
    <Layout title="Gestion des voitures">
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <span className="text-xs font-medium text-slate-500">Flotte enregistrée</span>
            <p className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {voitures.length}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {stats.validees} validée(s)
            </p>
          </Card>
          <Card>
            <span className="text-xs font-medium text-slate-500">Capacité totale</span>
            <p className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {stats.totalCapacite}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">places disponibles</p>
          </Card>
          <Card>
            <span className="text-xs font-medium text-slate-500">Étudiants placés</span>
            <p className="font-display text-2xl font-bold text-eni-700 mt-1 tabular-nums">
              {stats.totalOccupes}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {Math.max(0, stats.totalCapacite - stats.totalOccupes)} place(s) libre(s)
            </p>
          </Card>
          <Card>
            <span className="text-xs font-medium text-slate-500">Remplissage convoi</span>
            <p className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {stats.totalCapacite > 0
                ? Math.round((stats.totalOccupes / stats.totalCapacite) * 100)
                : 0}
              %
            </p>
            <p className="text-xs text-slate-500 mt-0.5">taux global</p>
          </Card>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher N°, plaque, modèle, chauffeur..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-eni-600/20 focus:border-eni-600 min-h-[40px]"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
              {(
                [
                  { id: "all", label: "Toutes" },
                  { id: "available", label: "Places libres" },
                  { id: "validated", label: "Validées" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${filter === tab.id
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button variant="gold" onClick={handleAutoAffecter} loading={autoLoading}>
              <RefreshCw className="w-4 h-4" />
              <span>Auto-affecter</span>
            </Button>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" />
              <span>Ajouter une voiture</span>
            </Button>
          </div>
        </div>

        {statusMessage && (
          <div className="rounded-lg bg-eni-50 border border-eni-200 px-4 py-3 text-sm text-eni-900">
            {statusMessage}
          </div>
        )}

        {errorMessage && !modalOpen && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <Spinner label="Chargement des voitures..." />
        ) : filteredVoitures.length === 0 ? (
          <EmptyState
            icon={<Car className="w-6 h-6" />}
            title={voitures.length === 0 ? "Aucune voiture enregistrée" : "Aucun résultat"}
            description={
              voitures.length === 0
                ? "Ajoutez les véhicules du convoi avec leurs photos avant de lancer l'affectation."
                : "Aucune voiture ne correspond à votre recherche ou filtre actuel."
            }
            action={
              voitures.length === 0 ? (
                <Button onClick={openCreate}>Ajouter une voiture</Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                >
                  Réinitialiser les filtres
                </Button>
              )
            }
          />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredVoitures.map((v) => {
              const occ = v.places_occupees || 0;
              const pct = Math.min(100, Math.round((occ / Math.max(1, v.capacite)) * 100));
              const hasPhoto = Boolean(v.photo_url && !brokenImages[v.id]);

              return (
                <Card key={v.id} padding="none" className="overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="relative aspect-[16/10] bg-slate-100 border-b border-slate-200 overflow-hidden">
                      {hasPhoto ? (
                        <img
                          src={v.photo_url!}
                          alt={`Voiture N° ${v.numero_voiture}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={() =>
                            setBrokenImages((prev) => ({ ...prev, [v.id]: true }))
                          }
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-100 to-eni-50 flex flex-col items-center justify-center gap-2 text-slate-400">
                          <Car className="w-9 h-9 text-eni-700/50" />
                          <span className="text-xs font-medium text-slate-500">
                            Aucune photo du véhicule
                          </span>
                        </div>
                      )}

                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/95 backdrop-blur-xs rounded-lg p-1 border border-slate-200/80 shadow-xs">
                        <button
                          type="button"
                          onClick={() => openEdit(v)}
                          className="p-1.5 rounded-md text-slate-600 hover:text-eni-700 hover:bg-eni-50 cursor-pointer"
                          aria-label="Modifier"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(v)}
                          className="p-1.5 rounded-md text-slate-600 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="p-5 space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span className="font-mono font-semibold text-eni-700 truncate">
                            {v.immatriculation || "Plaque N/A"}
                            {v.modele ? ` · ${v.modele}` : ""}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 font-semibold whitespace-nowrap shrink-0 ${v.validee ? "text-emerald-700" : "text-amber-700"
                              }`}
                          >
                            {v.validee ? (
                              <CheckCircle className="w-3.5 h-3.5" />
                            ) : (
                              <Clock className="w-3.5 h-3.5" />
                            )}
                            <span>{v.validee ? "Validée" : "En attente"}</span>
                          </span>
                        </div>

                        <h3 className="font-display text-lg font-bold text-slate-900">
                          Voiture N° {v.numero_voiture}
                        </h3>
                      </div>

                      <div className="text-sm text-slate-600 space-y-1.5 pt-1">
                        <p className="flex items-center justify-between gap-2">
                          <span className="text-slate-400">Chauffeur</span>
                          <span className="font-medium text-slate-800 truncate">
                            {v.chauffeur || "Non renseigné"}
                          </span>
                        </p>
                        <p className="flex items-center justify-between gap-2 tabular-nums">
                          <span className="text-slate-400 inline-flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            <span>Contact</span>
                          </span>
                          <span className="font-mono text-xs text-slate-700">
                            {v.telephone_chauffeur || "-"}
                          </span>
                        </p>
                        <p className="flex items-center justify-between gap-2">
                          <span className="text-slate-400 inline-flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Chef</span>
                          </span>
                          <span className="text-xs font-medium text-slate-800 truncate">
                            {v.chef_voiture_detail
                              ? `${v.chef_voiture_detail.nom} ${v.chef_voiture_detail.prenom}`
                              : "Non désigné"}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-3 border-t border-slate-100 space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-slate-500">Occupation</span>
                        <span className="font-mono text-slate-900 tabular-nums">
                          {occ} / {v.capacite} places
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-eni-600 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <Link
                        to="/admin/affectations"
                        className="font-medium text-eni-700 hover:text-eni-900 inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <span>Gérer passagers</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                      <Link
                        to={`/chef/${v.id}`}
                        className="font-medium text-slate-500 hover:text-slate-800 whitespace-nowrap"
                      >
                        Espace Chef
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Modifier Voiture N° ${editing.numero_voiture}` : "Nouvelle voiture"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {errorMessage && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Photo du véhicule</label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="relative w-full sm:w-44 aspect-[16/10] rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                {photoPreview ? (
                  <>
                    <img
                      src={photoPreview}
                      alt="Aperçu véhicule"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoFile(null);
                        setRemoveExistingPhoto(true);
                      }}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/70 text-white hover:bg-slate-900 cursor-pointer"
                      aria-label="Retirer la photo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-400">
                    <ImagePlus className="w-6 h-6 text-eni-700/60" />
                    <span className="text-[11px] font-medium">Aperçu photo</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setPhotoFile(file);
                    if (file) setRemoveExistingPhoto(false);
                  }}
                  className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-eni-50 file:text-eni-700 hover:file:bg-eni-100 cursor-pointer"
                />
                <p className="text-xs text-slate-500">
                  JPG, PNG ou WebP (max 4 Mo). Enregistrée directement en base de données.
                </p>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Numéro de voiture"
              type="number"
              min={1}
              value={form.numero_voiture}
              onChange={(e) => setForm({ ...form, numero_voiture: Number(e.target.value) })}
              required
            />
            <Input
              label="Capacité (places)"
              type="number"
              min={1}
              value={form.capacite}
              onChange={(e) => setForm({ ...form, capacite: Number(e.target.value) })}
              required
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Immatriculation"
              placeholder="ex: 4521 TAB"
              value={form.immatriculation}
              onChange={(e) => setForm({ ...form, immatriculation: e.target.value })}
            />
            <Input
              label="Modèle / Type de véhicule"
              placeholder="ex: Mercedes Sprinter"
              value={form.modele}
              onChange={(e) => setForm({ ...form, modele: e.target.value })}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Nom du chauffeur"
              value={form.chauffeur}
              onChange={(e) => setForm({ ...form, chauffeur: e.target.value })}
            />
            <Input
              label="Téléphone chauffeur"
              placeholder="ex: 034 12 001 01"
              value={form.telephone_chauffeur}
              onChange={(e) => setForm({ ...form, telephone_chauffeur: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer la voiture"
        message={`Confirmez-vous la suppression de la Voiture N° ${deleteTarget?.numero_voiture} ?`}
        loading={saving}
      />
    </Layout>
  );
};

export default VoituresPage;