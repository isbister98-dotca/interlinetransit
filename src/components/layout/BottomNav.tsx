import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TAB_ITEMS } from "@/lib/types";

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-[360px] bg-accent border border-border rounded-lg flex items-center justify-around px-1 py-2 mb-2 mx-4">
        {TAB_ITEMS.map((tab) => {
          const isActive = tab.path === "/" ? location.pathname === "/" : location.pathname.startsWith(tab.path);
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.id}
              to={tab.path}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all min-w-[48px]",
                isActive
                  ? "bg-[hsl(93_50%_56%/0.12)]"
                  : ""
              )}
            >
              <Icon className={cn(
                "w-5 h-5",
                isActive ? "text-primary" : "text-[hsl(var(--text-tertiary))]"
              )} />
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-[0.06em]",
                isActive ? "text-primary" : "text-[hsl(var(--text-tertiary))]"
              )}>
                {tab.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
