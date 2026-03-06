import { Train, Route, Users } from "lucide-react";

export type Agency = "GO" | "UP" | "TTC" | "MiWay";

export type VehicleType = "train" | "subway" | "tram" | "bus";

export interface Vehicle {
  id: string;
  agency: Agency;
  routeId: string;
  routeLabel: string;
  vehicleType: VehicleType;
  lat: number;
  lng: number;
  bearing: number;
  speed?: number;
  occupancy?: "LOW" | "MEDIUM" | "HIGH" | "FULL";
  timestamp: number;
}

export interface Departure {
  id: string;
  routeId: string;
  routeLabel: string;
  agency: Agency;
  destination: string;
  departureTime: Date;
  delayMinutes: number;
  platform?: string;
  occupancy?: "LOW" | "MEDIUM" | "HIGH" | "FULL";
  isLive: boolean;
}

export interface ServiceAlert {
  id: string;
  agency: Agency;
  severity: "info" | "warning" | "disruption";
  title: string;
  description: string;
  affectedRoutes: string[];
  startTime: Date;
  endTime?: Date;
}

export interface Stop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  agency: Agency;
}

export interface JourneyResult {
  id: string;
  routes: { routeId: string; routeLabel: string; agency: Agency }[];
  departureTime: Date;
  arrivalTime: Date;
  durationMinutes: number;
  transfers: number;
  stops: JourneyStop[];
}

export interface JourneyStop {
  name: string;
  time: Date;
  isCurrent?: boolean;
  isTransfer?: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  initials: string;
  score: number;
  isYou?: boolean;
}

/* Brand Guide v4 agency colors — HSL format for use with hsla() */
export const AGENCY_COLORS: Record<Agency, string> = {
  GO: "93 50% 56%",     // Transit Lime #8ECB5A
  UP: "210 74% 63%",    // Blue #5EA8E8
  TTC: "0 66% 63%",     // Red #E06060
  MiWay: "38 76% 54%",  // Amber #DFA832
};

export const TAB_ITEMS = [
  { id: "journey", label: "Journey", icon: Route, path: "/journey" },
  { id: "map", label: "Map", icon: Train, path: "/" },
  { id: "social", label: "Social", icon: Users, path: "/social" },
] as const;
