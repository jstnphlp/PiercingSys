"use client";

import { useEffect } from "react";

export type SettingsSection = "hours" | "services" | "team" | "notifications";

export function SettingsSectionFocus({ section }: { section: SettingsSection | null }) {
  useEffect(() => {
    if (!section) return;
    const target = document.getElementById(sectionTargetIds[section]);
    if (!target) return;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    target.focus({ preventScroll: true });
  }, [section]);

  return null;
}

const sectionTargetIds: Record<SettingsSection, string> = {
  hours: "studio-settings-hours",
  services: "studio-settings-services",
  team: "studio-settings-team",
  notifications: "studio-settings-notifications",
};
