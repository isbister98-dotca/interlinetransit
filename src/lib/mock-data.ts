import type { Vehicle, Departure, ServiceAlert, LeaderboardEntry, JourneyResult } from "./types";

const now = () => new Date();
const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000);

export const MOCK_VEHICLES: Vehicle[] = [
  { id: "go-1", agency: "GO", routeId: "LW", routeLabel: "Lakeshore West", lat: 43.6453, lng: -79.3806, bearing: 270, speed: 65, occupancy: "MEDIUM", timestamp: Date.now() },
  { id: "go-2", agency: "GO", routeId: "LE", routeLabel: "Lakeshore East", lat: 43.6532, lng: -79.3654, bearing: 90, speed: 72, occupancy: "LOW", timestamp: Date.now() },
  { id: "go-3", agency: "GO", routeId: "KI", routeLabel: "Kitchener", lat: 43.6588, lng: -79.4098, bearing: 310, speed: 58, occupancy: "HIGH", timestamp: Date.now() },
  { id: "up-1", agency: "UP", routeId: "UP", routeLabel: "UP Express", lat: 43.6615, lng: -79.4107, bearing: 315, speed: 80, occupancy: "LOW", timestamp: Date.now() },
  { id: "ttc-1", agency: "TTC", routeId: "1", routeLabel: "Line 1", lat: 43.6529, lng: -79.3849, bearing: 0, speed: 45, occupancy: "HIGH", timestamp: Date.now() },
  { id: "ttc-2", agency: "TTC", routeId: "2", routeLabel: "Line 2", lat: 43.6543, lng: -79.3907, bearing: 270, speed: 42, occupancy: "MEDIUM", timestamp: Date.now() },
  { id: "ttc-3", agency: "TTC", routeId: "501", routeLabel: "501 Queen", lat: 43.6489, lng: -79.3951, bearing: 90, speed: 18, occupancy: "FULL", timestamp: Date.now() },
  { id: "miway-1", agency: "MiWay", routeId: "1", routeLabel: "1 Dundas", lat: 43.5890, lng: -79.6441, bearing: 180, speed: 35, occupancy: "LOW", timestamp: Date.now() },
  { id: "miway-2", agency: "MiWay", routeId: "2", routeLabel: "2 Cooksville", lat: 43.5956, lng: -79.6123, bearing: 0, speed: 28, occupancy: "MEDIUM", timestamp: Date.now() },
];

export const MOCK_DEPARTURES: Departure[] = [
  { id: "d1", routeId: "LW", routeLabel: "Lakeshore West", agency: "GO", destination: "Hamilton", departureTime: minutesFromNow(3), delayMinutes: 0, platform: "3", occupancy: "MEDIUM", isLive: true },
  { id: "d2", routeId: "LE", routeLabel: "Lakeshore East", agency: "GO", destination: "Oshawa", departureTime: minutesFromNow(8), delayMinutes: 2, platform: "5", occupancy: "LOW", isLive: true },
  { id: "d3", routeId: "UP", routeLabel: "UP Express", agency: "UP", destination: "Pearson Airport", departureTime: minutesFromNow(12), delayMinutes: 0, platform: "1", occupancy: "LOW", isLive: true },
  { id: "d4", routeId: "KI", routeLabel: "Kitchener", agency: "GO", destination: "Kitchener", departureTime: minutesFromNow(22), delayMinutes: 5, platform: "8", occupancy: "HIGH", isLive: true },
  { id: "d5", routeId: "1", routeLabel: "Line 1", agency: "TTC", destination: "Finch", departureTime: minutesFromNow(1), delayMinutes: 0, occupancy: "HIGH", isLive: true },
];

export const MOCK_ALERTS: ServiceAlert[] = [
  { id: "a1", agency: "GO", severity: "disruption", title: "Lakeshore West — Reduced Service", description: "Signal problems near Exhibition. Trains running every 30 minutes instead of 15.", affectedRoutes: ["LW"], startTime: now() },
  { id: "a2", agency: "TTC", severity: "warning", title: "Line 1 — Minor Delays", description: "Due to a medical emergency at Bloor-Yonge, expect delays of 5–10 minutes.", affectedRoutes: ["1"], startTime: now() },
  { id: "a3", agency: "GO", severity: "info", title: "Kitchener Line — Weekend Schedule", description: "Kitchener line operating on weekend schedule Feb 28 – Mar 2.", affectedRoutes: ["KI"], startTime: now() },
];

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: "Sarah K.", initials: "SK", score: 142 },
  { rank: 2, name: "David L.", initials: "DL", score: 128 },
  { rank: 3, name: "Emily R.", initials: "ER", score: 115 },
  { rank: 4, name: "Mike T.", initials: "MT", score: 98 },
  { rank: 5, name: "Lisa C.", initials: "LC", score: 87 },
  { rank: 6, name: "James W.", initials: "JW", score: 76 },
  { rank: 7, name: "You", initials: "YU", score: 72, isYou: true },
  { rank: 8, name: "Anna P.", initials: "AP", score: 65 },
  { rank: 9, name: "Tom H.", initials: "TH", score: 53 },
  { rank: 10, name: "Nina S.", initials: "NS", score: 41 },
];

export const MOCK_JOURNEY_RESULTS: JourneyResult[] = [
  {
    id: "j1",
    routes: [
      { routeId: "1", routeLabel: "Line 1", agency: "TTC" },
      { routeId: "LW", routeLabel: "Lakeshore West", agency: "GO" },
    ],
    departureTime: minutesFromNow(5),
    arrivalTime: minutesFromNow(52),
    durationMinutes: 47,
    transfers: 1,
    stops: [
      { name: "Queen Station", time: minutesFromNow(5) },
      { name: "Union Station", time: minutesFromNow(15), isTransfer: true, isCurrent: true },
      { name: "Exhibition", time: minutesFromNow(25) },
      { name: "Mimico", time: minutesFromNow(35) },
      { name: "Port Credit", time: minutesFromNow(45) },
      { name: "Clarkson", time: minutesFromNow(52) },
    ],
  },
  {
    id: "j2",
    routes: [{ routeId: "501", routeLabel: "501 Queen", agency: "TTC" }],
    departureTime: minutesFromNow(2),
    arrivalTime: minutesFromNow(68),
    durationMinutes: 66,
    transfers: 0,
    stops: [
      { name: "Queen & Yonge", time: minutesFromNow(2) },
      { name: "Queen & Spadina", time: minutesFromNow(18), isCurrent: true },
      { name: "Queen & Dufferin", time: minutesFromNow(32) },
      { name: "Queen & Roncesvalles", time: minutesFromNow(45) },
      { name: "Long Branch", time: minutesFromNow(68) },
    ],
  },
];
