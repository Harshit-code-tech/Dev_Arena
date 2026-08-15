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
              background: "#000000",
              color: "#ffffff",
              border: "1px solid #3a3a3f",
              borderRadius: "4px",
              boxShadow: "none",
              fontFamily: '"D-DIN", Arial, Verdana, sans-serif',
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
