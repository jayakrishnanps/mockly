import type { Metadata, Viewport } from "next";
import { UserTheme } from "@/components/user-theme";
import "./globals.css";

// Apply the same route/preference rules as UserTheme before the first paint.
const userThemeScript = String.raw`(() => {
  const pathname = window.location.pathname;
  let user = pathname.match(/^\/u\/(JK|HE)(?:\/|$)/)?.[1];
  if (/^\/(test|exam|result|studio)(?:\/|$)/.test(pathname)) {
    try {
      user = document.cookie.match(/(?:^|;\s*)mockly_user=(JK|HE)(?:;|$)/)?.[1];
    } catch {}
  }
  if (user) document.documentElement.setAttribute("data-user-theme", user);
  else document.documentElement.removeAttribute("data-user-theme");
})();`;

export const metadata: Metadata = {
  title: { default: "Mockly — Your practice space", template: "%s | Mockly" },
  description: "A simple, focused space for JK and HE to practise SSC mock tests.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: userThemeScript }} /></head>
      <body className="min-h-full flex flex-col"><UserTheme />{children}</body>
    </html>
  );
}
