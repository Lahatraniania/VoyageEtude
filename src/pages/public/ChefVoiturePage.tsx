import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Star, CheckCircle } from "lucide-react";
import axiosClient from "../../api/axiosClient";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";
import type { Voiture, Etudiant, Affectation } from "../../types";

export const ChefVoiturePage: React.FC = () => {
    const { voitureId } = useParams<{ voitureId: string }>();
    const [voiture, setVoiture] = useState<Voiture | null>(null);
    const [etudiants, setEtudiants] = useState<Etudiant[]>([]);
    const [affectations, setAffectations] = useState<Affectation[]>([]);
    const [selectedEtudiant, setSelectedEtudiant] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [vRes, eRes, aRes] = await Promise.all([
                axiosClient.get<Voiture[]>("/voitures/liste/"),
                axiosClient.get<Etudiant[]>("/etudiants/"),
                axiosClient.get<Affectation[]>("/voitures/affectations/"),
            ]);
            const found = vRes.data.find((v) => String(v.id) === String(voitureId)) || null;
            setVoiture(found);
            setEtudiants(eRes.data);
            setAffectations(aRes.data);
        } finally {
            setLoading(false);
        }
    }, [voitureId]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const assignedIds = new Set(affectations.map((a) => a.etudiant));
    const unassignedEtudiants = etudiants.filter((e) => !assignedIds.has(e.id));
    const carAffectations = voiture ? affectations.filter((a) => a.voiture === voiture.id) : [];
    const isFull = voiture ? carAffectations.length >= voiture.capacite : false;

    const handleBoard = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!voiture || !selectedEtudiant) return;
        setSaving(true);
        setError("");
        try {
            await axiosClient.post(`/voitures/liste/${voiture.id}/embarquer/`, {
                etudiant: Number(selectedEtudiant),
            });
            setSelectedEtudiant("");
            await fetchAll();
        } catch (err: unknown) {
            const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
            setError(detail || "Erreur lors de l'ajout.");
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async (affId: number) => {
        setError("");
        try {
            await axiosClient.delete(`/voitures/affectations/${affId}/`);
            await fetchAll();
        } catch (err: unknown) {
            const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
            setError(detail || "Action impossible.");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Spinner size="lg" label="Chargement de la voiture..." />
            </div>
        );
    }

    if (!voiture) {
        return (
            <div className="min-h-screen bg-slate-50 py-12 px-4 text-center space-y-4">
                <p className="text-slate-700 font-medium">Voiture introuvable.</p>
                <Link to="/admin/affectations" className="text-sm text-eni-700 hover:underline">
                    Retour aux affectations
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-8 px-4">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <Link
                        to="/admin/affectations"
                        className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-eni-800"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Retour</span>
                    </Link>
                    <span className="text-xs font-medium text-eni-700">Espace Chef de Voiture</span>
                </div>

                <Card>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                        <div>
                            <h1 className="font-display text-2xl font-bold text-slate-900">
                                Voiture N° {voiture.numero_voiture}
                            </h1>
                            <p className="text-sm text-slate-600 mt-1 inline-flex items-center gap-1.5">
                                <Star className="w-4 h-4 text-gold-500" />
                                <span>
                                    Chef de voiture :{" "}
                                    <strong>
                                        {voiture.chef_voiture_detail
                                            ? `${voiture.chef_voiture_detail.nom} ${voiture.chef_voiture_detail.prenom}`
                                            : "Sera désigné au premier embarquement / validation"}
                                    </strong>
                                </span>
                            </p>
                        </div>
                        <div className="text-right space-y-1">
                            <div className="font-mono text-sm font-bold text-eni-800 tabular-nums">
                                {carAffectations.length} / {voiture.capacite} places
                            </div>
                            <div
                                className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-md border ${voiture.validee
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : "bg-amber-50 text-amber-800 border-amber-200"
                                    }`}
                            >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>{voiture.validee ? "Validée par l'admin" : "En attente de validation admin"}</span>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {!voiture.validee && (
                        <form onSubmit={handleBoard} className="mt-5 flex flex-col sm:flex-row gap-3">
                            <select
                                value={selectedEtudiant}
                                onChange={(e) => setSelectedEtudiant(e.target.value)}
                                disabled={isFull || unassignedEtudiants.length === 0}
                                required
                                className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm min-h-[40px]"
                            >
                                <option value="">
                                    {isFull
                                        ? "Voiture complète"
                                        : unassignedEtudiants.length === 0
                                            ? "Aucun étudiant disponible"
                                            : "Choisir un camarade (non encore affecté)..."}
                                </option>
                                {unassignedEtudiants.map((e) => (
                                    <option key={e.id} value={e.id}>
                                        {e.matricule} — {e.nom} {e.prenom} ({e.parcours})
                                    </option>
                                ))}
                            </select>
                            <Button
                                type="submit"
                                loading={saving}
                                disabled={isFull || unassignedEtudiants.length === 0 || !selectedEtudiant}
                            >
                                <Plus className="w-4 h-4" />
                                <span>Faire monter</span>
                            </Button>
                        </form>
                    )}

                    <div className="mt-6 divide-y divide-slate-100 border-t border-slate-200">
                        {carAffectations.length === 0 ? (
                            <p className="py-6 text-sm text-slate-400 text-center">
                                Aucun camarade embarqué pour le moment.
                            </p>
                        ) : (
                            carAffectations.map((aff) => {
                                const isChef = voiture.chef_voiture === aff.etudiant;
                                return (
                                    <div key={aff.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="font-mono text-xs text-slate-500 tabular-nums">
                                                {aff.etudiant_detail?.matricule}
                                            </span>
                                            <span className="font-medium text-slate-900 truncate">
                                                {aff.etudiant_detail?.nom} {aff.etudiant_detail?.prenom}
                                            </span>
                                            <span className="text-xs text-slate-500">{aff.etudiant_detail?.parcours}</span>
                                            {isChef && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-eni-900 bg-gold-300/60 px-2 py-0.5 rounded-md">
                                                    <Star className="w-3 h-3" />
                                                    Chef de voiture
                                                </span>
                                            )}
                                        </div>
                                        {!voiture.validee && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemove(aff.id)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                                                aria-label="Retirer"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default ChefVoiturePage;