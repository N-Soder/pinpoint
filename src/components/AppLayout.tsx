import { Link, useLocation } from "react-router-dom";
import { Crosshair, FolderOpen, Plus } from "lucide-react";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();

  const navItems = [
    { to: "/admin", label: "Projects", icon: FolderOpen },
    { to: "/admin/new", label: "New Project", icon: Plus },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
          <Crosshair className="h-5 w-5 text-sidebar-primary" />
          <span className="font-semibold text-sm tracking-tight text-sidebar-primary-foreground">
            Pinpoint
          </span>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              item.to === "/admin"
                ? location.pathname === "/admin"
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 min-h-screen bg-background overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
