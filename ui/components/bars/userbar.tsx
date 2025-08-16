import React, { useState, useEffect } from "react";
import {
    Button,
    ButtonGroup,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    Input,
    Link,
} from "@heroui/react";
import { DateTime } from "luxon";
import moment from "moment-timezone";
import { LogoIstSOS, ChevronDownIcon } from "../icons";
import { useAuth } from "../../context/AuthContext";
import fetchLogout from "../../server/fetchLogout";
import { siteConfig } from "../../config/site";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n";
import { useTimezone } from "../../context/TimezoneContext";

const mainColor = siteConfig.main_color;

// Only these timezones shown by default
const commonTimezones = [
    "UTC",
    "America/Los_Angeles",
    "America/New_York",
    "Asia/Shanghai",
    "Asia/Tokyo",
    "Europe/London",
    "Europe/Rome",
];

export default function UserBar({ onLoginClick }) {
    const { token, setToken } = useAuth();
    const [selectedLang, setSelectedLang] = useState(i18n.language || "en");
    const { timezone, setTimezone } = useTimezone();
    const [clock, setClock] = useState(
        DateTime.now().setZone(timezone).toFormat("HH:mm:ss")
    );

    const [searchTerm, setSearchTerm] = useState("");
    const [allTimezones] = useState(moment.tz.names());

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
            setClock(DateTime.now().setZone(timezone).toFormat("HH:mm:ss"));
        }, 1000);
        return () => clearInterval(interval);
    }, [timezone]);

    const handleLanguageChange = (langCode) => {
        i18n.changeLanguage(langCode);
        setSelectedLang(langCode);
    };

    // Logic: show common by default, all if searching
    const filteredTimezones =
        searchTerm.trim() === ""
            ? commonTimezones
            : allTimezones.filter((tz) =>
                tz.toLowerCase().includes(searchTerm.toLowerCase())
            );

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

            {/* Clock + Timezone */}
            <div
                style={{ display: "flex", alignItems: "center", fontSize: 30, gap: 12 }}
            >
                <span>{clock}</span>
                <ButtonGroup variant="flat">
                    <Button>{timezone}</Button>
                    <Dropdown placement="bottom-end">
                        <DropdownTrigger>
                            <Button isIconOnly>
                                <ChevronDownIcon />
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu
                            aria-label="Timezone selection"
                            selectionMode="single"
                            selectedKeys={new Set([timezone])}
                            onSelectionChange={(keys) =>
                                setTimezone(String(Array.from(keys)[0]))
                            }
                        >
                            <DropdownItem key="search-input" isReadOnly>
                                <Input
                                    size="sm"
                                    placeholder="Search timezones..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </DropdownItem>

                            <>
                                {filteredTimezones.map((tz) => (
                                    <DropdownItem key={tz}>{tz}</DropdownItem>
                                ))}
                            </>
                        </DropdownMenu>
                    </Dropdown>
                </ButtonGroup>
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
