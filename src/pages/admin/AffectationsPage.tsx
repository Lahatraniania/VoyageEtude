import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, CheckCircle, Star, Users, ArrowRight } from "lucide-react";
import Layout from "../../components/Layout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Spinner from "../../components/ui/Spinner";
import EmptyState from "../../components/ui/EmptyState";
import axiosClient from "../../api/axiosClient";
import type { Voiture, Etudiant, Affectation } from "../../types";

export const AffectationsPage: React.FC = () => {
  const [voitures, setVoitures] = useState<Voiture[]>([]);
  const [etudiants, setEtudiants] = useState<Etudiant[]>([]);
  const [affectations, setAffectations] = useState<Affectation[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [boardModalVoiture, setBoardModalVoiture] = useState<Voiture | null>(null);
  const [selectedEtudiant, setSelectedEtudiant] = useState<string>("");

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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const assignedIds = new Set(affectations.map((a) => a.etudiant));
  const unassignedEtudiants = etudiants.filter((e) => !assignedIds.has(e.id));

  const openBoardModal = (voiture: Voiture) => {
    setErrorMsg("");
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
    try {
      await axiosClient.post(`/voitures/liste/${boardModalVoiture.id}/embarquer/`, {
        etudiant: Number(selectedEtudiant),
      });
      setBoardModalVoiture(null);
      setSelectedEtudiant("");
      setSuccessMsg("Étudiant embarqué dans la voiture.");
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
    try {
      await axiosClient.delete(`/voitures/affectations/${affectationId}/`);
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

  return (
    <Layout title="Affectations & Validation des voitures">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm text-slate-600 tabular-nums">
            <span className="font-semibold text-slate-900">{unassignedEtudiants.length}</span>{" "}
            étudiant(s) disponible(s) (non affectés). Chaque chef de voiture compose son équipage avant validation admin.
          </p>
        </div>

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
        ) : voitures.length === 0 ? (
          <EmptyState
            icon={<CheckCircle className="w-6 h-6" />}
            title="Aucune voiture configurée"
            description="Créez des voitures dans la section Voitures pour organiser les affectations."
          />
        ) : (
          <div className="grid gap-6">
            {voitures.map((v) => {
              const carAffectations = affectations.filter((a) => a.voiture === v.id);
              const isFull = carAffectations.length >= v.capacite;

              return (
                <Card key={v.id} padding="none" className="overflow-hidden">
                  <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="font-display text-base font-bold text-slate-900">
                          Voiture N° {v.numero_voiture}
                        </h3>
                        <span className="font-mono text-xs font-semibold text-eni-800 bg-eni-50 border border-eni-200 px-2.5 py-0.5 rounded-md tabular-nums">
                          {carAffectations.length} / {v.capacite} places
                        </span>
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-md border ${v.validee
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                            }`}
                        >
                          {v.validee ? "Validée" : "En attente de validation"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>
                          Chauffeur : {v.chauffeur || "Non renseigné"} · {v.immatriculation || "-"}
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

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Link
                        to={`/chef/${v.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
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

                  {carAffectations.length === 0 ? (
                    <p className="px-5 py-4 text-xs text-slate-400">
                      Aucun étudiant dans cette voiture pour le moment.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {carAffectations.map((aff) => {
                        const isChef = v.chef_voiture === aff.etudiant;
                        return (
                          <div
                            key={aff.id}
                            className="px-5 py-3 flex items-center justify-between gap-4 text-sm"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="font-mono text-xs text-slate-500 tabular-nums shrink-0">
                                {aff.etudiant_detail?.matricule}
                              </span>
                              <span className="font-medium text-slate-900 truncate">
                                {aff.etudiant_detail?.nom} {aff.etudiant_detail?.prenom}
                              </span>
                              <span className="text-xs text-slate-500 shrink-0">
                                {aff.etudiant_detail?.parcours}
                              </span>
                              {isChef && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-eni-900 bg-gold-300/60 px-2 py-0.5 rounded-md shrink-0">
                                  <Star className="w-3 h-3" />
                                  Chef de voiture
                                </span>
                              )}
                            </div>
                            {!v.validee && (
                              <button
                                type="button"
                                onClick={() => handleRemove(aff.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                aria-label="Retirer de la voiture"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Étudiant disponible (non encore affecté)
              </label>
              <select
                value={selectedEtudiant}
                onChange={(e) => setSelectedEtudiant(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm min-h-[40px]"
              >
                <option value="">Sélectionner un étudiant non affecté</option>
                {unassignedEtudiants.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.matricule} — {e.nom} {e.prenom} ({e.parcours})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setBoardModalVoiture(null)}>
              Annuler
            </Button>
            {unassignedEtudiants.length > 0 && (
              <Button type="submit" loading={saving}>
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
                    affectations.some((a) => a.etudiant === e.id && a.voiture === chefModalVoiture?.id)
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