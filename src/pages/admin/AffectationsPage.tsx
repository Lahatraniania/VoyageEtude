import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Trash2,
  CheckCircle,
  Clock,
  Star,
  Users,
  ArrowRight,
  Search,
  Car,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Layout from "../../components/Layout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Spinner from "../../components/ui/Spinner";
import EmptyState from "../../components/ui/EmptyState";
import axiosClient from "../../api/axiosClient";
import type { Voiture, Etudiant, Affectation } from "../../types";

type StatusFilter = "all" | "pending" | "validated";

export const AffectationsPage: React.FC = () => {
  const [voitures, setVoitures] = useState<Voiture[]>([]);
  const [etudiants, setEtudiants] = useState<Etudiant[]>([]);
  const [affectations, setAffectations] = useState<Affectation[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoLoading, setAutoLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showUnassignedList, setShowUnassignedList] = useState(false);
  const [copiedChefId, setCopiedChefId] = useState<number | null>(null);
  const [brokenCarImages, setBrokenCarImages] = useState<Record<number, boolean>>({});

  // Modal Faire monter
  const [boardModalVoiture, setBoardModalVoiture] = useState<Voiture | null>(null);
  const [boardSearch, setBoardSearch] = useState("");
  const [selectedEtudiant, setSelectedEtudiant] = useState<string>("");

  // Modal Désigner chef
  const [chefModalVoiture, setChefModalVoiture] = useState<Voiture | null>(null);
  const [selectedChef, setSelectedChef] = useState<string>("");

  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, eRes, aRes] = await Promise.all([
        axiosClient.get<Voiture[]>("/voitures/liste/"),
        axiosClient.get<Etudiant[]>("/etudiants/"),
        axiosClient.get<Affectation[]>("/voitures/affectations/"),
      ]);
      setVoitures(vRes.data);
      setEtudiants(eRes.data);
      setAffectations(aRes.data);
      setBrokenCarImages({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const assignedIds = useMemo(
    () => new Set(affectations.map((a) => a.etudiant)),
    [affectations]
  );

  const unassignedEtudiants = useMemo(
    () => etudiants.filter((e) => !assignedIds.has(e.id)),
    [etudiants, assignedIds]
  );

  const stats = useMemo(() => {
    const totalCapacite = voitures.reduce((acc, v) => acc + v.capacite, 0);
    const totalAffectes = assignedIds.size;
    const voituresValidees = voitures.filter((v) => v.validee).length;
    const placesLibres = Math.max(0, totalCapacite - totalAffectes);
    return { totalCapacite, totalAffectes, voituresValidees, placesLibres };
  }, [voitures, assignedIds]);

  const filteredVoitures = useMemo(() => {
    const q = search.trim().toLowerCase();
    return voitures.filter((v) => {
      if (statusFilter === "pending" && v.validee) return false;
      if (statusFilter === "validated" && !v.validee) return false;
      if (!q) return true;

      const matchesCar =
        String(v.numero_voiture).includes(q) ||
        (v.immatriculation || "").toLowerCase().includes(q) ||
        (v.modele || "").toLowerCase().includes(q) ||
        (v.chauffeur || "").toLowerCase().includes(q) ||
        (v.chef_voiture_detail &&
          `${v.chef_voiture_detail.nom} ${v.chef_voiture_detail.prenom} ${v.chef_voiture_detail.matricule}`
            .toLowerCase()
            .includes(q));

      if (matchesCar) return true;

      return affectations.some(
        (a) =>
          a.voiture === v.id &&
          a.etudiant_detail &&
          `${a.etudiant_detail.nom} ${a.etudiant_detail.prenom} ${a.etudiant_detail.matricule} ${a.etudiant_detail.parcours}`
            .toLowerCase()
            .includes(q)
      );
    });
  }, [voitures, affectations, search, statusFilter]);

  const modalUnassignedFiltered = useMemo(() => {
    const q = boardSearch.trim().toLowerCase();
    if (!q) return unassignedEtudiants;
    return unassignedEtudiants.filter((e) =>
      `${e.matricule} ${e.nom} ${e.prenom} ${e.parcours}`.toLowerCase().includes(q)
    );
  }, [unassignedEtudiants, boardSearch]);

  const openBoardModal = (voiture: Voiture) => {
    setErrorMsg("");
    setBoardSearch("");
    setBoardModalVoiture(voiture);
    setSelectedEtudiant(unassignedEtudiants[0]?.id ? String(unassignedEtudiants[0].id) : "");
  };

  const openChefModal = (voiture: Voiture) => {
    setErrorMsg("");
    setChefModalVoiture(voiture);
    setSelectedChef(voiture.chef_voiture ? String(voiture.chef_voiture) : "");
  };

  const handleBoardStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardModalVoiture || !selectedEtudiant) return;
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await axiosClient.post(`/voitures/liste/${boardModalVoiture.id}/embarquer/`, {
        etudiant: Number(selectedEtudiant),
      });
      setBoardModalVoiture(null);
      setSelectedEtudiant("");
      setSuccessMsg(`Étudiant embarqué dans la Voiture N° ${boardModalVoiture.numero_voiture}.`);
      await fetchAll();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErrorMsg(detail || "Impossible d'ajouter cet étudiant.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (affectationId: number) => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await axiosClient.delete(`/voitures/affectations/${affectationId}/`);
      setSuccessMsg("Étudiant retiré de la voiture.");
      await fetchAll();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErrorMsg(detail || "Action impossible.");
    }
  };

  const handleDesignateChef = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chefModalVoiture || !selectedChef) return;
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await axiosClient.post(`/voitures/liste/${chefModalVoiture.id}/designer_chef/`, {
        etudiant: Number(selectedChef),
      });
      setChefModalVoiture(null);
      setSuccessMsg(`Chef de la Voiture N° ${chefModalVoiture.numero_voiture} mis à jour.`);
      await fetchAll();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErrorMsg(detail || "Impossible de désigner ce chef de voiture.");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickSetChef = async (voiture: Voiture, etudiantId: number) => {
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await axiosClient.post(`/voitures/liste/${voiture.id}/designer_chef/`, {
        etudiant: etudiantId,
      });
      setSuccessMsg(`Chef de la Voiture N° ${voiture.numero_voiture} désigné.`);
      await fetchAll();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErrorMsg(detail || "Impossible de désigner ce chef de voiture.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleValidation = async (voiture: Voiture) => {
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const nextVal = !voiture.validee;
      const { data } = await axiosClient.post<{ detail: string }>(
        `/voitures/liste/${voiture.id}/valider/`,
        { validee: nextVal }
      );
      setSuccessMsg(data.detail);
      await fetchAll();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErrorMsg(detail || "Erreur lors de la validation.");
    } finally {
      setSaving(false);
    }
  };

  const handleAutoAffecter = async () => {
    setAutoLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const { data } = await axiosClient.post<{ message: string }>("/voitures/liste/auto_affecter/");
      setSuccessMsg(data.message);
      await fetchAll();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErrorMsg(detail || "Erreur lors de l'auto-affectation.");
    } finally {
      setAutoLoading(false);
    }
  };

  const handleCopyChefLink = async (voitureId: number) => {
    const url = `${window.location.origin}/chef/${voitureId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedChefId(voitureId);
      setTimeout(() => setCopiedChefId((curr) => (curr === voitureId ? null : curr)), 2000);
    } catch {
      // Clipboard indisponible
    }
  };

  return (
    <Layout title="Affectations & Validation des voitures">
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <span className="text-xs font-medium text-slate-500">Étudiants affectés</span>
            <p className="font-display text-2xl font-bold text-eni-700 mt-1 tabular-nums">
              {stats.totalAffectes} / {etudiants.length}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {etudiants.length > 0 ? Math.round((stats.totalAffectes / etudiants.length) * 100) : 0}% placés
            </p>
          </Card>
          <Card>
            <span className="text-xs font-medium text-slate-500">Non affectés</span>
            <p className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {unassignedEtudiants.length}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">en attente de voiture</p>
          </Card>
          <Card>
            <span className="text-xs font-medium text-slate-500">Places restantes</span>
            <p className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {stats.placesLibres}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              sur {stats.totalCapacite} places totales
            </p>
          </Card>
          <Card>
            <span className="text-xs font-medium text-slate-500">Voitures validées</span>
            <p className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {stats.voituresValidees} / {voitures.length}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">listes verrouillées</p>
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
                placeholder="Chercher voiture, matricule ou étudiant..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-eni-600/20 focus:border-eni-600 min-h-[40px]"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
              {(
                [
                  { id: "all", label: "Toutes" },
                  { id: "pending", label: "En attente" },
                  { id: "validated", label: "Validées" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${statusFilter === tab.id
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
            {unassignedEtudiants.length > 0 && (
              <button
                type="button"
                onClick={() => setShowUnassignedList((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
              >
                <Users className="w-4 h-4 text-eni-700" />
                <span>{unassignedEtudiants.length} non affecté(s)</span>
                {showUnassignedList ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            <Button
              variant="gold"
              onClick={handleAutoAffecter}
              loading={autoLoading}
              disabled={unassignedEtudiants.length === 0 || voitures.length === 0}
            >
              <RefreshCw className="w-4 h-4" />
              <span>Auto-affecter les restants</span>
            </Button>
          </div>
        </div>

        {showUnassignedList && unassignedEtudiants.length > 0 && (
          <Card>
            <div className="flex items-center justify-between gap-4 mb-3">
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Étudiants en attente d&apos;affectation ({unassignedEtudiants.length})
              </h2>
              <span className="text-xs text-slate-500">
                Utilisez &laquo; Faire monter &raquo; sur une voiture ou &laquo; Auto-affecter &raquo;.
              </span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
              {unassignedEtudiants.map((e) => (
                <div
                  key={e.id}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {e.nom} {e.prenom}
                    </p>
                    <p className="font-mono text-slate-500 tabular-nums">
                      {e.matricule} · {e.parcours}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {errorMsg && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="rounded-lg bg-eni-50 border border-eni-200 px-4 py-3 text-sm text-eni-900">
            {successMsg}
          </div>
        )}

        {loading ? (
          <Spinner label="Chargement des affectations..." />
        ) : filteredVoitures.length === 0 ? (
          <EmptyState
            icon={<CheckCircle className="w-6 h-6" />}
            title={voitures.length === 0 ? "Aucune voiture configurée" : "Aucun résultat"}
            description={
              voitures.length === 0
                ? "Créez des voitures dans la section Voitures pour organiser les affectations."
                : "Aucune voiture ou étudiant ne correspond à votre recherche."
            }
            action={
              voitures.length === 0 ? (
                <Link to="/admin/voitures">
                  <Button>Aller à Voitures</Button>
                </Link>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                  }}
                >
                  Réinitialiser les filtres
                </Button>
              )
            }
          />
        ) : (
          <div className="grid gap-6">
            {filteredVoitures.map((v) => {
              const carAffectations = affectations.filter((a) => a.voiture === v.id);
              const isFull = carAffectations.length >= v.capacite;
              const pct = Math.min(100, Math.round((carAffectations.length / Math.max(1, v.capacite)) * 100));
              const hasCarPhoto = Boolean(v.photo_url && !brokenCarImages[v.id]);

              return (
                <Card key={v.id} padding="none" className="overflow-hidden">
                  <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start sm:items-center gap-4 min-w-0">
                        {hasCarPhoto ? (
                          <img
                            src={v.photo_url!}
                            alt={`Voiture N° ${v.numero_voiture}`}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setBrokenCarImages((prev) => ({ ...prev, [v.id]: true }))
                            }
                            className="w-20 h-14 rounded-lg object-cover border border-slate-200 shrink-0 hidden sm:block"
                          />
                        ) : (
                          <div className="w-20 h-14 rounded-lg bg-eni-50 border border-eni-200 hidden sm:flex items-center justify-center text-eni-700 shrink-0">
                            <Car className="w-6 h-6" />
                          </div>
                        )}

                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h3 className="font-display text-base font-bold text-slate-900">
                              Voiture N° {v.numero_voiture}
                            </h3>
                            <span className="font-mono text-xs font-semibold text-eni-800 tabular-nums">
                              {carAffectations.length} / {v.capacite} places
                            </span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-semibold ${v.validee ? "text-emerald-700" : "text-amber-700"
                                }`}
                            >
                              {v.validee ? (
                                <CheckCircle className="w-3.5 h-3.5" />
                              ) : (
                                <Clock className="w-3.5 h-3.5" />
                              )}
                              <span>{v.validee ? "Validée" : "En attente de validation"}</span>
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span>
                              Chauffeur : {v.chauffeur || "Non renseigné"} · {v.immatriculation || "-"}
                              {v.modele ? ` · ${v.modele}` : ""}
                            </span>
                            <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                              <Star className="w-3.5 h-3.5 text-gold-500" />
                              Chef de voiture :{" "}
                              {v.chef_voiture_detail
                                ? `${v.chef_voiture_detail.nom} ${v.chef_voiture_detail.prenom} (${v.chef_voiture_detail.matricule})`
                                : "Non désigné"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyChefLink(v.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                          title="Copier le lien public à envoyer au chef de voiture"
                        >
                          {copiedChefId === v.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-eni-700" />
                              <span className="text-eni-700">Lien copié</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Lien Chef</span>
                            </>
                          )}
                        </button>

                        <Link
                          to={`/chef/${v.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Espace Chef</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>

                        {!v.validee && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openChefModal(v)}
                              disabled={carAffectations.length === 0 && unassignedEtudiants.length === 0}
                            >
                              <Star className="w-3.5 h-3.5" />
                              <span>Désigner chef</span>
                            </Button>

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openBoardModal(v)}
                              disabled={isFull || unassignedEtudiants.length === 0}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Faire monter</span>
                            </Button>
                          </>
                        )}

                        <Button
                          variant={v.validee ? "secondary" : "primary"}
                          size="sm"
                          onClick={() => handleToggleValidation(v)}
                          disabled={saving || (!v.validee && carAffectations.length === 0)}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{v.validee ? "Rouvrir" : "Valider la voiture"}</span>
                        </Button>
                      </div>
                    </div>

                    <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-eni-600 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {carAffectations.length === 0 ? (
                    <p className="px-5 py-5 text-xs text-slate-400">
                      Aucun étudiant dans cette voiture pour le moment.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {carAffectations.map((aff, index) => {
                        const isChef = v.chef_voiture === aff.etudiant;
                        const etu = aff.etudiant_detail;
                        return (
                          <div
                            key={aff.id}
                            className="px-5 py-3 flex items-center justify-between gap-4 text-sm hover:bg-slate-50/70 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="font-mono text-xs text-slate-400 tabular-nums w-5 shrink-0">
                                {String(index + 1).padStart(2, "0")}
                              </span>

                              {etu?.photo_url ? (
                                <img
                                  src={etu.photo_url}
                                  alt={`${etu.prenom} ${etu.nom}`}
                                  referrerPolicy="no-referrer"
                                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-eni-100 text-eni-800 text-[11px] font-semibold flex items-center justify-center shrink-0">
                                  {etu?.prenom?.[0]}
                                  {etu?.nom?.[0]}
                                </div>
                              )}

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <span className="font-medium text-slate-900 truncate">
                                    {etu?.nom} {etu?.prenom}
                                  </span>
                                  {isChef && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-eni-900 bg-gold-300/60 px-2 py-0.5 rounded-md shrink-0">
                                      <Star className="w-3 h-3" />
                                      Chef de voiture
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 font-mono tabular-nums">
                                  {etu?.matricule} · {etu?.parcours}
                                  {etu?.telephone ? ` · ${etu.telephone}` : ""}
                                </p>
                              </div>
                            </div>

                            {!v.validee && (
                              <div className="flex items-center gap-1 shrink-0">
                                {!isChef && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickSetChef(v, aff.etudiant)}
                                    disabled={saving}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-eni-800 hover:bg-eni-50 transition-colors cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                                    title="Nommer chef de cette voiture"
                                  >
                                    <Star className="w-3.5 h-3.5 text-gold-500" />
                                    <span className="hidden sm:inline">Nommer chef</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemove(aff.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                  aria-label="Retirer de la voiture"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={Boolean(boardModalVoiture)}
        onClose={() => setBoardModalVoiture(null)}
        title={`Faire monter dans Voiture N° ${boardModalVoiture?.numero_voiture || ""}`}
      >
        <form onSubmit={handleBoardStudent} className="space-y-4">
          {unassignedEtudiants.length === 0 ? (
            <p className="text-sm text-slate-600">
              Tous les étudiants sont déjà affectés à une voiture.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={boardSearch}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBoardSearch(val);
                    const q = val.trim().toLowerCase();
                    const firstMatch = unassignedEtudiants.find((etu) =>
                      `${etu.matricule} ${etu.nom} ${etu.prenom} ${etu.parcours}`
                        .toLowerCase()
                        .includes(q)
                    );
                    setSelectedEtudiant(firstMatch ? String(firstMatch.id) : "");
                  }}
                  placeholder="Filtrer par nom, matricule ou parcours..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-eni-600/20 focus:border-eni-600 min-h-[40px]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Étudiant disponible ({modalUnassignedFiltered.length})
                </label>
                <select
                  value={selectedEtudiant}
                  onChange={(e) => setSelectedEtudiant(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm min-h-[40px]"
                >
                  <option value="">Sélectionner un étudiant non affecté</option>
                  {modalUnassignedFiltered.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.matricule} — {e.nom} {e.prenom} ({e.parcours})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setBoardModalVoiture(null)}>
              Annuler
            </Button>
            {unassignedEtudiants.length > 0 && (
              <Button type="submit" loading={saving} disabled={!selectedEtudiant}>
                Ajouter à la voiture
              </Button>
            )}
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(chefModalVoiture)}
        onClose={() => setChefModalVoiture(null)}
        title={`Désigner le Chef — Voiture N° ${chefModalVoiture?.numero_voiture || ""}`}
      >
        <form onSubmit={handleDesignateChef} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Étudiant responsable (Chef de voiture)
            </label>
            <select
              value={selectedChef}
              onChange={(e) => setSelectedChef(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm min-h-[40px]"
            >
              <option value="">Sélectionner le chef de voiture</option>
              {etudiants
                .filter(
                  (e) =>
                    !assignedIds.has(e.id) ||
                    affectations.some(
                      (a) => a.etudiant === e.id && a.voiture === chefModalVoiture?.id
                    )
                )
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.matricule} — {e.nom} {e.prenom} ({e.parcours})
                  </option>
                ))}
            </select>
            <p className="text-xs text-slate-500">
              Seuls les passagers de cette voiture et les étudiants non affectés peuvent être choisis.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setChefModalVoiture(null)}>
              Annuler
            </Button>
            <Button type="submit" loading={saving}>
              Confirmer le chef
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};

export default AffectationsPage;