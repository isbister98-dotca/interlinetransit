

# Fix: Search Results Showing Wrong Names for Buildings/Landmarks

## Problem
When searching for landmarks like "CN Tower" or "Rogers Centre", the Nominatim API returns correct results, but the name displayed in the dropdown is wrong. For example, CN Tower shows as "Bremner Boulevard" because the code extracts the name in this order:

```
d.address?.amenity || d.address?.building || d.address?.road || d.name
```

Since CN Tower's address has `road: "Bremner Boulevard"` but no `amenity` or `building` field (it uses `man_made`), the road name takes priority over the actual place name (`d.name = "CN Tower"`).

## Fix

**File: `src/lib/osm-api.ts`** (line 49)

Change the name extraction order to prioritize `d.name` first, then fall back to address components:

```
name: d.name || d.address?.amenity || d.address?.building || d.address?.road || d.display_name?.split(",")[0] || "Unknown"
```

This single-line change ensures that landmarks, stadiums, towers, and other named places use their proper name rather than a nearby street name.

## Technical Detail

- The Nominatim API returns a top-level `name` field for named features (e.g., `"CN Tower"`, `"Rogers Centre"`)
- Address sub-fields like `amenity`, `building`, `road` are more granular but not always appropriate as the display name
- Putting `d.name` first ensures we always use the canonical name when available

