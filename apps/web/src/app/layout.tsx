import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MarkView — Markdown Documentation Viewer",
  description: "Zero-account, privacy-first markdown documentation viewer. Drag, drop, and read beautifully rendered markdown with Mermaid diagrams, syntax highlighting, and more.",
  keywords: ["markdown", "viewer", "documentation", "mermaid", "diagrams", "privacy", "mcp", "offline"],
  manifest: "/manifest.json",
  openGraph: {
    title: "MarkView — The markdown viewer your docs deserve",
    description: "Beautiful rendering, full-text search, split view, presentation mode, built-in editor, and 15 MCP tools for AI assistants. Your files never leave the browser.",
    url: "https://github.com/abgnydn/markview",
    siteName: "MarkView",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "MarkView — The markdown viewer your docs deserve" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MarkView — The markdown viewer your docs deserve",
    description: "Beautiful rendering, full-text search, split view, editor, 15 MCP tools. Privacy-first — your files never leave the browser.",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MarkView",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#0d1117",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.variable} antialiased`}>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
