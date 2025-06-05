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
import {
  GithubIcon,
  LogoIstSOS,
} from "../../components/icons";

export const secondaryColor = siteConfig.secondary_color;

export function CustomNavbar() {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <HeroUINavbar
      maxWidth="xl"
      position="sticky"
      style={{ backgroundColor: secondaryColor}}
      className="max-h-[35px]"
    >

      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand as="li" className="gap-3 max-w-fit">
          <Link
            //isExternal
            className="flex justify-start items-center gap-1"
            //href={siteConfig.links.istSOS}
            href="/"

          >
            <LogoIstSOS className="h-5 w-20 text-white" />
          </Link>
        </NavbarBrand>
      </NavbarContent>


      <NavbarContent className="basis-1/5 sm:basis-full" justify="end">
        <NavbarItem className="flex items-center justify-center h-full">
          <Link
            isExternal
            aria-label="Github"
            href={siteConfig.links.github}
            className="flex items-center justify-center h-full"
          >
            <GithubIcon className="text-white" />
          </Link>
        </NavbarItem>
      </NavbarContent>

    </HeroUINavbar>
  );
}