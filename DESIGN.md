# Design System: Netflix-Style Movie & Series Cards

## 1. Design Overview

Create a cinematic media card system inspired by Netflix's browsing experience. The design should feel premium, immersive, dark, and content-focused, with large artwork, minimal text, smooth hover interactions, and clear playback actions.

### Design Principles

- **Artwork First:** Movie and series posters are the primary visual element.
- **Dark Cinematic UI:** Use a dark background to make poster artwork stand out.
- **Progressive Disclosure:** Reveal additional information and actions on hover or focus.
- **Smooth Interactions:** Use subtle scaling, fading, and elevation transitions.
- **Responsive by Default:** Adapt card dimensions and grid density to the available screen space.

## 2. Color Palette

| Token            | Hex       | Usage                             |
| ---------------- | --------- | --------------------------------- |
| Background       | `#141414` | Main application background       |
| Surface          | `#181818` | Card information panel            |
| Elevated Surface | `#232323` | Hovered card background           |
| Primary          | `#E50914` | Play buttons and selected actions |
| Text Primary     | `#FFFFFF` | Titles and primary content        |
| Text Secondary   | `#B3B3B3` | Metadata and descriptions         |
| Progress Track   | `#595959` | Watch progress background         |
| Progress Fill    | `#E50914` | Watched progress                  |
| Badge Background | `#E50914` | Exclusive or featured badges      |

## 3. Card Variants

Support three primary card types.

### A. Standard Movie Card

Designed for movies, documentaries, and standalone films.

- Poster aspect ratio: `2:3`
- Default appearance: Poster image only, with optional small badges.
- Hover appearance: Enlarged card with a floating information panel.
- Information: Title, release year, maturity rating, duration, and genres.
- Actions: Play, add to My List, like/dislike, and more information.

### B. Series Card

Designed for television series and episodic content.

- Poster aspect ratio: `2:3`
- Information: Series title, release year, number of seasons, maturity rating, and genres.
- Optional badge: "New Episodes" or "New Season".
- Optional episode progress indicator.
- Actions: Play, add to My List, and more information.

### C. Continue Watching Card

Designed for content the user has already started watching.

- Thumbnail aspect ratio: `16:9`
- Always-visible progress bar beneath the image.
- Information: Title, season and episode, or remaining runtime.
- Actions: Resume playback, restart, and remove from Continue Watching.
- Optional remaining-time label.

## 4. Standard Card Dimensions

Use these dimensions as starting points. Adjust them according to the parent container.

| Property           | Desktop   | Tablet    | Mobile    |
| ------------------ | --------- | --------- | --------- |
| Poster width       | 180–220px | 140–180px | 110–140px |
| Poster ratio       | 2:3       | 2:3       | 2:3       |
| Border radius      | 4px       | 4px       | 3px       |
| Grid gap           | 16px      | 12px      | 8px       |
| Hover scale        | 1.08–1.12 | 1.03      | 1.0       |
| Animation duration | 250–350ms | 200ms     | 150ms     |

Use a consistent poster ratio within each browsing row. Avoid stretching artwork to fit different card sizes.

## 5. Default Card Appearance

The default state should prioritize the artwork.

### Poster

- Use a high-quality poster image with `object-fit: cover`.
- Apply a subtle dark gradient near the bottom when badges or text overlay the artwork.
- Keep the poster image edge-to-edge.
- Use a fallback placeholder if artwork is unavailable.
- Avoid unnecessary borders and shadows.

### Badges

Position badges inside the poster without obstructing important artwork.

Examples:

- `NEW`
- `TOP 10`
- `NEW SEASON`
- `4K`
- `UHD`

Use compact typography, uppercase labels, and strong contrast. Reserve red for important highlights rather than displaying every badge in red.

### Image Overlay

Optional bottom-left overlays can display:

- A small Netflix-inspired brand mark or content-type indicator.
- A compact title label when the poster artwork has no readable title.
- A "Recently Added" label.

Do not display all metadata on the default card. The artwork should remain the dominant element.

## 6. Hover and Focus Interaction

On desktop, hovering over a card should reveal a floating preview panel.

### Animation Sequence

1. Wait approximately `150ms` before expanding the card.
2. Scale the card to approximately `1.08–1.12`.
3. Bring the card above neighboring cards using an elevated stacking order.
4. Reveal the information panel with a short fade and vertical movement.
5. Display playback and secondary action buttons.
6. Restore the original state when the pointer leaves.

Use `transform` and `opacity` for smooth animations. Avoid animating layout properties such as width and height when possible.

### Expanded Card Content

Display the following information in order:

1. Playback and secondary action buttons.
2. Match percentage or user rating, if available.
3. Maturity rating, runtime or season count, and release year.
4. A short genre list.
5. Optional progress bar for partially watched content.

Keep descriptions short. Use a maximum of two or three lines.

### Hover Panel Styling

- Background: `#181818`
- Text: `#FFFFFF`
- Secondary text: `#B3B3B3`
- Shadow: Soft, deep shadow for separation from the page.
- Border radius: `4px`
- Information padding: `12–16px`

The expanded card must not be clipped by its parent container. Account for horizontal and vertical edges of the viewport when positioning the preview.

### Keyboard and Touch Behavior

- Keyboard focus should reveal the same essential information as hover.
- Provide a visible focus indicator.
- On touch devices, tapping the card should open a detail view or preview.
- Do not rely on hover as the only way to access playback actions.

## 7. Action Buttons

### Play Button

- Shape: Circular.
- Size: `36–44px`.
- Background: White.
- Icon: Black play triangle.
- Hover: Slightly increase scale and reduce background brightness.
- Purpose: Start or resume playback immediately.

### Add to My List

- Shape: Circular.
- Background: Transparent or dark gray.
- Border: `1px solid rgba(255,255,255,0.6)`.
- Icon: Plus symbol.
- Selected state: Change to a checkmark.
- Tooltip: "Add to My List" or "Remove from My List".

### More Information

- Shape: Circular.
- Icon: Chevron-down or information symbol.
- Purpose: Open the movie or series detail view.

### Like / Dislike

Optional secondary actions.

- Use recognizable icons.
- Clearly indicate the selected state.
- Keep these actions visually secondary to Play.

Buttons should have at least a `36px` interactive area on desktop and preferably `44px` on touch devices.

## 8. Continue Watching Design

Continue Watching cards use a landscape thumbnail rather than a portrait poster.

### Layout

- Thumbnail ratio: `16:9`.
- Title and episode details below the image.
- Progress bar directly beneath the thumbnail.
- Optional remaining time, such as "32m left".

### Progress Bar

- Track color: `#595959`.
- Progress color: `#E50914`.
- Height: `3–4px`.
- No unnecessary animation during initial rendering.

### Additional Controls

- Resume playback.
- Restart from the beginning.
- Remove from Continue Watching.

Place secondary controls in a small overlay or context menu to avoid cluttering the thumbnail.

## 9. Content Metadata

Use consistent metadata formatting.

**Movie example:**

`2025 · 16+ · 2h 08m · Thriller`

**Series example:**

`2024 · 18+ · 3 Seasons · Drama`

**Continue Watching example:**

`Season 2: Episode 4 · 32m left`

Optional match scores, ratings, audio formats, and subtitle availability should only appear when the application has reliable data for them.

Do not fabricate match percentages or review scores.

## 10. Responsive Layout

### Desktop

- Display enough cards to fill the available row without making posters too small.
- Use horizontal scrolling for categorized browsing rows.
- Allow hover previews to overlap adjacent cards.
- Reserve extra space around the row to accommodate expanded cards.

### Tablet

- Reduce card dimensions and spacing.
- Keep the horizontal browsing experience.
- Reduce hover scaling to avoid excessive overlap.

### Mobile

- Disable desktop-style hover expansion.
- Use horizontal scrolling for recommendation rows.
- Make essential actions available through a tap or detail page.
- Prevent accidental navigation while horizontal scrolling.
- Keep text readable and buttons touch-friendly.

## 11. Accessibility

- Provide meaningful alt text for poster images.
- Ensure text contrast meets WCAG AA where applicable.
- Do not communicate content status through color alone.
- Support keyboard navigation.
- Respect `prefers-reduced-motion`.
- Provide accessible labels for icon-only buttons.
- Preserve a clear focus state.
- Ensure truncated titles remain available to assistive technology.

## 12. Loading, Error, and Empty States

### Loading

- Display a poster-shaped skeleton placeholder.
- Match the final card's aspect ratio to prevent layout shifts.
- Use subtle shimmer animation only when motion is permitted.

### Missing Artwork

- Display a neutral dark placeholder.
- Show the title in a readable layout.
- Never display a broken-image icon.

### Failed Content

- Keep the card layout intact.
- Provide a fallback image and a clear title.
- Do not expose technical error messages inside the card.

### Empty Continue Watching

- Hide the section if there is no content to display, or show an intentional empty state with a browsing action.

## 13. Suggested Component Structure

```text
MediaCard/
├── MediaCard
├── PosterImage
├── CardBadges
├── HoverPreview
├── MediaMetadata
├── CardActions
├── WatchProgress
└── MediaCardSkeleton
```

Recommended component variants:

```ts
type MediaCardVariant = "movie" | "series" | "continue-watching";
```

Keep content data separate from presentation. The same card components should support different titles, artwork, ratings, genres, and playback progress without duplicating the visual implementation.

## 14. Motion Guidelines

| Interaction         | Duration | Easing        |
| ------------------- | -------- | ------------- |
| Card expansion      | 300ms    | `ease-out`    |
| Information fade-in | 200ms    | `ease-out`    |
| Button hover        | 150ms    | `ease-in-out` |
| Card collapse       | 200ms    | `ease-in`     |
| Badge appearance    | 180ms    | `ease-out`    |

Avoid excessive bouncing, rotation, and dramatic movement. The overall experience should feel smooth, controlled, and cinematic.

## 15. Final Acceptance Criteria

- Movie and series cards use portrait posters with consistent aspect ratios.
- Continue Watching cards use landscape thumbnails and progress indicators.
- Desktop cards reveal additional metadata and actions on hover or keyboard focus.
- Mobile cards remain usable without hover.
- Play, My List, and More Information actions have distinct behavior.
- Cards support loading, missing-artwork, and empty states.
- Layout remains stable when artwork loads.
- Cards do not get clipped by horizontal scrolling containers.
- Typography, spacing, badges, and action buttons remain visually consistent.
- Reduced-motion preferences are respected.

**Final Design Direction:** A clean, dark, cinematic media browser with artwork-driven cards, understated metadata, polished hover previews, and responsive behavior. Prioritize content discovery and playback speed over decorative UI.
