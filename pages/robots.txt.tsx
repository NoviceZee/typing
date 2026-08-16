import type { GetServerSideProps } from "next";
import { buildRobotsTxt } from "@/lib/siteMetadata";
export default function Robots() { return null; }
export const getServerSideProps: GetServerSideProps = async ({ res }) => { res.setHeader("Content-Type", "text/plain"); res.write(buildRobotsTxt()); res.end(); return { props: {} }; };
