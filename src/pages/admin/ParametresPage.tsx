import React, { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";
import axiosClient from "../../api/axiosClient";
import type { ParametresVoyage } from "../../types";

export const ParametresPage: React.FC = () => {
  const [paramId, setParamId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const [form, setForm] = useState({
    date_debut: "",
    date_fin: "",
    destination: "TOLIARA",
    ecole: "ENI",
    annee_promotion: "",
    nom_responsable: "",
    tel_responsable: "",
    nom_responsable_sante: "",
    tel_responsable_sante: "",
  });

  useEffect(() => {
    axiosClient
      .get<ParametresVoyage[]>("/core/parametres/")
      .then((res) => {
        if (res.data.length > 0) {
          const p = res.data[0];
          setParamId(p.id);
          setForm({
            date_debut: p.date_debut,
            date_fin: p.date_fin,
            destination: p.destination,
            ecole: p.ecole,
            annee_promotion: p.annee_promotion || "",
            nom_responsable: p.nom_responsable || "",
            tel_responsable: p.tel_responsable || "",
            nom_responsable_sante: p.nom_responsable_sante || "",
            tel_responsable_sante: p.tel_responsable_sante || "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg("");
    try {
      if (paramId) {
        await axiosClient.put(`/core/parametres/${paramId}/`, form);
      } else {
        const { data } = await axiosClient.post<ParametresVoyage>("/core/parametres/", form);
        setParamId(data.id);
      }
      setSavedMsg("Paramètres du voyage enregistrés avec succès.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Paramètres du voyage">
        <Spinner label="Chargement des paramètres..." />
      </Layout>
    );
  }

  return (
    <Layout title="Paramètres du voyage">
      <div className="max-w-3xl">
        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Informations générales &amp; contacts d&apos;urgence
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Ces informations apparaissent sur le recto et le verso de chaque badge étudiant.
              </p>
            </div>

            {savedMsg && (
              <div className="rounded-lg bg-eni-50 border border-eni-200 px-4 py-3 text-sm text-eni-900">
                {savedMsg}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="École"
                value={form.ecole}
                onChange={(e) => setForm({ ...form, ecole: e.target.value })}
                required
              />
              <Input
                label="Destination"
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                required
              />
              <Input
                label="Date de début"
                type="date"
                value={form.date_debut}
                onChange={(e) => setForm({ ...form, date_debut: e.target.value })}
                required
              />
              <Input
                label="Date de fin"
                type="date"
                value={form.date_fin}
                onChange={(e) => setForm({ ...form, date_fin: e.target.value })}
                required
              />
              <Input
                label="Année / Promotion"
                value={form.annee_promotion}
                onChange={(e) => setForm({ ...form, annee_promotion: e.target.value })}
              />
            </div>

            <div className="pt-4 border-t border-slate-200 grid sm:grid-cols-2 gap-4">
              <Input
                label="Nom du responsable voyage"
                value={form.nom_responsable}
                onChange={(e) => setForm({ ...form, nom_responsable: e.target.value })}
              />
              <Input
                label="Téléphone responsable voyage"
                value={form.tel_responsable}
                onChange={(e) => setForm({ ...form, tel_responsable: e.target.value })}
              />
              <Input
                label="Nom responsable santé"
                value={form.nom_responsable_sante}
                onChange={(e) => setForm({ ...form, nom_responsable_sante: e.target.value })}
              />
              <Input
                label="Téléphone responsable santé"
                value={form.tel_responsable_sante}
                onChange={(e) => setForm({ ...form, tel_responsable_sante: e.target.value })}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" loading={saving}>
                Enregistrer les paramètres
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </Layout>
  );
};

export default ParametresPage;
