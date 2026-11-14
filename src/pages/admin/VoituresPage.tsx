import React, { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Package, RefreshCw } from "lucide-react";
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

export const VoituresPage: React.FC = () => {
  const [voitures, setVoitures] = useState<Voiture[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoLoading, setAutoLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Voiture | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Voiture | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    numero_voiture: 1,
    capacite: 26,
    immatriculation: "",
    chauffeur: "",
    telephone_chauffeur: "",
  });

  const fetchVoitures = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosClient.get<Voiture[]>("/voitures/liste/");
      setVoitures(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVoitures();
  }, [fetchVoitures]);

  const openCreate = () => {
    setEditing(null);
    const nextNum = voitures.length > 0 ? Math.max(...voitures.map((v) => v.numero_voiture)) + 1 : 1;
    setForm({
      numero_voiture: nextNum,
      capacite: 26,
      immatriculation: "",
      chauffeur: "",
      telephone_chauffeur: "",
    });
    setModalOpen(true);
  };

  const openEdit = (v: Voiture) => {
    setEditing(v);
    setForm({
      numero_voiture: v.numero_voiture,
      capacite: v.capacite,
      immatriculation: v.immatriculation || "",
      chauffeur: v.chauffeur || "",
      telephone_chauffeur: v.telephone_chauffeur || "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await axiosClient.patch(`/voitures/liste/${editing.id}/`, form);
      } else {
        await axiosClient.post("/voitures/liste/", form);
      }
      setModalOpen(false);
      await fetchVoitures();
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
    try {
      const { data } = await axiosClient.post<{ message: string }>("/voitures/liste/auto_affecter/");
      setStatusMessage(data.message);
      await fetchVoitures();
    } finally {
      setAutoLoading(false);
    }
  };

  return (
    <Layout title="Gestion des voitures">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm text-slate-600">
            Configurez la flotte de véhicules (capacité 26 par défaut) et répartissez automatiquement les étudiants.
          </p>
          <div className="flex flex-wrap items-center gap-3">
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

        {loading ? (
          <Spinner label="Chargement des voitures..." />
        ) : voitures.length === 0 ? (
          <EmptyState
            icon={<Package className="w-6 h-6" />}
            title="Aucune voiture enregistrée"
            description="Ajoutez les véhicules du convoi avant de lancer l'affectation."
            action={<Button onClick={openCreate}>Ajouter une voiture</Button>}
          />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {voitures.map((v) => {
              const occ = v.places_occupees || 0;
              const pct = Math.min(100, Math.round((occ / v.capacite) * 100));
              return (
                <Card key={v.id} className="flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-xs font-semibold text-eni-700">
                          {v.immatriculation || "Immatriculation N/A"}
                        </span>
                        <h3 className="font-display text-lg font-bold text-slate-900">
                          Voiture N° {v.numero_voiture}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(v)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-eni-700 hover:bg-eni-50 cursor-pointer"
                          aria-label="Modifier"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(v)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="text-sm text-slate-600 space-y-1">
                      <p>
                        <span className="text-slate-400">Chauffeur :</span>{" "}
                        {v.chauffeur || "Non renseigné"}
                      </p>
                      <p className="tabular-nums">
                        <span className="text-slate-400">Téléphone :</span>{" "}
                        {v.telephone_chauffeur || "-"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
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
              label="Capacité"
              type="number"
              min={1}
              value={form.capacite}
              onChange={(e) => setForm({ ...form, capacite: Number(e.target.value) })}
              required
            />
          </div>
          <Input
            label="Immatriculation"
            value={form.immatriculation}
            onChange={(e) => setForm({ ...form, immatriculation: e.target.value })}
          />
          <Input
            label="Chauffeur"
            value={form.chauffeur}
            onChange={(e) => setForm({ ...form, chauffeur: e.target.value })}
          />
          <Input
            label="Téléphone chauffeur"
            value={form.telephone_chauffeur}
            onChange={(e) => setForm({ ...form, telephone_chauffeur: e.target.value })}
          />

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
