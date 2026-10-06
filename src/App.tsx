import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import NewProject from "./pages/NewProject";
import ProjectDashboard from "./pages/ProjectDashboard";
import NotFound from "./pages/NotFound";
import { PasswordGate } from "./components/PasswordGate";

const App = () => (
  <>
    <Toaster />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/admin"
          element={
            <PasswordGate>
              <Index />
            </PasswordGate>
          }
        />
        <Route
          path="/admin/new"
          element={
            <PasswordGate>
              <NewProject />
            </PasswordGate>
          }
        />
        <Route
          path="/admin/project/:id"
          element={
            <PasswordGate>
              <ProjectDashboard />
            </PasswordGate>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </>
);

export default App;
