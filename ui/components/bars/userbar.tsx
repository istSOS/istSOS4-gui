import React, { useState, useEffect } from "react";
import {
    Button,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    Input,
    Link,
} from "@heroui/react";
import { DateTime } from "luxon";
import { LogoIstSOS } from "../icons";
import { useAuth } from "../../context/AuthContext";
import fetchLogout from "../../server/fetchLogout";
import { siteConfig } from "../../config/site";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n";

const mainColor = siteConfig.main_color;

export default function UserBar({ onLoginClick }) {
    const { token, setToken } = useAuth();
    const [selectedLang, setSelectedLang] = useState(i18n.language || "en");
    
    const [timeshift, setTimeshift] = useState(0);
    const [clock, setClock] = useState(
        DateTime.now().plus({ hours: timeshift }).toFormat("HH:mm:ss")
    );
    const { t } = useTranslation();

    let username = "User";
    let isAdmin = false;
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            username = payload.sub || "User";
            isAdmin = payload.role === "administrator" || false;
        } catch (e) {
            console.error("Error parsing token:", e);
        }
    }

    const languages = [
        { code: "en", label: "EN" },
        { code: "it", label: "IT" },
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setClock(DateTime.now().plus({ hours: timeshift }).toFormat("HH:mm:ss"));
        }, 1000);
        return () => clearInterval(interval);
    }, [timeshift]);

    const handleLanguageChange = (langCode) => {
        i18n.changeLanguage(langCode);
        setSelectedLang(langCode);
    };

    // Handle timeshift magnitude change
    const handleMagnitudeChange = (event) => {
        const raw = event.target.value;
        const val = Math.max(0, Number(raw) || 0);
        setTimeshift(prev => (prev >= 0 ? val : -val));
    };

    // Toggle sign
    const toggleSign = () => {
        setTimeshift(ts => -ts);
    };

    const sign = timeshift >= 0 ? "+" : "-";
    const absVal = Math.abs(timeshift);

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
                    <div
                        style={{
                            width: 150,
                            height: "auto",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <LogoIstSOS style={{ width: "100%", height: "auto" }} />
                    </div>
                </Link>
            </div>

            {/* Clock + Timeshift (format: HH:mm:ss UTC ± n) */}
            <div
                style={{ display: "flex", alignItems: "center", fontSize: 30 }}
                
            >
                <span>{clock} UTC</span>
                <div style={{ display: "flex", alignItems: "center" }}>
                    
                    <Button
                        size="sm"
                        radius="sm"
                        variant="light"
                        onPress={toggleSign}
                        aria-label="Toggle sign"
                        style={{ fontSize: 20, minWidth: 1, color: "white" }}
                    >
                        {sign}
                    </Button>
                    <Input
                        size="md"
                        variant="bordered"
                        type="number"
                        min={0}
                        value={String(absVal)}
                        onChange={handleMagnitudeChange}
                        style={{ width: 40, fontSize: 20}}
                        placeholder="0"
                    />
                    
                </div>
            </div>

            {/* User + Language */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {token && (
                    <>
                        <span>
                            {t("general.cheer")} <b>{username}</b>
                        </span>
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
                {/* Language Selector */}
                <Dropdown>
                    <DropdownTrigger>
                        <Button radius="sm" variant="flat" size="sm">
                            {languages.find((lang) => lang.code === selectedLang)?.label ||
                                selectedLang}
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