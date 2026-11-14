import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { QrCode, Download, ArrowRight, Search } from "lucide-react";
import Layout from "../../components/Layout";
import Card from "../../components/ui/Card";
import Spinner from "../../components/ui/Spinner";
import EmptyState from "../../components/ui/EmptyState";
import axiosClient, { getPublicBackendUrl } from "../../api/axiosClient";
import type { Etudiant } from "../../types";

export const BadgesPage: React.FC = () => {
  const [etudiants, setEtudiants] = useState<Etudiant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    axiosClient
      .get<Etudiant[]>("/etudiants/")
      .then((res) => setEtudiants(res.data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = etudiants.filter(
    (e) =>
      e.nom.toLowerCase().includes(search.toLowerCase()) ||
      e.prenom.toLowerCase().includes(search.toLowerCase()) ||
      e.matricule.toLowerCase().includes(search.toLowerCase())
  );

  const backendUrl = getPublicBackendUrl();

  return (
    <Layout title="Badges & QR Codes">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm text-slate-600">
            Visualisez les badges 3D recto/verso ou téléchargez les PDF prêts à imprimer.
          </p>
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer par nom ou matricule..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-eni-600/20 focus:border-eni-600 min-h-[40px]"
            />
          </div>
        </div>

        {loading ? (
          <Spinner label="Chargement des badges..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<QrCode className="w-6 h-6" />}
            title="Aucun badge disponible"
            description="Ajoutez des étudiants pour générer automatiquement leurs jetons QR et badges PDF."
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((etu) => (
              <Card key={etu.id} className="flex flex-col justify-between gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-eni-700 font-semibold tabular-nums">
                      {etu.matricule} · {etu.parcours}
                    </p>
                    <h3 className="font-display text-base font-bold text-slate-900 truncate mt-0.5">
                      {etu.nom} {etu.prenom}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 tabular-nums">
                      {etu.voiture_numero ? `Voiture N° ${etu.voiture_numero}` : "Voiture non affectée"}
                    </p>
                  </div>
                  <img
                    src={`${backendUrl}/api/badges/${etu.qr_token}/qr/`}
                    alt={`QR ${etu.matricule}`}
                    className="w-16 h-16 rounded-lg border border-slate-200 bg-white p-1 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <Link
                    to={`/badge/${etu.qr_token}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <span>Voir badge</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <a
                    href={`${backendUrl}/api/badges/${etu.qr_token}/pdf/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-eni-700 hover:bg-eni-800 text-xs font-medium text-white transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Télécharger PDF</span>
                  </a>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default BadgesPage;
