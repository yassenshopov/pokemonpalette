"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  SIDEBAR_COOKIE_MAX_AGE,
  SIDEBAR_COOKIE_NAME,
} from "@/lib/sidebar-cookie";

interface SidebarStateContextValue {
  isCollapsed: boolean;
  setIsCollapsed: Dispatch<SetStateAction<boolean>>;
  toggleCollapsed: () => void;
}

const SidebarStateContext = createContext<SidebarStateContextValue | null>(
  null
);

/**
 * Read-and-write hook for the collapsible sidebar's persisted state.
 *
 * The provider seeds initial state from the `sidebar_collapsed` cookie that
 * the root layout reads server-side, so SSR and client hydration agree on the
 * first frame.
 */
export function useSidebarState(): SidebarStateContextValue {
  const ctx = useContext(SidebarStateContext);
  if (!ctx) {
    throw new Error(
      "useSidebarState must be used within a SidebarStateProvider."
    );
  }
  return ctx;
}

interface SidebarStateProviderProps {
  /** Initial collapsed value, typically read from the cookie on the server. */
  defaultCollapsed: boolean;
  children: React.ReactNode;
}

export function SidebarStateProvider({
  defaultCollapsed,
  children,
}: SidebarStateProviderProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Persist to cookie when the user toggles the sidebar. Skip the very first
  // render so we don't immediately rewrite the cookie that just seeded us.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    document.cookie = `${SIDEBAR_COOKIE_NAME}=${
      isCollapsed ? "true" : "false"
    }; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
  }, [isCollapsed]);

  const toggleCollapsed = useCallback(
    () => setIsCollapsed((c) => !c),
    [setIsCollapsed]
  );

  return (
    <SidebarStateContext.Provider
      value={{ isCollapsed, setIsCollapsed, toggleCollapsed }}
    >
      {children}
    </SidebarStateContext.Provider>
  );
}
