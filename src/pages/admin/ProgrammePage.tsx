import React, { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";
import Layout from "../../components/Layout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Spinner from "../../components/ui/Spinner";
import EmptyState from "../../components/ui/EmptyState";
import axiosClient from "../../api/axiosClient";
import type { ProgrammeItem } from "../../types";

export const ProgrammePage: React.FC = () => {
  const [items, setItems] = useState<ProgrammeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProgrammeItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgrammeItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    jour: 1,
    periode: "MATIN" as "MATIN" | "MIDI",
    heure_debut: "08:00",
    heure_fin: "12:00",
    activite: "",
    lieu: "",
  });

  const fetchProgramme = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosClient.get<ProgrammeItem[]>("/programme/");
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProgramme();
  }, [fetchProgramme]);

  const openCreate = (jour = 1) => {
    setEditing(null);
    setForm({
      jour,
      periode: "MATIN",
      heure_debut: "08:00",
      heure_fin: "12:00",
      activite: "",
      lieu: "",
    });
    setModalOpen(true);
  };

  const openEdit = (item: ProgrammeItem) => {
    setEditing(item);
    setForm({
      jour: item.jour,
      periode: item.periode,
      heure_debut: item.heure_debut.slice(0, 5),
      heure_fin: item.heure_fin ? item.heure_fin.slice(0, 5) : "",
      activite: item.activite,
      lieu: item.lieu || "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        heure_fin: form.heure_fin || null,
      };
      if (editing) {
        await axiosClient.patch(`/programme/${editing.id}/`, payload);
      } else {
        await axiosClient.post("/programme/", payload);
      }
      setModalOpen(false);
      await fetchProgramme();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await axiosClient.delete(`/programme/${deleteTarget.id}/`);
      setDeleteTarget(null);
      await fetchProgramme();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="Programme des 7 jours">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm text-slate-600">
            Activités affichées directement au recto des badges étudiants (J-01 à J-07).
          </p>
          <Button onClick={() => openCreate(1)}>
            <Plus className="w-4 h-4" />
            <span>Ajouter une activité</span>
          </Button>
        </div>

        {loading ? (
          <Spinner label="Chargement du programme..." />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<MapPin className="w-6 h-6" />}
            title="Aucune activité planifiée"
            description="Ajoutez les visites d'entreprises et trajets pour chacun des 7 jours."
            action={<Button onClick={() => openCreate(1)}>Planifier J-01</Button>}
          />
        ) : (
          <div className="grid gap-4">
            {[1, 2, 3, 4, 5, 6, 7].map((jour) => {
              const dayItems = items.filter((p) => p.jour === jour);
              return (
                <Card key={jour} padding="none" className="overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-eni-800 tabular-nums">
                        J-0{jour}
                      </span>
                      <span className="text-xs text-slate-500">
                        {dayItems.length} activité(s)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreate(jour)}
                      className="text-xs font-medium text-eni-700 hover:text-eni-900 cursor-pointer"
                    >
                      + Ajouter sur J-0{jour}
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {dayItems.length > 0 ? (
                      dayItems.map((item) => (
                        <div
                          key={item.id}
                          className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                              <span className="text-eni-700 font-semibold">
                                {item.periode === "MATIN" ? "Matin" : "Midi"}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                {item.heure_debut.slice(0, 5)}
                                {item.heure_fin ? ` – ${item.heure_fin.slice(0, 5)}` : ""}
                              </span>
                              {item.lieu && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{item.lieu}</span>
                                </>
                              )}
                            </div>
                            <p className="text-sm font-medium text-slate-900">{item.activite}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="p-2 rounded-lg text-slate-500 hover:text-eni-700 hover:bg-eni-50 cursor-pointer"
                              aria-label="Modifier"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                              aria-label="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="px-5 py-4 text-xs text-slate-400">
                        Aucune activité enregistrée pour ce jour.
                      </p>
                    )}
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
        title={editing ? "Modifier l'activité" : "Nouvelle activité"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Jour</label>
              <select
                value={form.jour}
                onChange={(e) => setForm({ ...form, jour: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm min-h-[40px]"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                  <option key={j} value={j}>
                    Jour J-0{j}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Période</label>
              <select
                value={form.periode}
                onChange={(e) => setForm({ ...form, periode: e.target.value as "MATIN" | "MIDI" })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm min-h-[40px]"
              >
                <option value="MATIN">Matin</option>
                <option value="MIDI">Midi</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Heure début"
              type="time"
              value={form.heure_debut}
              onChange={(e) => setForm({ ...form, heure_debut: e.target.value })}
              required
            />
            <Input
              label="Heure fin"
              type="time"
              value={form.heure_fin}
              onChange={(e) => setForm({ ...form, heure_fin: e.target.value })}
            />
          </div>

          <Input
            label="Activité"
            value={form.activite}
            onChange={(e) => setForm({ ...form, activite: e.target.value })}
            required
          />

          <Input
            label="Lieu"
            value={form.lieu}
            onChange={(e) => setForm({ ...form, lieu: e.target.value })}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Enregistrer" : "Ajouter"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer l'activité"
        message={`Voulez-vous supprimer « ${deleteTarget?.activite} » ?`}
        loading={saving}
      />
    </Layout>
  );
};

export default ProgrammePage;
