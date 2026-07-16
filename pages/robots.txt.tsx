import type { GetServerSideProps } from "next";
import { getSiteUrl } from "@/lib/siteMetadata";
export default function Robots() { return null; }
export const getServerSideProps: GetServerSideProps = async ({ res }) => { const base = getSiteUrl(); res.setHeader("Content-Type", "text/plain"); res.write(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`); res.end(); return { props: {} }; };
