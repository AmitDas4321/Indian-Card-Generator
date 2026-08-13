import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { AdminLogin } from './AdminLogin';
import { AdminDashboard } from './AdminDashboard';
import { checkAdminAuth, adminLogout } from '../../services/adminService';

interface AdminPageProps {
  onNavigateHome: () => void;
  onNavigateVerify: (id: string, fromAdmin?: boolean) => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onNavigateHome, onNavigateVerify }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function verifyAuth() {
      const res = await checkAdminAuth();
      if (isMounted) {
        setIsAuthenticated(res.authenticated);
      }
    }

    verifyAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await adminLogout();
    setIsAuthenticated(false);
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#040814] flex flex-col items-center justify-center text-slate-300">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF9933] mb-3" />
        <span className="text-xs tracking-wider uppercase text-slate-500 font-semibold">
          Verifying Admin Security...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AdminLogin
        onLoginSuccess={handleLoginSuccess}
        onNavigateHome={onNavigateHome}
      />
    );
  }

  return (
    <AdminDashboard
      onLogout={handleLogout}
      onNavigateHome={onNavigateHome}
      onNavigateVerify={(id) => onNavigateVerify(id, true)}
    />
  );
};
