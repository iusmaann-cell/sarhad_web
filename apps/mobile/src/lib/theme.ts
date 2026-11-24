import { useColorScheme } from "react-native";

// Brand colours (placeholders until final brand assets). Mirrors packages/ui/src/theme.css.
const palette = {
  light: {
    background: "#FAF7F2",
    card: "#FFFFFF",
    text: "#2A211C",
    muted: "#7A706A",
    primary: "#8A1C14",
    primaryText: "#FFFFFF",
    border: "#E8E0D6",
    danger: "#C0261C",
    success: "#2E7D4F",
  },
  dark: {
    background: "#1E1916",
    card: "#29221E",
    text: "#F4EFE8",
    muted: "#B5AAA0",
    primary: "#E0704F",
    primaryText: "#1E1916",
    border: "#3D342E",
    danger: "#E5584D",
    success: "#4FB27A",
  },
};

export type Palette = (typeof palette)["light"];

export function useTheme(): Palette {
  return palette[useColorScheme() === "dark" ? "dark" : "light"];
}

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
