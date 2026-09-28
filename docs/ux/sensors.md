# Sensors — connect & scan (iOS list cells)

Applies to **Power meter** (`0x1818` / `0x2A63`) and **Heart rate** (`0x180D` / `0x2A37`, including Garmin Fenix Broadcast HR).

## Status

Done (Sept 2026): `src/components/SensorPanel.tsx`. Rows are full-width, enabled the moment a device appears, and the Searching spinner lives in the section header.

## Problem that was fixed

Scan results were hard to tap: either the row waited until scan finished, or only a small text span was hit-testable. Both sensors need the same fix.

## Target pattern (UITableView / inset grouped)

```
┌─────────────────────────────┐
│ < Settings   Power meter    │
│                             │
│ STATUS                      │
│ ┌─────────────────────────┐ │
│ │ Connected · SRAM …      │ │  or Not connected
│ │ Live: 210 W             │ │
│ │ [ Disconnect ]          │ │  destructive text, 44pt+
│ └─────────────────────────┘ │
│                             │
│ DEVICES                     │
│ ┌─────────────────────────┐ │
│ │ ████ Fenix 7        ›   │ │  FULL WIDTH row
│ │ ████ SRAM Force     ›   │ │  min height 52 pt
│ │ ████ Other meter    ›   │ │  tappable WHILE scanning
│ └─────────────────────────┘ │
│                             │
│     [  Scan again  ]        │  secondary
│  Scanning… (spinner OK)     │  does NOT block rows
└─────────────────────────────┘
```

### Interaction rules

1. Each discovered peripheral is one **full-bleed list row** (leading icon optional, title = device name, trailing chevron or signal).
2. **Hit target** = entire row bounds (≥44 pt, prefer 52–56 pt). Not just the label glyphs.
3. Rows are **enabled as soon as the device appears** in the scan results. Do not wait for scan timeout to enable presses.
4. Scanning indicator is status text / spinner outside the row; it must not cover the list or steal touches.
5. Tap row → connect → remember last device → auto-reconnect next launch / after drop.
6. Shared BLE radio: power and HR may share one manager; do not require exclusive lock that blocks the other forever.
7. Empty state: “No devices yet — pedal or enable Broadcast HR, then Scan.”
8. Permission denied: system-style explanation + Open Settings link.

### Home chips

Tapping a chip opens the same sensor screen. Chip is itself ≥44 pt tall and full chip bounds tappable.

### Accessibility

- `accessibilityRole` / traits = button on each row.
- VoiceOver label includes name + connection state.
- Do not rely on color alone for connected vs scanning.
