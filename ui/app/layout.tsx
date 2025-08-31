/*
 * Copyright 2025 SUPSI
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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