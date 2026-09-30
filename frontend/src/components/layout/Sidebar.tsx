import { Fragment, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/auth/AuthProvider";
import { canAccessSettings } from "@/auth/permissions";
import {
  Calendar,
  Upload,
  BarChart3,
  AlertTriangle,
  ScrollText,
  ClipboardList,
  Package,
  MapPin,
  Users,
  Sliders,
  Clock,
  Layers,
  UsersRound,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";

type SectionName =
  | "PLANNING"
  | "MONITORING"
  | "REPORTS"
  | "QUALITY"
  | "MASTERS"
  | "SETTINGS"
  | "LOGS";
type CategoryName = "Entries" | "Analysis" | "Reports";

interface NavItem {
  section: SectionName;
  category?: CategoryName;
  label: string;
  icon: LucideIcon;
  path?: string;
  comingSoon?: boolean;
  visible?: (role: number) => boolean;
}

const navItems: NavItem[] = [
  // ── PLANNING ──────────────────────────────────────
  {
    section: "PLANNING",
    label: "Production Management",
    icon: Calendar,
    path: "/production-management",
  },

  {
    section: "PLANNING",
    category: "Entries",
    label: "Plan Uploader",
    icon: Upload,
    path: "/plan-uploader",
  },


  {
    section: "PLANNING",
    category: "Analysis",
    label: "Production Analytics",
    icon: BarChart3,
    path: "/analysis/production",
  },
  // ── REPORTS (single group) ───────────────────────
  {
    section: "REPORTS",
    label: "DPR (ADC)",
    icon: BarChart3,
    path: "/mpr-adc",
  },
  {
    section: "REPORTS",
    label: "DPR (C4)",
    icon: BarChart3,
    path: "/mpr-c4",
  },




  // ── MASTERS ──────────────────────────────────────
  {
    section: "MASTERS",
    label: "Product Master",
    icon: Package,
    path: "/product-master",
  },
  {
    section: "MASTERS",
    label: "Kanban Master",
    icon: ClipboardList,
    path: "/kanban-master",
  },
  {
    section: "MASTERS",
    label: "Pallet Master",
    icon: Layers,
    path: "/pallet-master",
  },
  {
    section: "MASTERS",
    label: "Locator Master",
    icon: MapPin,
    path: "/locator-master",
  },
  {
    section: "MASTERS",
    label: "User Master",
    icon: Users,
    path: "/user-master",
    visible: (role) => canAccessSettings(role),
  },
  {
    section: "MASTERS",
    label: "DPR Master",
    icon: UsersRound,
    path: "/dpr-master",
  },
  {
    section: "MASTERS",
    label: "Preference Master",
    icon: Sliders,
    path: "/preference-master",
  },
  {
    section: "MASTERS",
    label: "Shift Master",
    icon: Clock,
    path: "/shift-master",
  },
  {
    section: "MASTERS",
    label: "NG Master",
    icon: AlertTriangle,
    path: "/ng-master",
  },

  // ── SETTINGS ──────────────────────────────────────
  {
    section: "SETTINGS",
    label: "Settings",
    icon: Settings,
    path: "/settings",
    visible: (role) => canAccessSettings(role),
  },

  // ── LOGS ──────────────────────────────────────────
  {
    section: "LOGS",
    label: "Logs",
    icon: ScrollText,
    path: "/logs",
  },
];

const SECTION_ORDER: SectionName[] = [
  "PLANNING",
  "MONITORING",
  "REPORTS",
  "MASTERS",
  "SETTINGS",
  "LOGS",
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
}

interface SectionData {
  sectionName: SectionName;
  items: NavItem[];
  hasCategories: boolean;
}

function NavItemButton({
  item,
  collapsed,
  isActive,
  onClick,
}: {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  const button = (
    <button
      data-active={isActive ? "true" : undefined}
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center transition-all duration-150",
        collapsed
          ? "justify-center mx-auto h-10 w-10 rounded-lg"
          : "gap-3 px-3 h-9 rounded-lg text-[13px]",
        isActive
          ? collapsed
            ? "bg-accent text-accent-foreground"
            : "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      {!collapsed && isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-primary" />
      )}
      <Icon
        className={cn(
          "shrink-0 transition-colors duration-150",
          collapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
          isActive
            ? "text-primary"
            : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      {!collapsed && (
        <span className="flex-1 text-left truncate flex items-center gap-2">
          {item.label}
          {item.comingSoon && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary/70 leading-none">
              Soon
            </span>
          )}
        </span>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side="right"
          className="flex items-center gap-2 text-xs"
        >
          {item.label}
          {item.comingSoon && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary/70">
              Soon
            </span>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

// ── Navigation Scroller (extracted for scroll-into-view + scrollbar polish) ──
function NavInner({
  sections,
  collapsed,
  activePath,
  handleNav,
}: {
  sections: SectionData[];
  collapsed: boolean;
  activePath: string;
  handleNav: (path: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll active item into view on mount / path change
  useEffect(() => {
    if (!scrollRef.current || collapsed) return;
    const activeEl = scrollRef.current.querySelector("[data-active='true']");
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activePath, collapsed]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto overflow-x-hidden py-4 pr-[6px] overscroll-contain scroll-smooth sidebar-nav"
      style={{
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(148,163,184,0.25) transparent",
      }}
    >
      {sections.map(({ sectionName, items, hasCategories }) => (
        <div key={sectionName} className="mb-4">
          {!collapsed && (
            <div className="px-5 pb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
                  {sectionName}
                </span>
                <div className="flex-1 h-px bg-border/60" />
              </div>
            </div>
          )}

          <div className={cn("space-y-0.5", collapsed ? "px-2" : "px-2")}>
            {hasCategories ? (
              <>
                {/* Uncategorized items (e.g. Production Management) */}
                {items
                  .filter((item: NavItem) => !item.category)
                  .map((item: NavItem) => (
                    <NavItemButton
                      key={item.label}
                      item={item}
                      collapsed={collapsed}
                      isActive={item.path === activePath}
                      onClick={() =>
                        !item.comingSoon && item.path && handleNav(item.path)
                      }
                    />
                  ))}
                {/* Categorized items */}
                {(["Entries", "Analysis", "Reports"] as CategoryName[]).map(
                  (cat) => {
                    const catItems = items.filter(
                      (item: NavItem) => item.category === cat,
                    );
                    if (catItems.length === 0) return null;

                    return (
                      <Fragment key={cat}>
                        {!collapsed && (
                          <div className="pt-2 pb-0.5 px-3">
                            <span className="text-[10.5px] font-medium tracking-wider text-muted-foreground/50 uppercase select-none">
                              {cat}
                            </span>
                          </div>
                        )}
                        {catItems.map((item: NavItem) => (
                          <NavItemButton
                            key={item.label}
                            item={item}
                            collapsed={collapsed}
                            isActive={item.path === activePath}
                            onClick={() =>
                              !item.comingSoon &&
                              item.path &&
                              handleNav(item.path)
                            }
                          />
                        ))}
                      </Fragment>
                    );
                  },
                )}
              </>
            ) : (
              // ── Other sections: flat list ────────
              items.map((item: NavItem) => (
                <NavItemButton
                  key={item.label}
                  item={item}
                  collapsed={collapsed}
                  isActive={item.path === activePath}
                  onClick={() =>
                    !item.comingSoon && item.path && handleNav(item.path)
                  }
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Sidebar({ open, onClose, collapsed }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const initials = user?.userName
    ? user.userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  const userRole = user?.roleId ?? -1;

  const buildSection = (sectionName: SectionName): SectionData | null => {
    const items = navItems.filter(
      (item) =>
        item.section === sectionName &&
        (!item.visible || item.visible(userRole)),
    );
    if (items.length === 0) return null;
    const hasCategories = items.some((item) => item.category);
    return { sectionName, items, hasCategories };
  };

  const sections: SectionData[] = SECTION_ORDER.map(buildSection).filter(
    (s): s is SectionData => s !== null,
  );

  const sidebarContent = (
    <aside
      className={cn(
        // Only `width` actually changes between collapsed/expanded, so animate
        // just that property (transition-all would also track colors/borders
        // that never change). Width is a layout property, but the page no longer
        // re-renders on toggle — this is a cheap one-time 300ms reflow.
        "flex flex-col border-r border-border/60 bg-card h-full transition-[width] duration-300 ease-in-out",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* ── Branding Header ────────────────────────── */}
      <div className="flex h-14 items-center bg-primary px-4 shrink-0">
        {!collapsed ? (
          <div className="flex items-center flex-1 overflow-hidden">
            <img
              src="/logo-nxpert-eon-white.png"
              alt="NXPERT EON"
              className="h-9 w-auto max-w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex w-full justify-center">
            <img
              src="/logo-nxpert-eon-white.png"
              alt="NXPERT EON"
              className="h-8 w-auto object-contain"
            />
          </div>
        )}
        <div className="lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10"
            aria-label="Close sidebar"
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────── */}
      <NavInner
        sections={sections}
        collapsed={collapsed}
        activePath={location.pathname}
        handleNav={handleNav}
      />

      {/* ── User Panel ─────────────────────────────── */}
      <div className="border-t border-border/60 shrink-0">
        {user && (
          <div
            className={cn(
              "flex items-center gap-2.5 px-4 py-3",
              collapsed ? "justify-center" : "",
            )}
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex flex-col overflow-hidden min-w-0">
                <span className="text-xs font-medium text-foreground truncate leading-tight">
                  {user.userName}
                </span>
                <span className="text-[11px] text-muted-foreground truncate leading-tight">
                  {user.userCode}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Thin scrollbar + edge fade styles ── */}
      <style>{`
        .sidebar-nav::-webkit-scrollbar {
          width: 6px;
        }
        .sidebar-nav::-webkit-scrollbar-track {
          background: transparent;
          margin: 4px 0;
        }
        .sidebar-nav::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.25);
          border-radius: 999px;
          transition: background 0.2s ease;
        }
        .sidebar-nav:hover::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.45);
        }
        .sidebar-nav::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.65);
        }
        /* Subtle edge fade hint */
        .sidebar-nav {
          mask-image: linear-gradient(
            to bottom,
            transparent 0%,
            black 10px,
            black calc(100% - 10px),
            transparent 100%
          );
          -webkit-mask-image: linear-gradient(
            to bottom,
            transparent 0%,
            black 10px,
            black calc(100% - 10px),
            transparent 100%
          );
        }
      `}</style>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:flex lg:flex-col shrink-0">
        {sidebarContent}
      </div>
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col lg:hidden transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {sidebarContent}
      </div>
    </>
  );
}
