# Design Direction: YouTube-Style Video Player

## 1. Identity & Purpose
A sleek, responsive desktop video player modeled after modern YouTube web player interface. Designed for precision control, fast scrubbing, multi-format media playback, keyboard-driven navigation, and zero-distraction viewing.

## 2. Visual Theme & Palette
- Background: `#0f0f0f` (Deep dark YouTube background)
- Surface / Control panels: `#212121` with high-legibility contrasts
- Highlight / Scrubber Accent: `#ff0000` (YouTube Signature Red)
- Text Primary: `#f1f1f1` (WCAG AAA compliant on `#0f0f0f` with > 14:1 contrast ratio)
- Text Secondary: `#aaaaaa` (WCAG AA compliant with > 5:1 contrast ratio)
- Focus Indicator: 2px solid `#3ea6ff` (YouTube focus blue ring, high visibility for keyboard navigation)

## 3. Typography
- Font Family: "YouTube Sans", "Roboto", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif.
- Monospace Numbers for Timestamps: `tabular-nums` for clock readouts so timestamps do not jitter when ticking.

## 4. UI States
- **Empty State**: Centered intuitive drag-and-drop zone with clear file picker button and accepted format list.
- **Loading State**: Circular YouTube buffering spinner with smooth rotation.
- **Playing / Paused State**: Full video viewport with responsive bottom controls and autohide timer.
- **Error State**: Informative diagnostic card with retry and fallback options.

## 5. Dials
- ENERGY: 2 (Focused, media-centric, responsive)
- RHYTHM: 2 (Logical grouping of transport controls, timestamps, and secondary actions)
- MOTION: 2 (Smooth 200ms transitions for controls fade, tooltip positioning, and speed badges)

