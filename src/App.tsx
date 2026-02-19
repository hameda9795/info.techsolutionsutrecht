import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useParams, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import AdminDashboard from '@/sections/AdminDashboard';
import EmailVerification from '@/sections/EmailVerification';
import InvoiceViewer from '@/sections/InvoiceViewer';
import LoginPage from '@/sections/LoginPage';
import type { Invoice } from '@/types/invoice';
import { getInvoiceById } from '@/lib/storage';
import { Card, CardContent } from '@/components/ui/card';
import { FileX, Loader2 } from 'lucide-react';

// Protected Route Wrapper
const ProtectedRoute = () => {
  const isAuth = localStorage.getItem('isAuthenticated') === 'true';
  return isAuth ? <Outlet /> : <Navigate to="/login" replace />;
};

// Invoice Route Component with Verification
function InvoiceRoute() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInvoice = async () => {
      if (id) {
        setIsLoading(true);
        const found = await getInvoiceById(id);
        if (found) {
          setInvoice(found);
          // If already approved, skip verification
          if (found.status === 'approved') {
            setIsVerified(true);
          }
        }
        setIsLoading(false);
      }
    };
    fetchInvoice();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <FileX className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Factuur Niet Gevonden</h2>
            <p className="text-gray-600">
              Er is geen factuur met dit nummer of deze is verwijderd.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show verification if not verified and not already approved
  if (!isVerified && invoice.status !== 'approved') {
    return (
      <EmailVerification
        invoice={invoice}
        onVerified={() => setIsVerified(true)}
      />
    );
  }

  // Show invoice
  return <InvoiceViewer invoice={invoice} />;
}

// Main App
function App() {
  return (
    <HashRouter>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<AdminDashboard />} />
        </Route>

        {/* Public Routes */}
        <Route path="/invoice/:id" element={<InvoiceRoute />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
