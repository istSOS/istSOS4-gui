"use client";
import React from "react";
import "../i18n"; //Import i18n configuration
import { heroui, HeroUIProvider, Divider, Button } from "@heroui/react";
import { CustomNavbar } from "../components/bars/customNavbar";
import Footer from "../components/bars/footer";
import UserBar from "../components/bars/userbar";
import { siteConfig } from "../config/site";
import { AuthProvider, useAuth } from "../context/AuthContext";
import LoginModal from "../components/modals/LoginModal";
import { TimezoneProvider } from "../context/TimezoneContext";

import "./globals.css";
import { EntitiesProvider } from "../context/EntitiesContext";

export const mainColor = siteConfig.main_color;

function LayoutContent({ children }: { children: React.ReactNode }) {
  const [loginOpen, setLoginOpen] = React.useState(false);
  const { token, loading } = useAuth();


  if (loading) return null;
  if (!token) {
    return (
      <>
        <LoginModal open={true} onClose={() => { }} />

      </>
    );
  }

  return (
    <>
      <CustomNavbar />
      <UserBar
        onLoginClick={() => setLoginOpen(true)}
      />
      <Divider
        style={{ backgroundColor: "white", height: 1, margin: "8px 0" }}
      />
      <HeroUIProvider>
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
        <div style={{ paddingLeft: 50, paddingRight: 50, width: "100%", boxSizing: "border-box" }}>
          {children}
        </div>
      </HeroUIProvider>
      <Footer />
    </>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <html lang="en">
      <body style={{ backgroundColor: mainColor }} className="min-h-screen">

        <AuthProvider>
          <EntitiesProvider>
            <TimezoneProvider>
              <LayoutContent>{children}</LayoutContent>
            </TimezoneProvider>
          </EntitiesProvider>
        </AuthProvider>

      </body>
    </html>
  );
}