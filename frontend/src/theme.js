// frontend/src/theme.js
// Central brand theme — applied globally so every MUI page gets the brand
// look (gradients, interactive hover states, professional surfaces) without
// any change to page logic.
import { createTheme } from "@mui/material/styles";

/* ─── Brand palette ─────────────────────────────────────────────────────── */
export const BRAND = {
  blue: "#096dca",
  blueDark: "#075399",
  blueLight: "#3f93e0",
  orange: "#fc5b32",
  orangeDark: "#d8401c",
  orangeLight: "#ff8160",
  ink: "#0f2747",
  inkSub: "#5b6f9c",
};

/* ─── Reusable gradients (import where a brand gradient is wanted) ───────── */
export const gradients = {
  brand: `linear-gradient(135deg, ${BRAND.blue} 0%, ${BRAND.orange} 100%)`,
  brandSoft: `linear-gradient(135deg, ${BRAND.blueLight} 0%, ${BRAND.orangeLight} 100%)`,
  blue: `linear-gradient(135deg, ${BRAND.blue} 0%, ${BRAND.blueDark} 100%)`,
  orange: `linear-gradient(135deg, ${BRAND.orange} 0%, ${BRAND.orangeDark} 100%)`,
  sidebar: `linear-gradient(160deg, ${BRAND.blueDark} 0%, #0a3e74 55%, #0f2747 100%)`,
  page: "linear-gradient(180deg, #f4f8fd 0%, #eaf2fb 100%)",
};

const theme = createTheme({
  palette: {
    primary: {
      main: BRAND.blue,
      dark: BRAND.blueDark,
      light: BRAND.blueLight,
      contrastText: "#ffffff",
    },
    secondary: {
      main: BRAND.orange,
      dark: BRAND.orangeDark,
      light: BRAND.orangeLight,
      contrastText: "#ffffff",
    },
    background: { default: "#f4f8fd", paper: "#ffffff" },
    text: { primary: BRAND.ink, secondary: "#5b6f9c" },
  },

  shape: { borderRadius: 12 },

  typography: {
    fontFamily: "'DM Sans', 'Inter', 'Roboto', 'Helvetica', sans-serif",
    button: { textTransform: "none", fontWeight: 700 },
    h4: { fontWeight: 800, letterSpacing: "-0.02em" },
    h5: { fontWeight: 800, letterSpacing: "-0.02em" },
    h6: { fontWeight: 700, letterSpacing: "-0.01em" },
  },

  components: {
    /* Global baseline: page background gradient + branded scrollbars */
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: gradients.page,
          backgroundAttachment: "fixed",
        },
        "*::-webkit-scrollbar": { width: 10, height: 10 },
        "*::-webkit-scrollbar-track": { background: "transparent" },
        "*::-webkit-scrollbar-thumb": {
          background: `linear-gradient(180deg, ${BRAND.blueLight}, ${BRAND.blue})`,
          borderRadius: 8,
          border: "2px solid transparent",
          backgroundClip: "content-box",
        },
        "*::-webkit-scrollbar-thumb:hover": {
          background: `linear-gradient(180deg, ${BRAND.blue}, ${BRAND.orange})`,
          backgroundClip: "content-box",
        },
      },
    },

    /* Buttons — brand gradient for primary/secondary contained, with lift.
       Error/success/inherit and custom sx styling are left untouched. */
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: ({ ownerState }) => ({
          borderRadius: 10,
          textTransform: "none",
          fontWeight: 700,
          letterSpacing: "0.01em",
          transition:
            "transform .2s ease, box-shadow .25s ease, filter .25s ease, background .25s ease",
          ...(ownerState.variant === "contained" &&
            ["primary", "secondary"].includes(ownerState.color) && {
              background:
                ownerState.color === "secondary"
                  ? gradients.orange
                  : gradients.blue,
              boxShadow:
                ownerState.color === "secondary"
                  ? "0 6px 16px rgba(252,91,50,0.32)"
                  : "0 6px 16px rgba(9,109,202,0.30)",
              "&:hover": {
                transform: "translateY(-2px)",
                filter: "brightness(1.06)",
                boxShadow:
                  ownerState.color === "secondary"
                    ? "0 10px 24px rgba(252,91,50,0.45)"
                    : "0 10px 24px rgba(9,109,202,0.45)",
              },
              "&:active": { transform: "translateY(0)" },
            }),
          ...(ownerState.variant === "outlined" && {
            "&:hover": {
              transform: "translateY(-1px)",
              background: "rgba(9,109,202,0.06)",
            },
          }),
        }),
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: "transform .2s ease, background .2s ease",
          "&:hover": { transform: "translateY(-1px)" },
        },
      },
    },

    /* Rounded, soft surfaces */
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 16 },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          border: "1px solid rgba(9,109,202,0.10)",
          transition: "transform .25s ease, box-shadow .25s ease",
          "&:hover": {
            transform: "translateY(-4px)",
            boxShadow: "0 18px 44px rgba(9,109,202,0.16)",
          },
        },
      },
    },

    /* Inputs — rounded with a brand focus glow */
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: "box-shadow .2s ease",
          "&.Mui-focused": {
            boxShadow: "0 0 0 4px rgba(9,109,202,0.14)",
          },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 600 },
      },
    },

    /* Branded navigation accents */
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: 3,
          background: gradients.orange,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600 },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        colorPrimary: { backgroundImage: gradients.blue },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: BRAND.ink,
          fontSize: 12,
          borderRadius: 8,
          padding: "6px 10px",
        },
        arrow: { color: BRAND.ink },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        bar: { backgroundImage: gradients.brand },
      },
    },
  },
});

export default theme;
