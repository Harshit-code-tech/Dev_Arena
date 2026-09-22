// frontend/src/app/Providers.tsx

import { Toaster } from "react-hot-toast";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../features/auth/context/AuthContext";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <AuthProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "rgba(12, 20, 36, 0.95)",
              color: "#f8fafc",
              border: "1px solid rgba(125, 211, 252, 0.2)",
              borderRadius: "12px",
              boxShadow: "0 16px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(125, 211, 252, 0.08)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              fontSize: "13.5px",
              fontWeight: "500",
              padding: "12px 18px",
            },
            success: {
              iconTheme: {
                primary: "#38bdf8",
                secondary: "#0c1424",
              },
            },
            error: {
              iconTheme: {
                primary: "#f87171",
                secondary: "#0c1424",
              },
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
