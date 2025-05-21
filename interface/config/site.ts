export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "istSOS4 admin ui",
  navItems: [
    {
      label: "Home",
      href: "/",
    },
    {
      label: "Database",
      href: "/database",
    },
    {
      label: "Service provider",
      href: "/serviceprovider",
    },
    {
      label: "Service identification",
      href: "/serviceidentification",
    },



  ],
  navMenuItems: [
    {
      label: "Profile",
      href: "/profile",
    },
    {
      label: "Dashboard",
      href: "/dashboard",
    },
    {
      label: "Projects",
      href: "/projects",
    },
    {
      label: "Team",
      href: "/team",
    },
    {
      label: "Calendar",
      href: "/calendar",
    },
    {
      label: "Settings",
      href: "/settings",
    },
    {
      label: "Help & Feedback",
      href: "/help-feedback",
    },
    {
      label: "Logout",
      href: "/logout",
    },
  ],
  links: {
    github: "https://github.com/LucaBTE/istSOS4-gui",
    sponsor: "https://patreon.com/jrgarciadev",
  },
};
