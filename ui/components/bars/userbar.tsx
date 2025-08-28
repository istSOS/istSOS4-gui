import React, { useState, useEffect, useRef } from "react";
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Link,
  Slider,
  Chip,
  Card
} from "@heroui/react";
import { DateTime } from "luxon";
import { LogoIstSOS } from "../icons";
import { useAuth } from "../../context/AuthContext";
import fetchLogout from "../../server/fetchLogout";
import { siteConfig } from "../../config/site";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n";

const mainColor = siteConfig.main_color;

export default function UserBar({ onLoginClick }: { onLoginClick?: () => void }) {
  const { token, setToken } = useAuth();
  const { t } = useTranslation();

  // Timeshift (in hours, can be negative, step 0.5)
  const [timeShiftHours, setTimeShiftHours] = useState<number>(0);
  const [clock, setClock] = useState(
    DateTime.now().plus({ minutes: timeShiftHours * 60 }).toFormat("HH:mm:ss")
  );

  const [showSlider, setShowSlider] = useState(false);
  const sliderWrapperRef = useRef<HTMLDivElement | null>(null);

  // Username / role from token
  let username = "User";
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      username = payload.sub || "User";
    } catch (e) {
      console.error("Error parsing token:", e);
    }
  }

  const languages = [
    { code: "en", label: "EN" },
    { code: "it", label: "IT" }
  ];
  const [selectedLang, setSelectedLang] = useState(i18n.language || "en");

  // Update clock every second including shift
  useEffect(() => {
    const interval = setInterval(() => {
      setClock(
        DateTime.now()
          .plus({ minutes: timeShiftHours * 60 })
            .toFormat("HH:mm:ss")
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [timeShiftHours]);

  // Close slider on outside click
  useEffect(() => {
    if (!showSlider) return;
    const handleClick = (e: MouseEvent) => {
      if (
        sliderWrapperRef.current &&
        !sliderWrapperRef.current.contains(e.target as Node)
      ) {
        setShowSlider(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [showSlider]);

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    setSelectedLang(langCode);
  };

  const formatShiftLabel = (h: number) => {
    if (h === 0) return "UTC ±0h";
    const sign = h > 0 ? "+" : "-";
    const abs = Math.abs(h);
    const whole = Math.trunc(abs);
    const half = abs - whole === 0.5;
    return `UTC ${sign}${whole}${half ? ".5" : ""}h`;
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
        position: "relative"
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
              justifyContent: "center"
            }}
          >
            <LogoIstSOS style={{ width: "100%", height: "auto" }} />
          </div>
        </Link>
      </div>

      {/* Clock (clickable) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: 30,
          cursor: "pointer",
          position: "relative"
        }}
        onClick={() => setShowSlider(s => !s)}
        aria-label="Time with UTC shift"
      >
        <span>
          {clock}
        </span>
        {showSlider && (
          <div
            ref={sliderWrapperRef}
            style={{
              position: "absolute",
              top: "110%",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 2000,
              minWidth: 340
            }}
          >
            <Card
              shadow="lg"
              className="p-4"
              
            >
              <div style={{ fontSize: 14, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600 }}>Time shift</span>
                <Chip size="sm" variant="flat" color="default">
                  {formatShiftLabel(timeShiftHours)}
                </Chip>
              </div>
              <Slider
                aria-label="Time shift (hours)"
                minValue={-24}
                maxValue={24}
                step={0.5}
                value={timeShiftHours}
                onChange={(val: number | number[]) =>
                  setTimeShiftHours(Array.isArray(val) ? val[0] : val)
                }
                marks={[
                  { value: -24, label: "-24" },
                  { value: -12, label: "-12" },
                  { value: 0, label: "0" },
                  { value: 12, label: "+12" },
                  { value: 24, label: "+24" }
                ]}
                showTooltip
                color="primary"
                size="sm"
                className="mb-2"
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  fontSize: 12,
                  opacity: 0.8
                }}
              >
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => {
                    setTimeShiftHours(0);
                  }}
                >
                  Reset
                </Button>
              </div>
            </Card>
          </div>
        )}
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
        {!token && (
            <Button
              radius="sm"
              color="primary"
              size="sm"
              onPress={() => onLoginClick && onLoginClick()}
            >
              Login
            </Button>
        )}
        <Dropdown>
          <DropdownTrigger>
            <Button radius="sm" variant="flat" size="sm">
              {languages.find(l => l.code === selectedLang)?.label || selectedLang}
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Language selection">
            {languages.map(lang => (
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