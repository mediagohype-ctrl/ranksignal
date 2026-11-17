"use client";
// The server layout works out what this account can see (offer, what is switched on, Expert mode, number of
// websites) and hands it down once; the sidebar, page tabs, mobile bar and top bar all read the same menu.
import { createContext, useContext, useMemo } from "react";
import { buildMenu, DEFAULT_MENU_INPUT, type AppMenu, type MenuInput } from "@/components/app/nav";

const MenuContext = createContext<MenuInput>(DEFAULT_MENU_INPUT);

export function MenuProvider({ value, children }: { value: MenuInput; children: React.ReactNode }) {
  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function useMenuInput(): MenuInput {
  return useContext(MenuContext);
}

export function useAppMenu(): AppMenu {
  const input = useContext(MenuContext);
  return useMemo(() => buildMenu(input), [input]);
}
