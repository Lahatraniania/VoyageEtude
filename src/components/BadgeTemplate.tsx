import React, { useState, useEffect } from "react";
import { RefreshCw, MapPin, Heart, Users, QrCode } from "lucide-react";
import { getProgrammeDayInfo } from "../utils/programmeDate";
import type { BadgeInfoResponse, ProgrammeItem } from "../types";

interface BadgeTemplateProps {
  data: BadgeInfoResponse;
}

const PARCOURS_STYLES: Record<string, string> = {
  MDI: "bg-emerald-500/20 text-emerald-100 border-emerald-300/40",
  ASR: "bg-sky-500/20 text-sky-100 border-sky-300/40",
  IG: "bg-amber-500/20 text-amber-100 border-amber-300/40",
  IA: "bg-violet-500/20 text-violet-100 border-violet-300/40",
};

export const BadgeTemplate: React.FC<BadgeTemplateProps> = ({ data }) => {
  const [flipped, setFlipped] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);
  const { etudiant, voiture, programme, parametres, qr_url } = data;

  useEffect(() => {
    setPhotoFailed(false);
    setQrFailed(false);
  }, [etudiant.photo_url, qr_url]);

  const groupedByDay: Record<number, ProgrammeItem[]> = {};
  for (let d = 1; d <= 7; d++) {
    groupedByDay[d] = programme.filter((p) => p.jour === d);
  }

  const startInfo = getProgrammeDayInfo(parametres.date_debut, 1);
  const endInfo = getProgrammeDayInfo(parametres.date_fin, 1);
  const headerRange =
    startInfo && endInfo
      ? `${startInfo.dateFullNumeric} → ${endInfo.dateFullNumeric}`
      : `${parametres.date_debut} → ${parametres.date_fin}`;

  const initials = `${etudiant.prenom?.[0] || ""}${etudiant.nom?.[0] || ""}`.toUpperCase();

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-[420px] mx-auto">
      <div className="w-full perspective-1000">
        <div
          className={`relative w-full min-h-[640px] transition-transform duration-700 transform-style-3d ${flipped ? "rotate-y-180" : ""
            }`}
        >
          {/* RECTO : PROGRAMME COMPLET 7 JOURS + NUMÉRO DE VOITURE */}
          <div className="absolute inset-0 backface-hidden rounded-2xl overflow-hidden shadow-2xl border border-eni-600/40 bg-gradient-to-br from-eni-800 via-eni-900 to-eni-950 text-white flex flex-col">
            <div className="px-5 py-4 bg-white/10 border-b border-white/15 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-gold-400">
                  {parametres.ecole} · PROMO {parametres.annee_promotion || "2026"}
                </p>
                <h2 className="font-display text-lg font-bold tracking-tight text-white">
                  VOYAGE D&apos;ÉTUDES
                </h2>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-1 text-xs font-semibold text-gold-300">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{parametres.destination}</span>
                </div>
                <p className="text-[11px] text-eni-200 tabular-nums">{headerRange}</p>
              </div>
            </div>

            <div className="flex-1 p-4 space-y-2 overflow-y-auto">
              {[1, 2, 3, 4, 5, 6, 7].map((jour) => {
                const items = groupedByDay[jour] || [];
                const dayInfo = getProgrammeDayInfo(parametres.date_debut, jour);
                return (
                  <div
                    key={jour}
                    className="rounded-lg bg-white/10 border border-white/10 px-3 py-2 flex items-start gap-2.5"
                  >
                    <div className="w-[58px] shrink-0 pt-0.5">
                      <span className="block font-mono text-xs font-bold text-gold-400 tabular-nums leading-tight">
                        J-0{jour}
                      </span>
                      {dayInfo && (
                        <span className="block text-[10px] font-medium text-eni-200 tabular-nums leading-tight mt-0.5">
                          {dayInfo.compactLabel}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      {items.length > 0 ? (
                        items.map((item) => (
                          <div key={item.id} className="text-[11px] leading-snug text-eni-50">
                            <span className="font-semibold text-gold-300 mr-1.5">
                              {item.periode === "MATIN" ? "Matin" : "Midi"} ({item.heure_debut.slice(0, 5)}):
                            </span>
                            <span className="text-white/95">{item.activite}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-eni-300/80">Programme en attente</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 pt-2">
              <div className="w-full rounded-xl bg-gold-400 text-eni-950 px-4 py-3 text-center shadow-md">
                <p className="text-[10px] font-bold tracking-widest uppercase opacity-80">
                  Affectation Transport
                </p>
                <p className="font-display text-xl font-extrabold tracking-tight tabular-nums">
                  {voiture ? `VOITURE N° ${voiture.numero_voiture}` : "VOITURE NON AFFECTÉE"}
                </p>
              </div>
            </div>
          </div>

          {/* VERSO : PHOTO, IDENTITÉ, PARCOURS, VOITURE, CONTACTS, QR CODE */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl overflow-hidden shadow-2xl border border-eni-600/40 bg-gradient-to-br from-eni-700 via-eni-800 to-eni-950 text-white flex flex-col">
            <div className="px-5 py-3.5 bg-white/10 border-b border-white/15 flex items-center justify-between">
              <span className="font-display text-sm font-bold tracking-wide text-gold-400">
                BADGE OFFICIEL {parametres.ecole}
              </span>
              <span className="text-xs text-eni-100">{parametres.destination}</span>
            </div>

            <div className="flex-1 p-5 flex flex-col items-center justify-between text-center gap-3">
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 rounded-full border-3 border-gold-400 overflow-hidden bg-eni-900 shadow-lg flex items-center justify-center">
                  {etudiant.photo_url && !photoFailed ? (
                    <img
                      src={etudiant.photo_url}
                      alt={`${etudiant.prenom} ${etudiant.nom}`}
                      className="w-full h-full object-cover"
                      onError={() => setPhotoFailed(true)}
                    />
                  ) : (
                    <span className="font-display text-2xl font-bold text-gold-300">
                      {initials}
                    </span>
                  )}
                </div>

                <h3 className="mt-3 font-display text-xl font-bold tracking-tight text-white">
                  {etudiant.nom} {etudiant.prenom}
                </h3>

                <div className="mt-2 flex items-center justify-center gap-2">
                  <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-white/15 border border-white/20 text-white tabular-nums">
                    {etudiant.matricule}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${PARCOURS_STYLES[etudiant.parcours] || "bg-white/15 text-white border-white/20"
                      }`}
                  >
                    {etudiant.parcours}
                  </span>
                </div>
              </div>

              <div className="w-full rounded-xl bg-gold-400/95 text-eni-950 py-2 px-4 shadow-sm">
                <p className="font-display text-base font-extrabold tracking-wide tabular-nums">
                  {voiture ? `VOITURE V${voiture.numero_voiture}` : "NON AFFECTÉ"}
                </p>
              </div>

              <div className="p-2.5 bg-white rounded-xl shadow-md">
                {qr_url && !qrFailed ? (
                  <img
                    src={qr_url}
                    alt={`QR Code ${etudiant.matricule}`}
                    className="w-32 h-32 object-contain block"
                    onError={() => setQrFailed(true)}
                  />
                ) : (
                  <div className="w-32 h-32 flex items-center justify-center text-eni-900">
                    <QrCode className="w-16 h-16" />
                  </div>
                )}
              </div>

              <div className="w-full rounded-xl bg-white/10 border border-white/15 p-3 text-left space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-eni-100">
                  <Users className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                  <span className="truncate">
                    <strong className="text-white">Resp :</strong>{" "}
                    {parametres.nom_responsable || "N/A"} ·{" "}
                    <span className="font-mono tabular-nums">{parametres.tel_responsable || "-"}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-eni-100">
                  <Heart className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                  <span className="truncate">
                    <strong className="text-white">Santé :</strong>{" "}
                    {parametres.nom_responsable_sante || "N/A"} ·{" "}
                    <span className="font-mono tabular-nums">{parametres.tel_responsable_sante || "-"}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((prev) => !prev)}
        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-eni-800 hover:bg-eni-900 text-white text-sm font-semibold shadow-md transition-colors cursor-pointer"
      >
        <RefreshCw className={`w-4 h-4 transition-transform duration-300 ${flipped ? "rotate-180" : ""}`} />
        <span>Retourner ({flipped ? "Voir Recto" : "Voir Verso"})</span>
      </button>
    </div>
  );
};

export default BadgeTemplate;