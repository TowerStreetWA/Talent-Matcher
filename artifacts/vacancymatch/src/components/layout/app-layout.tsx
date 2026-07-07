import React from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Upload, 
  Users, 
  Target, 
  Briefcase, 
  Database, 
  Bell, 
  ShieldCheck,
  Search
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload CV", icon: Upload },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/matches", label: "Matches", icon: Target },
  { href: "/jobs", label: "Live Jobs", icon: Briefcase },
  { href: "/sources", label: "Sources", icon: Database },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/admin", label: "Compliance", icon: ShieldCheck },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar flex flex-col hidden md:flex">
        <div className="h-14 flex items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight text-sidebar-foreground">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
              <Target size={14} strokeWidth={3} />
            </div>
            VacancyMatch
          </div>
        </div>
        
        <div className="px-4 py-4 flex-1 overflow-y-auto">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}>
                  <div className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors cursor-pointer",
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}>
                    <item.icon size={18} />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-card flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4 text-muted-foreground w-full max-w-md">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Quick search..." 
              className="bg-transparent border-none outline-none focus:ring-0 text-sm flex-1 placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-medium text-secondary-foreground">
              R
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto p-6 md:p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
