import React from "react";
import { siteConfig } from "../../config/site";

export default function Footer() {
    return (
        <footer
            style={{
                backgroundColor: siteConfig.secondary_color,
                color: "white",
                textAlign: "center",
                padding: "12px 0",
                fontSize: "1rem",
                position: "initial",
                left: 0,
                bottom: 0,
                width: "100%",
                zIndex: 100,
            }}
        >
            <a
                href="https://www.supsi.ch/ist"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "white", textDecoration: "none" }}
            >
                © {new Date().getFullYear()} Open Source Software by Institute of Earth Science - SUPSI
            </a>
        </footer>
    );
}