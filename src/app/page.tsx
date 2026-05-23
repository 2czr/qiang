"use client";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LoginContent } from "./login/page-content";
import MainApp from "./main-app";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ededed]">
        <div className="w-6 h-6 border-2 border-[#07c160] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginContent />;
  }

  return <MainApp />;
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
