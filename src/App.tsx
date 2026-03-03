import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { BottomNav } from "@/components/layout/BottomNav";
import MapScreen from "@/pages/MapScreen";
import JourneyScreen from "@/pages/JourneyScreen";
import SocialScreen from "@/pages/SocialScreen";
import ProfileScreen from "@/pages/ProfileScreen";
import AttributionsScreen from "@/pages/AttributionsScreen";
import AdminGtfsScreen from "@/pages/AdminGtfsScreen";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="min-h-[100dvh] bg-background overflow-y-auto scrollbar-hide">
          <Routes>
            <Route path="/" element={<Navigate to="/map" replace />} />
            <Route path="/map" element={<MapScreen />} />
            <Route path="/journey" element={<JourneyScreen />} />
            <Route path="/social" element={<SocialScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="/attributions" element={<AttributionsScreen />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <BottomNav />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
