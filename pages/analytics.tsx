import { useEffect } from "react";
import { useRouter } from "next/router";

export default function AnalyticsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/profile");
  }, [router]);

  return null;
}
