import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Knightfall — A good day for a great move",
  description: "Your next great move starts here. Play free chess against Stockfish, invite a friend, and discover the story behind every move with real engine analysis.",
  applicationName: "Knightfall",
  icons: { icon: "/favicon.svg" },
  openGraph: { title: "Knightfall — Let's play chess", description: "Play a friend. Challenge Stockfish. Find your next great move.", type: "website" }
};
export const viewport: Viewport = { themeColor: "#172b25", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}