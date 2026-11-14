import React, { useEffect, useState, useCallback } from "react";
import { Plus, Search, Pencil, Trash2, Users } from "lucide-react";
import Layout from "../../components/Layout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Spinner from "../../components/ui/Spinner";
import EmptyState from "../../components/ui/EmptyState";
import axiosClient from "../../api/axiosClient";
import type { Etudiant, ParcoursType } from "../../types";

const PARCOURS_OPTIONS: ParcoursType[] = ["MDI", "ASR", "IG", "IA"];

export const EtudiantsPage: React.FC = () => {
  const [etudiants, setEtudiants] = useState<Etudiant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [parcoursFilter, setParcoursFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Etudiant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Etudiant | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    matricule: "",
    nom: "",
    prenom: "",
    parcours: "IG" as ParcoursType,
    email: "",
    telephone: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const fetchEtudiants = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosClient.get<Etudiant[]>("/etudiants/", {
        params: {
          search: search || undefined,
          parcours: parcoursFilter || undefined,
        },
      });
      setEtudiants(data);
    } finally {
      setLoading(false);
    }
  }, [search, parcoursFilter]);

  useEffect(() => {
    fetchEtudiants();
  }, [fetchEtudiants]);

  const openCreate = () => {
    setEditing(null);
    setForm({ matricule: "", nom: "", prenom: "", parcours: "IG", email: "", telephone: "" });
    setPhotoFile(null);
    setModalOpen(true);
  };

  const openEdit = (etu: Etudiant) => {
    setEditing(etu);
    setForm({
      matricule: etu.matricule,
      nom: etu.nom,
      prenom: etu.prenom,
      parcours: etu.parcours,
      email: etu.email || "",
      telephone: etu.telephone || "",
    });
    setPhotoFile(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("matricule", form.matricule);
      fd.append("nom", form.nom);
      fd.append("prenom", form.prenom);
      fd.append("parcours", form.parcours);
      fd.append("email", form.email);
      fd.append("telephone", form.telephone);
      if (photoFile) {
        fd.append("photo", photoFile);
      }

      if (editing) {
        await axiosClient.patch(`/etudiants/${editing.id}/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await axiosClient.post("/etudiants/", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      setModalOpen(false);
      await fetchEtudiants();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await axiosClient.delete(`/etudiants/${deleteTarget.id}/`);
      setDeleteTarget(null);
      await fetchEtudiants();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="Gestion des étudiants">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher nom ou matricule..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-eni-600/20 focus:border-eni-600 min-h-[40px]"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
              <button
                type="button"
                onClick={() => setParcoursFilter("")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  parcoursFilter === "" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                }`}
              >
                Tous
              </button>
              {PARCOURS_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setParcoursFilter(p)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    parcoursFilter === p ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            <span>Ajouter un étudiant</span>
          </Button>
        </div>

        {loading ? (
          <Spinner label="Chargement des étudiants..." />
        ) : etudiants.length === 0 ? (
          <EmptyState
            icon={<Users className="w-6 h-6" />}
            title="Aucun étudiant trouvé"
            description="Ajoutez des étudiants participants au voyage d'étude pour générer leurs affectations et badges QR."
            action={<Button onClick={openCreate}>Ajouter le premier étudiant</Button>}
          />
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Étudiant</th>
                    <th className="py-3 px-4">Matricule</th>
                    <th className="py-3 px-4">Parcours</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Voiture</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {etudiants.map((etu) => (
                    <tr key={etu.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {etu.photo_url ? (
                            <img
                              src={etu.photo_url}
                              alt={`${etu.prenom} ${etu.nom}`}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-eni-100 text-eni-800 font-semibold text-xs flex items-center justify-center">
                              {etu.prenom?.[0]}
                              {etu.nom?.[0]}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-slate-900">
                              {etu.nom} {etu.prenom}
                            </p>
                            {etu.email && <p className="text-xs text-slate-500">{etu.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums">
                        {etu.matricule}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">{etu.parcours}</td>
                      <td className="py-3 px-4 text-slate-600 tabular-nums">
                        {etu.telephone || "-"}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums">
                        {etu.voiture_numero ? `Voiture N° ${etu.voiture_numero}` : "Non affecté"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(etu)}
                            className="p-2 rounded-lg text-slate-500 hover:text-eni-700 hover:bg-eni-50 transition-colors cursor-pointer"
                            aria-label="Modifier"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(etu)}
                            className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            aria-label="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Modifier l'étudiant" : "Nouvel étudiant"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Matricule"
              value={form.matricule}
              onChange={(e) => setForm({ ...form, matricule: e.target.value })}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Parcours</label>
              <select
                value={form.parcours}
                onChange={(e) => setForm({ ...form, parcours: e.target.value as ParcoursType })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm min-h-[40px] focus:outline-none focus:ring-2 focus:ring-eni-600/20 focus:border-eni-600"
              >
                {PARCOURS_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Nom"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              required
            />
            <Input
              label="Prénom"
              value={form.prenom}
              onChange={(e) => setForm({ ...form, prenom: e.target.value })}
              required
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label="Téléphone"
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Photo d&apos;identité</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              className="text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-eni-50 file:text-eni-700 hover:file:bg-eni-100"
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
        title="Supprimer l'étudiant"
        message={`Confirmez-vous la suppression de ${deleteTarget?.nom} ${deleteTarget?.prenom} ?`}
        loading={saving}
      />
    </Layout>
  );
};

export default EtudiantsPage;
