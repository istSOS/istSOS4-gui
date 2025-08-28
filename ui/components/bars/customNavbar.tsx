'use client';

import React from "react";
import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarBrand,
  NavbarItem,
} from "@heroui/navbar";
import { Link } from "@heroui/link";
import { siteConfig } from "../../config/site";
import { GithubIcon } from "../../components/icons";

const secondaryColor = siteConfig.secondary_color;

export function CustomNavbar() {
  return (
    <div
      style={{
        width: "100%",
        background: secondaryColor,
        padding: "6px 75px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 35,
        boxSizing: "border-box",
      }}
    >
      
      <span className="text-white select-none" style={{ fontSize: '15px', fontWeight: 500 }}>
        Discussions
      </span>
      
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link
          isExternal
          aria-label="Source Code"
          href={siteConfig.links.github}
          className="flex items-center justify-center h-full text-white font-light text-base select-none"
          style={{ fontSize: '15px', textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}
        >
          Source Code
          <GithubIcon className="text-white" />
        </Link>
      </span>
    </div>
  );
}