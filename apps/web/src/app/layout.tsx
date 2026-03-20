import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MarkView — The Embeddable Markdown Rendering Stack",
  description: "A high-performance markdown engine available as a React SDK, Web Component, and native macOS App. Built with Shiki, Mermaid, KaTeX, and MCP for AI assistants.",
  keywords: ["markdown", "viewer", "documentation", "mermaid", "diagrams", "sdk", "react", "mcp", "offline"],
  manifest: "/manifest.json",
  openGraph: {
    title: "MarkView — The Embeddable Markdown Rendering Stack",
    description: "A high-performance markdown engine available as a React SDK, Web Component, and native macOS App. Ready to embed in your closed-source applications.",
    url: "https://github.com/abgnydn/markview",
    siteName: "MarkView",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "MarkView — The embeddable Markdown rendering stack & native macOS app" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MarkView — The Embeddable Markdown Rendering Stack",
    description: "A high-performance markdown engine available as a React SDK, Web Component, and native macOS App.",
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
  viewportFit: "cover",
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
        <script defer data-domain="markview.ai" src="https://plausible.io/js/script.js" /></head>
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
