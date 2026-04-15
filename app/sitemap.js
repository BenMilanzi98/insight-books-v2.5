const base =
  (typeof process.env.NEXT_PUBLIC_APP_URL === "string" && process.env.NEXT_PUBLIC_APP_URL.trim()) ||
  "https://insightbooksafrica.com";

const origin = base.replace(/\/$/, "");

/** Public marketing and legal URLs only */
const paths = [
  "",
  "/contact",
  "/terms",
  "/privacy",
  "/auth/login",
  "/auth/signup",
];

export default function sitemap() {
  const lastModified = new Date();
  return paths.map((path) => ({
    url: `${origin}${path}`,
    lastModified,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
