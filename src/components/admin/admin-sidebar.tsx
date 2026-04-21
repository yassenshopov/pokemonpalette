"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Gauge,
  Gamepad2,
  Mail,
  Palette,
  Paintbrush,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserProfileWrapper } from "@/components/user-profile-wrapper";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

const OVERVIEW: NavItem = {
  label: "Overview",
  href: "/admin",
  icon: Gauge,
  exact: true,
};

const MANAGEMENT: NavItem[] = [
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Game Data", href: "/admin/game", icon: Gamepad2 },
  { label: "Saved Palettes", href: "/admin/palettes", icon: Palette },
];

const OPERATIONS: NavItem[] = [
  { label: "Emails", href: "/admin/emails", icon: Mail },
  { label: "Color Management", href: "/admin/colors", icon: Paintbrush },
];

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavList({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item);
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={active}
              tooltip={item.label}
            >
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function AdminSidebar() {
  const pathname = usePathname() ?? "/admin";

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label="PokémonPalette home"
        >
          <Image
            src="/logo.png"
            alt=""
            width={32}
            height={32}
            priority
            className="size-8 shrink-0 rounded-md object-contain"
          />
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span
              className="truncate text-sm font-semibold"
              translate="no"
            >
              PokémonPalette
            </span>
            <span className="truncate text-xs text-muted-foreground">
              Admin Console
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(pathname, OVERVIEW)}
                  tooltip={OVERVIEW.label}
                >
                  <Link
                    href={OVERVIEW.href}
                    aria-current={
                      isActive(pathname, OVERVIEW) ? "page" : undefined
                    }
                  >
                    <OVERVIEW.icon aria-hidden="true" />
                    <span>{OVERVIEW.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavList items={MANAGEMENT} pathname={pathname} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavList items={OPERATIONS} pathname={pathname} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Back to App">
              <Link href="/">
                <ArrowLeft aria-hidden="true" />
                <span>Back to App</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex items-center justify-between gap-2 px-2 pt-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-0">
          <div className="group-data-[collapsible=icon]:hidden">
            <UserProfileWrapper />
          </div>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
