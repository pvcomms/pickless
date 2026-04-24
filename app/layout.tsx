import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pickless — stop choosing. start eating.",
  description:
    "One tap. Anywhere on earth. The agent picks your meal from the apps you already use, then orders it.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
