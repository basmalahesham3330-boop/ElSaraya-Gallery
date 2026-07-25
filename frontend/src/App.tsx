import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Products from './pages/Products';
import Jobs from './pages/Jobs';
import AddProject from './pages/AddProject';
import ProjectDetails from './pages/ProjectDetails';
import MeasurementDetails from './pages/MeasurementDetails';
import Payments from './pages/Payments';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes default
      cacheTime: 10 * 60 * 1000, // 10 minutes cache
    },
  },
});

// Redirect component for quotation details
function QuotationRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/projects/${id}`} replace />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/products" element={<Products />} />
            
            {/* Redirect old quotations routes to projects */}
            <Route path="/quotations" element={<Navigate to="/jobs" replace />} />
            <Route path="/quotations/:id" element={<QuotationRedirect />} />
            
            {/* Projects routes */}
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/new" element={<AddProject />} />
            <Route path="/jobs/:id" element={<ProjectDetails />} />
            <Route path="/jobs/:jobId/measurements/:measurementId" element={<MeasurementDetails />} />
            <Route path="/projects" element={<Jobs />} />
            <Route path="/projects/new" element={<AddProject />} />
            <Route path="/projects/:id" element={<ProjectDetails />} />
            
            <Route path="/payments" element={<Payments />} />
          </Routes>
        </Layout>
      </BrowserRouter>
      <Toaster position="top-left" richColors dir="rtl" />
    </QueryClientProvider>
  );
}

export default App;
