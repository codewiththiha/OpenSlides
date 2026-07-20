import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "./components/ui/tooltip";
import { Dashboard } from "./components/Dashboard";
import { Editor } from "./components/Editor";

export default function App() {
  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={350} skipDelayDuration={0}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/editor/:projectId" element={<Editor />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </TooltipProvider>
    </BrowserRouter>
  );
}
