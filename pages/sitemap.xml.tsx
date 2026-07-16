import type { GetServerSideProps } from "next";
import { getSiteUrl } from "@/lib/siteMetadata";
export default function Sitemap() { return null; }
export const getServerSideProps: GetServerSideProps = async ({ res }) => { const base = getSiteUrl(); const routes = ["", "/practice", "/training", "/passages", "/leaderboard", "/faq", "/terms", "/privacy", "/security"]; const urls = routes.map((route) => `<url><loc>${base}${route}</loc><changefreq>weekly</changefreq></url>`).join(""); res.setHeader("Content-Type", "application/xml"); res.write(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`); res.end(); return { props: {} }; };
