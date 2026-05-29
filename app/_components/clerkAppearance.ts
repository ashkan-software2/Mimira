// Themes the Clerk <SignIn/> and <SignUp/> widgets with the app's design tokens.
// Values reference CSS custom properties so the widget follows light/dark mode
// alongside the rest of the admin (see app/globals.css). Typed structurally at the
// `appearance={...}` prop on each page rather than against @clerk/types (not installed).
export const authAppearance = {
  variables: {
    colorPrimary: "var(--fg)",
    colorText: "var(--fg)",
    colorTextSecondary: "var(--fg-muted)",
    colorBackground: "var(--surface)",
    colorInputBackground: "var(--surface)",
    colorInputText: "var(--fg)",
    colorDanger: "#dc2626",
    // Base radius governs buttons + inputs (6px per DESIGN-UI.md radius hierarchy).
    borderRadius: "var(--radius-sm)",
    fontFamily: "var(--font-sans)",
  },
  elements: {
    rootBox: { width: "100%" },
    // Panel = 8px radius, border-only. DESIGN-UI.md: shadows are reserved for modals.
    cardBox: {
      width: "100%",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)",
    },
    card: { backgroundColor: "var(--surface)" },
    footer: { background: "transparent" },
  },
};
