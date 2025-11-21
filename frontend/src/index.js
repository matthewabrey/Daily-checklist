import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { Toaster } from "./components/ui/toaster";
import { LanguageProvider } from "./LanguageContext";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
      <Toaster />
    </LanguageProvider>
  </React.StrictMode>,
);
