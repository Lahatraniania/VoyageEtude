import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, QrCode } from "lucide-react";
import axiosClient, { getPublicBackendUrl } from "../../api/axiosClient";
import BadgeTemplate from "../../components/BadgeTemplate";
import Spinner from "../../components/ui/Spinner";
import type { BadgeInfoResponse } from "../../types";

export const BadgePage: React.FC = () => {
  const { qrToken } = useParams<{ qrToken: string }>();
  const [data, setData] = useState<BadgeInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!qrToken) return;
    setLoading(true);
    setError("");
    axiosClient
      .get<BadgeInfoResponse>(`/badges/${qrToken}/info/`)
      .then((res) => setData(res.data))
      .catch(() => setError("Ce badge est introuvable ou le jeton QR est invalide."))
      .finally(() => setLoading(false));
  }, [qrToken]);

  const pdfUrl = `${getPublicBackendUrl()}/api/badges/${qrToken}/pdf/`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200/70 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-eni-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Accueil</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/scan"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <QrCode className="w-4 h-4" />
              <span>Scanner</span>
            </Link>
            {data && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-eni-700 hover:bg-eni-800 text-white text-xs font-semibold transition-colors shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger PDF</span>
              </a>
            )}
          </div>
        </div>

        {loading && <Spinner size="lg" label="Chargement du badge étudiant..." />}

        {!loading && error && (
          <div className="bg-white rounded-2xl border border-red-200 p-8 text-center space-y-3">
            <p className="text-base font-semibold text-red-700">{error}</p>
            <Link
              to="/scan"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-eni-700 text-white text-sm font-medium"
            >
              Réessayer le scan
            </Link>
          </div>
        )}

        {!loading && data && <BadgeTemplate data={data} />}
      </div>
    </div>
  );
};

export default BadgePage;
