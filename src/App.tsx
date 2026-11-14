import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";

import AgentIAPage from "./pages/admin/AgentIAPage";
import HomePage from "./pages/public/HomePage";
import BadgePage from "./pages/public/BadgePage";
import ScanPage from "./pages/public/ScanPage";
import ChefVoiturePage from "./pages/public/ChefVoiturePage";

import LoginPage from "./pages/admin/LoginPage";
import Dashboard from "./pages/admin/Dashboard";
import EtudiantsPage from "./pages/admin/EtudiantsPage";
import ProgrammePage from "./pages/admin/ProgrammePage";
import VoituresPage from "./pages/admin/VoituresPage";
import AffectationsPage from "./pages/admin/AffectationsPage";
import ParametresPage from "./pages/admin/ParametresPage";
import BadgesPage from "./pages/admin/BadgesPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/badge/:qrToken" element={<BadgePage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/chef/:voitureId" element={<ChefVoiturePage />} />

          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin" element={<ProtectedRoute />}>
            <Route index element={<Dashboard />} />
            <Route path="etudiants" element={<EtudiantsPage />} />
            <Route path="programme" element={<ProgrammePage />} />
            <Route path="voitures" element={<VoituresPage />} />
            <Route path="affectations" element={<AffectationsPage />} />
            <Route path="parametres" element={<ParametresPage />} />
            <Route path="badges" element={<BadgesPage />} />
            <Route path="agent-ia" element={<AgentIAPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
