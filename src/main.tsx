import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import {AssetGate} from './AssetGate';
import "./app.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AssetGate><App /></AssetGate>
  </React.StrictMode>,
);
