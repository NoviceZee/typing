import type { GetServerSideProps } from "next";
import { buildSitemapXml } from "@/lib/siteMetadata";
export default function Sitemap() { return null; }
export const getServerSideProps: GetServerSideProps = async ({ res }) => { res.setHeader("Content-Type", "application/xml"); res.write(buildSitemapXml()); res.end(); return { props: {} }; };
