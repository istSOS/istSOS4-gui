import { heroui, HeroUIProvider } from "@heroui/react";
import { CustomNavbar } from "../components/bars/customNavbar";
import { siteConfig } from "../config/site";

import "./globals.css";

export const mainColor = siteConfig.main_color;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: mainColor }}>
        <CustomNavbar />
        {children}
      </body>
    </html>
  );
}