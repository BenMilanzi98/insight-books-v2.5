/**
 * Authenticated dashboard — do not index (avoids private metrics appearing in search snippets).
 */
export const metadata = {
  title: "Dashboard",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function DashboardLayout({ children }) {
  return children;
}
