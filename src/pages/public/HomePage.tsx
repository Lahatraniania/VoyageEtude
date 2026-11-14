import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { QrCode, ArrowRight, MapPin, Users, CheckCircle, Target } from "lucide-react";
import axiosClient from "../../api/axiosClient";
import type { ParametresVoyage } from "../../types";

export const HomePage: React.FC = () => {
  const [params, setParams] = useState<ParametresVoyage | null>(null);

  useEffect(() => {
    axiosClient
      .get<ParametresVoyage[]>("/core/parametres/")
      .then((res) => {
        if (res.data.length > 0) setParams(res.data[0]);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <Link
            to="/"
            className="font-display text-lg font-bold tracking-tight text-eni-900 whitespace-nowrap shrink-0"
          >
            VoyageE <span className="text-eni-600">ENI</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#fonctionnement" className="hover:text-eni-800 transition-colors whitespace-nowrap shrink-0">
              Fonctionnement
            </a>
            <Link to="/scan" className="hover:text-eni-800 transition-colors whitespace-nowrap shrink-0">
              Scanner
            </Link>
            <Link to="/admin" className="hover:text-eni-800 transition-colors whitespace-nowrap shrink-0">
              Administration
            </Link>
          </nav>

          <div className="shrink-0">
            <Link
              to="/scan"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-eni-700 hover:bg-eni-800 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
            >
              <QrCode className="w-4 h-4" />
              <span>Scanner un badge</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="bg-gradient-to-br from-eni-800 via-eni-900 to-eni-950 text-white">
          <div className="max-w-7xl mx-auto px-6 py-16 lg:py-24 grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="text-xs font-medium text-gold-300 flex items-center gap-2">
                <span>École Nationale d&apos;Informatique</span>
                <span aria-hidden="true">·</span>
                <span>MDI · ASR · IG · IA</span>
                {params && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{params.destination}</span>
                  </>
                )}
              </div>

              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-tight max-w-2xl text-balance">
                Organisation et badges QR du voyage d&apos;étude sur 7 jours.
              </h1>

              <p className="text-base sm:text-lg text-eni-100 max-w-xl leading-relaxed">
                Centralisez le programme quotidien, répartissez les étudiants dans les voitures et générez des badges recto/verso consultables depuis n&apos;importe quel téléphone.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/scan"
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gold-400 hover:bg-gold-300 text-eni-950 font-semibold text-sm transition-colors shadow-sm whitespace-nowrap"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Scanner un badge</span>
                </Link>
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium text-sm transition-colors whitespace-nowrap"
                >
                  <span>Espace admin</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-white/15 pb-4">
                  <div>
                    <p className="text-xs text-eni-200">Destination active</p>
                    <p className="font-display text-2xl font-bold text-gold-400">
                      {params?.destination || "TOLIARA"}
                    </p>
                  </div>
                  <MapPin className="w-7 h-7 text-gold-400" />
                </div>

                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-eni-200">Période</dt>
                    <dd className="font-medium text-white mt-0.5 tabular-nums">
                      {params ? `${params.date_debut} → ${params.date_fin}` : "7 jours"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-eni-200">Promotion</dt>
                    <dd className="font-medium text-white mt-0.5 tabular-nums">
                      {params?.annee_promotion || "2025-2026"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-eni-200">Responsable voyage</dt>
                    <dd className="font-medium text-white mt-0.5 truncate">
                      {params?.nom_responsable || "Administration ENI"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-eni-200">Contact santé</dt>
                    <dd className="font-medium text-white mt-0.5 truncate">
                      {params?.tel_responsable_sante || "-"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </section>

        <section id="fonctionnement" className="max-w-7xl mx-auto px-6 py-16">
          <div className="mb-10">
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Chaîne logistique complète
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Du paramétrage du convoi jusqu&apos;à l&apos;impression PDF recto/verso.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-eni-50 text-eni-700 flex items-center justify-center">
                <Target className="w-5 h-5" />
              </div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                1. Programme 7 jours
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Planifiez les visites d&apos;entreprises et transferts du jour J-01 au jour J-07 par créneaux Matin et Midi.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-eni-50 text-eni-700 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                2. Voitures &amp; auto-affectation
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Créez vos véhicules (26 places par défaut) et répartissez automatiquement les étudiants non affectés en un clic.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-eni-50 text-eni-700 flex items-center justify-center">
                <CheckCircle className="w-5 h-5" />
              </div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                3. Badges QR publics 4G
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Chaque QR code pointe vers une URL publique accessible depuis n&apos;importe quel smartphone et imprimable en PDF.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>VoyageE — École Nationale d&apos;Informatique (ENI)</span>
          <span>Parcours MDI · ASR · IG · IA</span>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
