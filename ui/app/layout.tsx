"use client";
import React from "react";
import { heroui, HeroUIProvider, Divider, Button } from "@heroui/react";
import { CustomNavbar } from "../components/bars/customNavbar";
import Footer from "../components/bars/footer";
import UserBar from "../components/bars/userbar";
import { siteConfig } from "../config/site";
import { AuthProvider, useAuth } from "../context/AuthContext";
import LoginModal from "../components/LoginModal";

import "./globals.css";

export const mainColor = siteConfig.main_color;

function LayoutContent({ children }: { children: React.ReactNode }) {
  const [loginOpen, setLoginOpen] = React.useState(false);
  const { token } = useAuth();

  const handleCreateUser = () => {

    alert("to implement");
  };


  return (
    <>

      <CustomNavbar />
      <UserBar
        onLoginClick={() => setLoginOpen(true)}
        onCreateUserClick={handleCreateUser}
      />
      
      <Divider
        style={{backgroundColor: "white", height: 1, margin: "8px 0",}}
        ></Divider>
        
      <HeroUIProvider>
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
        {children}
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
          <LayoutContent>{children}</LayoutContent>
        </AuthProvider>

      </body>
    </html>
  );
}