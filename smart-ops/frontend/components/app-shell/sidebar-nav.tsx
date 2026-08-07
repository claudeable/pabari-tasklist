"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Waves, ChevronsLeft, ChevronsRight } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav-config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useUnreadMessageCount } from "@/lib/hooks/use-notifications";

interface SidebarNavProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}

export function SidebarNav({ collapsed, onToggleCollapse, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const { data: unreadMessages } = useUnreadMessageCount();
  const unreadCount = unreadMessages?.unread_count ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-16 items-center gap-2 border-b border-border/60 px-4",
          collapsed && "justify-center px-2",
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Waves className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              Smart Ops
            </p>
            <p className="truncate text-xs text-muted-foreground">Portal</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3 scrollbar-thin">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const isCommunication = item.href === "/communication";
          const showBadge = isCommunication && unreadCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-2",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <div className="relative shrink-0">
                <Icon className={cn("h-4 w-4", isActive && "text-primary")} />
                {showBadge && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold leading-none text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && showBadge && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {onToggleCollapse && (
        <div className="border-t border-border/60 p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center gap-2 text-muted-foreground"
            onClick={onToggleCollapse}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
