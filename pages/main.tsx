import React from "react";
import { createRoot } from "react-dom/client";
import { SegmenterApp } from "../app/segmenter-app";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SegmenterApp />
  </React.StrictMode>,
);