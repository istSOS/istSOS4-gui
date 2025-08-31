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
import { useTimezone } from "../../context/TimezoneContext";

const mainColor = siteConfig.main_color;

// Build RFC3339 datetime string applying an artificial hour shift (not a real timezone).
function buildShiftedRFC3339(shiftHours: number): string {
  const nowUtc = DateTime.utc(); // current UTC time
  const shifted = nowUtc.plus({ minutes: shiftHours * 60 });
  // Core datetime portion (no offset)
  const base = shifted.toFormat("yyyy-MM-dd'T'HH:mm:ss");
  if (shiftHours === 0) return base + "Z";
  // Build custom offset ±HH:MM from shiftHours
  const abs = Math.abs(shiftHours);
  const whole = Math.trunc(abs);
  const minutes = Math.round((abs - whole) * 60); // handles 0.5 etc.
  const sign = shiftHours > 0 ? "+" : "-";
  const hh = whole.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");
  return `${base}${sign}${hh}:${mm}`;
}

// Human readable label for the shift
function formatShiftLabel(h: number) {
  if (h === 0) return "UTC ±0h";
  const sign = h > 0 ? "+" : "-";
  const abs = Math.abs(h);
  const whole = Math.trunc(abs);
  const minutes = Math.round((abs - whole) * 60);
  const mm = minutes.toString().padStart(2, "0");
  return `UTC ${sign}${whole}:${mm}h`;
}

export default function UserBar({ onLoginClick }: { onLoginClick?: () => void }) {
  const { token, setToken } = useAuth();
  const { t } = useTranslation();
  const { timeShiftHours, setTimeShiftHours } = useTimezone();

  // RFC3339 datetime string with current applied shift
  const [rfc3339DateTime, setRfc3339DateTime] = useState<string>(
    buildShiftedRFC3339(timeShiftHours)
  );

  // Popup (slider) visibility
  const [showSlider, setShowSlider] = useState(false);
  const sliderWrapperRef = useRef<HTMLDivElement | null>(null);

  // Username from JWT token
  let username = "User";
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      username = payload.sub || "User";
    } catch (e) {
      console.error("Error parsing token:", e);
    }
  }

  // Language handling
  const languages = [
    { code: "en", label: "EN" },
    { code: "it", label: "IT" }
  ];
  const [selectedLang, setSelectedLang] = useState(i18n.language || "en");
  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    setSelectedLang(langCode);
  };

  // Update RFC3339 datetime every second (reacts also to shift changes)
  useEffect(() => {
    const interval = setInterval(() => {
      setRfc3339DateTime(buildShiftedRFC3339(timeShiftHours));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeShiftHours]);

  // Close slider on outside click
  useEffect(() => {
    if (!showSlider) return;
    const handleClick = (e: MouseEvent) => {
      if (sliderWrapperRef.current && !sliderWrapperRef.current.contains(e.target as Node)) {
        setShowSlider(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [showSlider]);

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
      {/* Logo section */}
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

      {/* Current shifted RFC3339 datetime (click to open shift panel) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: 18,
          cursor: "pointer",
          position: "relative",
          fontFamily: "monospace",
          gap: 8
        }}
        onClick={() => setShowSlider(s => !s)}
        aria-label="Current date-time with custom UTC shift"
        title="Click to adjust time shift"
      >
        <span>{rfc3339DateTime}</span>

        {formatShiftLabel(timeShiftHours)}


        {showSlider && (
          <div
            ref={sliderWrapperRef}
            style={{
              position: "absolute",
              top: "110%",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 2000,
              minWidth: 360
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

      {/* User + Language controls */}
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