import React, { useCallback, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import QRScanner from "../../components/QRScanner";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";

export const ScanPage: React.FC = () => {
  const navigate = useNavigate();
  const [manualToken, setManualToken] = useState("");

  const extractToken = (value: string): string => {
    const trimmed = value.trim();
    const match = trimmed.match(/\/badge\/([a-f0-9-]+)/i);
    if (match && match[1]) return match[1];
    return trimmed;
  };

  const handleScanSuccess = useCallback(
    (decodedText: string) => {
      const token = extractToken(decodedText);
      if (token) {
        navigate(`/badge/${token}`);
      }
    },
    [navigate]
  );

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const token = extractToken(manualToken);
    if (token) {
      navigate(`/badge/${token}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-eni-800"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Accueil</span>
          </Link>
          <span className="text-xs font-medium text-eni-700">Scanner QR · VoyageE</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="font-display text-xl font-bold text-slate-900">
              Scanner un badge étudiant
            </h1>
            <p className="text-sm text-slate-500">
              Placez le QR code du badge devant la caméra de votre appareil.
            </p>
          </div>

          <QRScanner onScanSuccess={handleScanSuccess} />

          <form onSubmit={handleManualSubmit} className="pt-4 border-t border-slate-200 space-y-3">
            <Input
              label="Ou saisir l'UUID du badge / URL"
              placeholder="ex: a1b2c3d4-1111-4000-8000-000000000001"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
            />
            <Button type="submit" className="w-full">
              <span>Afficher le badge</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ScanPage;
