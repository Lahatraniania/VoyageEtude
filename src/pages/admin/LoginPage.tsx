import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/admin", { replace: true });
    } catch {
      setError("Identifiants incorrects. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-eni-800 via-eni-900 to-eni-950 flex flex-col justify-center py-12 px-4 sm:px-6">
      <div className="max-w-md w-full mx-auto space-y-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-eni-200 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à l&apos;accueil</span>
        </Link>

        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <div>
            <p className="text-xs font-semibold tracking-wider text-eni-700 uppercase">
              Administration ENI
            </p>
            <h1 className="font-display text-2xl font-bold text-slate-900 mt-1">
              Connexion VoyageE
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Accès gestionnaire : étudiants, programme, voitures et badges QR.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nom d'utilisateur"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
            <Input
              label="Mot de passe"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <Button type="submit" loading={loading} className="w-full">
              <span>Se connecter</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <p className="text-xs text-slate-500 text-center">
            Identifiants par défaut configurés : <span className="font-mono text-slate-700"></span> /{" "}
            <span className="font-mono text-slate-700"></span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
