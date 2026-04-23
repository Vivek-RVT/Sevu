import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Home, Users, Settings, BarChart3, ClipboardList } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MobileLayoutProps {
  children: ReactNode;
}

export function MobileLayout({ children }: MobileLayoutProps) {
  const [location] = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { path: "/app/dashboard", icon: Home, label: t("nav.home") },
    { path: "/app/customers", icon: Users, label: t("nav.customers") },
    { path: "/app/services", icon: ClipboardList, label: t("nav.services") },
    { path: "/app/analytics", icon: BarChart3, label: t("nav.analytics") },
    { path: "/app/settings", icon: Settings, label: t("nav.settings") },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 sm:pb-0 sm:pl-20 md:pl-64 flex flex-col mx-auto max-w-md sm:max-w-none shadow-2xl sm:shadow-none bg-background relative overflow-hidden">
      
      {/* Main Content Area — no key to avoid full remount on navigation; bottom nav stays mounted */}
      <main className="flex-1 w-full flex flex-col relative z-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/50 pb-safe sm:hidden max-w-md mx-auto">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path !== "/app/dashboard" && location.startsWith(item.path));
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.path} 
                href={item.path}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 relative transition-colors duration-200",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <span className="absolute top-0 w-8 h-1 bg-secondary rounded-b-full shadow-[0_0_10px_rgba(13,197,161,0.7)]" />
                )}
                <Icon className={cn("w-6 h-6", isActive && "fill-primary/10")} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop/Tablet Sidebar (Hidden on mobile) */}
      <nav className="hidden sm:flex flex-col fixed top-0 bottom-0 left-0 w-20 md:w-64 bg-card border-r border-border/50 z-50">
        <div className="p-6 flex items-center justify-center md:justify-start gap-3">
          <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Sevu Logo" className="w-8 h-8 rounded-lg shadow-sm" />
          <span className="font-display font-bold text-xl hidden md:block tracking-tight text-foreground">Sevu</span>
        </div>
        <div className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path !== "/app/dashboard" && location.startsWith(item.path));
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.path} 
                href={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group hover-elevate",
                  isActive 
                    ? "bg-primary/10 text-primary font-semibold" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground font-medium"
                )}
              >
                <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive && "fill-primary/10")} strokeWidth={isActive ? 2.5 : 2} />
                <span className="hidden md:block">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
