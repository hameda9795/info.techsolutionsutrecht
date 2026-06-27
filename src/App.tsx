import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthUser } from '@/lib/auth';
import AppLayout from '@/sections/AppLayout';
import LoginPage from '@/sections/LoginPage';
import ProjectsPage from '@/sections/ProjectsPage';
import ClientsPage from '@/sections/ClientsPage';
import ProjectDossier from '@/sections/ProjectDossier';
import DocumentsPage from '@/sections/DocumentsPage';
import DocumentViewer from '@/sections/DocumentViewer';
import PaymentsPage from '@/sections/PaymentsPage';
import Rapportage from '@/sections/Rapportage';
import BtwAangifte from '@/sections/BtwAangifte';
import Instellingen from '@/sections/Instellingen';

const ProtectedRoute = () => {
  const { user, loading } = useAuthUser();
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<ProjectsPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/projects/:id" element={<ProjectDossier />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/documents/:id" element={<DocumentViewer />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/rapportage" element={<Rapportage />} />
            <Route path="/btw-aangifte" element={<BtwAangifte />} />
            <Route path="/instellingen" element={<Instellingen />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
