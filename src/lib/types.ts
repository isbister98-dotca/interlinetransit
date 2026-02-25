import { Train, Route, AlertTriangle, Users, User } from "lucide-react";

export type Agency = "GO" | "UP" | "TTC" | "MiWay";

export interface Vehicle {
  id: string;
  agency: Agency;
  routeId: string;
  routeLabel: string;
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

export const AGENCY_COLORS: Record<Agency, string> = {
  GO: "82 85% 55%",    // lime green (brand)
  UP: "210 100% 52%",  // blue
  TTC: "0 72% 51%",    // red
  MiWay: "38 92% 50%", // amber
};

export const TAB_ITEMS = [
  { id: "map", label: "Map", icon: Train, path: "/map" },
  { id: "journey", label: "Journey", icon: Route, path: "/journey" },
  { id: "alerts", label: "Alerts", icon: AlertTriangle, path: "/alerts" },
  { id: "social", label: "Social", icon: Users, path: "/social" },
  { id: "profile", label: "Profile", icon: User, path: "/profile" },
] as const;
