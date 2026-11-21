import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, MapPin, Package, QrCode, ArrowRight } from "lucide-react";
import Layout from "../../components/Layout";
import Card from "../../components/ui/Card";
import Spinner from "../../components/ui/Spinner";
import axiosClient from "../../api/axiosClient";
import { formatIsoDateFr } from "../../utils/programmeDate";
import type { Etudiant, ProgrammeItem, Voiture, ParametresVoyage } from "../../types";

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [etudiants, setEtudiants] = useState<Etudiant[]>([]);
  const [programme, setProgramme] = useState<ProgrammeItem[]>([]);
  const [voitures, setVoitures] = useState<Voiture[]>([]);
  const [parametres, setParametres] = useState<ParametresVoyage | null>(null);

  useEffect(() => {
    Promise.all([
      axiosClient.get<Etudiant[]>("/etudiants/"),
      axiosClient.get<ProgrammeItem[]>("/programme/"),
      axiosClient.get<Voiture[]>("/voitures/liste/"),
      axiosClient.get<ParametresVoyage[]>("/core/parametres/"),
    ])
      .then(([etuRes, progRes, voiRes, paramRes]) => {
        setEtudiants(etuRes.data);
        setProgramme(progRes.data);
        setVoitures(voiRes.data);
        if (paramRes.data.length > 0) setParametres(paramRes.data[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Layout title="Tableau de bord">
        <Spinner size="lg" label="Chargement des indicateurs..." />
      </Layout>
    );
  }

  const totalPlaces = voitures.reduce((acc, v) => acc + v.capacite, 0);
  const affectes = etudiants.filter((e) => e.voiture_numero != null).length;

  const parcoursCounts = ["MDI", "ASR", "IG", "IA"].map((p) => ({
    parcours: p,
    count: etudiants.filter((e) => e.parcours === p).length,
  }));

  return (
    <Layout title="Tableau de bord">
      <div className="space-y-6">
        <div className="rounded-xl bg-gradient-to-r from-eni-800 to-eni-950 text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-gold-400">
              {parametres?.ecole || "ENI"} · Promotion {parametres?.annee_promotion || "2026"}
            </p>
            <h2 className="font-display text-2xl font-bold mt-1">
              Voyage d&apos;étude — {parametres?.destination || "TOLIARA"}
            </h2>
            <p className="text-sm text-eni-100 mt-1 tabular-nums">
              {parametres
                ? `Du ${formatIsoDateFr(parametres.date_debut)} au ${formatIsoDateFr(parametres.date_fin)}`
                : "7 jours"}
            </p>
          </div>
          <Link
            to="/admin/badges"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gold-400 hover:bg-gold-300 text-eni-950 font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
          >
            <QrCode className="w-4 h-4" />
            <span>Gérer les badges QR</span>
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Étudiants inscrits</span>
              <Users className="w-4 h-4 text-eni-700" />
            </div>
            <p className="font-display text-3xl font-bold text-slate-900 mt-2 tabular-nums">
              {etudiants.length}
            </p>
            <p className="text-xs text-slate-500 mt-1 tabular-nums">
              {affectes} affecté(s) en voiture
            </p>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Activités programme</span>
              <MapPin className="w-4 h-4 text-eni-700" />
            </div>
            <p className="font-display text-3xl font-bold text-slate-900 mt-2 tabular-nums">
              {programme.length}
            </p>
            <p className="text-xs text-slate-500 mt-1">Réparties sur 7 jours</p>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Voitures disponibles</span>
              <Package className="w-4 h-4 text-eni-700" />
            </div>
            <p className="font-display text-3xl font-bold text-slate-900 mt-2 tabular-nums">
              {voitures.length}
            </p>
            <p className="text-xs text-slate-500 mt-1 tabular-nums">
              Capacité totale : {totalPlaces} places
            </p>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Taux d&apos;affectation</span>
              <QrCode className="w-4 h-4 text-eni-700" />
            </div>
            <p className="font-display text-3xl font-bold text-slate-900 mt-2 tabular-nums">
              {etudiants.length > 0 ? Math.round((affectes / etudiants.length) * 100) : 0}%
            </p>
            <p className="text-xs text-slate-500 mt-1 tabular-nums">
              {etudiants.length - affectes} sans voiture
            </p>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Répartition par parcours
              </h3>
              <Link
                to="/admin/etudiants"
                className="text-xs font-medium text-eni-700 hover:underline inline-flex items-center gap-1"
              >
                <span>Voir liste</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {parcoursCounts.map((item) => (
                <div key={item.parcours} className="py-3 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">Parcours {item.parcours}</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {item.count} étudiant(s)
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Remplissage des voitures
              </h3>
              <Link
                to="/admin/voitures"
                className="text-xs font-medium text-eni-700 hover:underline inline-flex items-center gap-1"
              >
                <span>Gérer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="space-y-3">
              {voitures.map((v) => {
                const occ = v.places_occupees || 0;
                const pct = Math.min(100, Math.round((occ / v.capacite) * 100));
                return (
                  <div key={v.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800">
                        Voiture N° {v.numero_voiture} ({v.chauffeur || "Chauffeur non renseigné"})
                      </span>
                      <span className="font-mono text-xs text-slate-600 tabular-nums">
                        {occ}/{v.capacite}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-eni-600 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {voitures.length === 0 && (
                <p className="text-sm text-slate-500">Aucune voiture enregistrée.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;