import { memo, useCallback, useEffect, useState } from "react";
import { useOutlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Timer } from "lucide-react";
import ChatAssistant from "@/components/chat/ChatAssistant";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { cn } from "@/lib/utils";

// The header + page content column is memoized so that toggling the sidebar
// (open/close/collapse) NEVER re-renders the current page:
//   - `onMenuClick` / `onToggleCollapse` are stable (useCallback), so the
//     memo comparison passes on every sidebar-state change.
//   - The page element comes from the route context via `useOutlet()` — its
//     reference is stable while AppShell state changes (AppRoutes does not
//     re-render on sidebar toggles), so React.memo bails out and the whole
//     page (tables, KPI cards, charts) stays mounted without re-rendering.
// Navigating still updates the page: a route-context change re-renders this
// component regardless of memo, and `useOutlet()` returns the new element.
const MainContent = memo(function MainContent({
  onMenuClick,
  onToggleCollapse,
}: {
  onMenuClick: () => void;
  onToggleCollapse: () => void;
}) {
  const outlet = useOutlet();
  return (
    <div className="flex flex-1 flex-col overflow-hidden min-w-0">
      <Header onMenuClick={onMenuClick} onToggleCollapse={onToggleCollapse} />
      <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">{outlet}</main>
    </div>
  );
});

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { showWarning, continueSession } = useSessionTimeout();

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && sidebarOpen) setSidebarOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [sidebarOpen]);

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleCollapse = useCallback(() => setCollapsed((c) => !c), []);

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-muted/30">
        <Sidebar open={sidebarOpen} onClose={closeSidebar} collapsed={collapsed} />

        <MainContent onMenuClick={openSidebar} onToggleCollapse={toggleCollapse} />

        <div
          className={cn(
            "fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity duration-300",
            sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={closeSidebar}
        />
      </div>

      {/* Floating chat assistant (UI only) */}
      <ChatAssistant />

      {/* Idle session warning — shown ~1 minute before timeout */}
      <Dialog open={showWarning} onOpenChange={(open) => !open && continueSession()}>
        <DialogContent hideDefaultClose className="max-w-md">
          <DialogHeader className="sm:text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
              <Timer className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg">Your session is about to expire</DialogTitle>
            <DialogDescription className="leading-relaxed">
              You will be signed out soon due to inactivity.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={continueSession} className="w-full sm:w-auto">
              Continue Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
