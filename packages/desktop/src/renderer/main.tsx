import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import "./index.css";

const queryClient = new QueryClient();
const root = ReactDOM.createRoot(document.getElementById("root")!);

// The IDE opens as a separate BrowserWindow loading this same index.html
// with ?window=ide (see main/ide/ideWindow.ts) — lazy-imported so Monaco/
// xterm/etc. never end up in the main Board window's bundle at all.
const isIdeWindow = new URLSearchParams(window.location.search).get("window") === "ide";

if (isIdeWindow) {
  import("./ide/IdeApp").then(({ default: IdeApp }) => {
    root.render(
      <React.StrictMode>
        <IdeApp />
      </React.StrictMode>
    );
  });
} else {
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
}
