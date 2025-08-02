import React, { useState } from "react";
import { Button, Link, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { useAuth } from "../../context/AuthContext";
import { withRouter } from "next/router";
import fetchUserRole from "../../server/fetchUser";
import { siteConfig } from "../../config/site";
import fetchLogout from "../../server/fetchLogout";
import { LogoIstSOS } from "../icons";
import i18n from "../../i18n";
import { useTranslation } from "react-i18next";

export const mainColor = siteConfig.main_color;

export default function UserBar({
    onLoginClick,

}) {
    const { token, setToken } = useAuth();
    const [selectedLang, setSelectedLang] = useState(i18n.language || "en");

    let username = "User";
    let isAdmin = false;

    if (token) {
        try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            username = payload.sub || "User";
            isAdmin = payload.role === "administrator" || false;
        } catch (e) {
            console.error("Error parsing token:", e);
            username = "User";
            isAdmin = false;
        }
    }

    //Available languages
    const languages = [
        { code: "en", label: "EN" },
        { code: "it", label: "IT" },
    ];
    const { t } = useTranslation();

    const handleLanguageChange = (langCode) => {
        i18n.changeLanguage(langCode);
        setSelectedLang(langCode);
    };

    return (
        <div
            style={{
                width: "100%",
                background: mainColor,
                color: "#fff",
                padding: "15px 75px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 14,
                minHeight: 36,
            }}
        >
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
                <Link isExternal aria-label="istSOS4" href={siteConfig.links.istSOS}>
                    <div style={{ width: 150, height: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <LogoIstSOS style={{ width: "100%", height: "auto" }} />
                    </div>
                </Link>
            </div>

            {/* User */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {token && (
                    <>
                        <span> {t("general.cheer")} <b>{username}</b></span>
                        <Button
                            radius="sm"
                            color="danger"
                            size="sm"
                            onPress={async () => {
                                if (token) await fetchLogout(token);
                                setToken(null);
                            }}
                            style={{ marginLeft: 8 }}
                        >
                            {t("general.logout")}
                        </Button>
                    </>
                )}

                {/* Language selector */}
                <Dropdown>
                    <DropdownTrigger>
                        <Button
                            radius="sm"
                            variant="flat"
                            size="sm">
                            {languages.find(lang => lang.code === selectedLang)?.label || selectedLang}
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Language selection">
                        {languages.map((lang) => (
                            <DropdownItem
                                key={lang.code}
                                onClick={() => handleLanguageChange(lang.code)}
                            >
                                {lang.label}
                            </DropdownItem>
                        ))}
                    </DropdownMenu>
                </Dropdown>
            </div>
        </div>
    );
}
