"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

export function UserTheme() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    let user = pathname.match(/^\/u\/(JK|HE)(?:\/|$)/)?.[1];
    if (/^\/(test|exam|result|studio)(?:\/|$)/.test(pathname)) {
      try {
        user = document.cookie.match(/(?:^|;\s*)mockly_user=(JK|HE)(?:;|$)/)?.[1];
      } catch { /* Use the default palette when the preference is unavailable. */ }
    }
    if (user) document.documentElement.setAttribute("data-user-theme", user);
    else document.documentElement.removeAttribute("data-user-theme");
  }, [pathname]);

  return null;
}
