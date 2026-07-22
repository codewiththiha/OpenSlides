import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Dashboard } from "./components/Dashboard";
import { Editor } from "./components/Editor";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/editor/:projectId" element={<Editor />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
