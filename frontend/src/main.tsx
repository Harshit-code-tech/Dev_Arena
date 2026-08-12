import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./shared/styles/Global.css";
import "./shared/styles/SpaceTheme.css";
import "./shared/styles/PageMotion.css";
import { App } from "./app/App";
import { AppProviders } from "./app/Providers";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>
);
