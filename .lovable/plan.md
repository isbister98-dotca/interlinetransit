

## Navigation Restructure and Layout Fix

### Overview
Reduce bottom nav to 3 tabs (Journey | Map | Social), merge alerts into Journey, add user profile header + stats to Social, and fix the map bottom sheet so it sits above the nav bar without overlapping.

### Changes

#### 1. Reduce TAB_ITEMS to 3 tabs (`src/lib/types.ts`)
- Remove `alerts` and `profile` entries
- Reorder to: Journey, Map, Social (Map stays center as the primary tab)

#### 2. Update routing (`src/App.tsx`)
- Remove `/alerts` route (or redirect to `/journey`)
- Keep `/profile` as a hidden route (accessible from Social tab header)
- Change default redirect from `/map` to `/map` (no change needed)

#### 3. Merge alerts into Journey tab (`src/pages/JourneyScreen.tsx`)
- Import `MOCK_ALERTS`, alert icons, `RouteChip`, severity styles from AlertsScreen
- Add a "Service Alerts" section below the journey results
- Include the same alert card layout (severity left-border, icon, description, affected route chips)
- Show "All services running normally" empty state when no alerts

#### 4. Add user profile header + stats to Social tab (`src/pages/SocialScreen.tsx`)
- Add a tappable profile row at the top: avatar circle (YU) + "Your Name" + ChevronRight, linking to `/profile`
- Add a compact 4-stat horizontal strip below: 72 trips | 48 kg CO2 | LW most used | 12-day streak
- Keep existing leaderboard content below unchanged

#### 5. Fix map bottom sheet spacing (`src/pages/MapScreen.tsx`)
- The bottom sheet currently uses `bottom-0` which overlaps the nav bar
- Change the map container height to `h-[calc(100dvh-72px)]` to account for the nav bar (~60px + margin)
- Change the bottom sheet to position above the nav by using `bottom-[72px]` or adjusting the parent container so `bottom-0` aligns above the nav
- Adjust collapsed height from `h-[30%]` to a fixed pixel value or percentage that fits cleanly
- The key fix: the map screen's outer container should account for the nav bar height, and the bottom sheet should sit within that space

### Technical Details

**`src/lib/types.ts`** -- lines 86-92:
```typescript
export const TAB_ITEMS = [
  { id: "journey", label: "Journey", icon: Route, path: "/journey" },
  { id: "map", label: "Map", icon: Train, path: "/map" },
  { id: "social", label: "Social", icon: Users, path: "/social" },
] as const;
```

**`src/App.tsx`**:
- Remove AlertsScreen import and route
- Keep ProfileScreen import and `/profile` route (hidden from nav)

**`src/pages/MapScreen.tsx`**:
- Change outer container to `h-[calc(100dvh-72px)]` to leave room for nav
- Bottom sheet uses `bottom-0` within this container, so it naturally sits above the nav
- Collapsed sheet height stays at `h-[30%]`, expanded at `h-[70%]` -- these percentages now reference the shorter container

**`src/pages/JourneyScreen.tsx`**:
- Add imports: `AlertTriangle`, `AlertCircle`, `Info`, `CheckCircle2`, `MOCK_ALERTS`, `RouteChip`
- Add `SEVERITY_STYLES` map
- After the journey results section, add a divider and "Service Alerts" heading
- Render alert cards with severity border, icon, title, route chips, description

**`src/pages/SocialScreen.tsx`**:
- Add imports: `useNavigate`, `ChevronRight`, `Train`, `Leaf`, `Flame`, `MapPin`
- Add profile header row at top (tappable, navigates to `/profile`)
- Add stats strip: 4 items in a horizontal row with dividers between them
- Existing leaderboard content remains below

### Files Modified
- `src/lib/types.ts`
- `src/App.tsx`
- `src/pages/MapScreen.tsx`
- `src/pages/JourneyScreen.tsx`
- `src/pages/SocialScreen.tsx`
