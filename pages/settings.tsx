import { useEffect } from "react";
import { useRouter } from "next/router";

export default function SettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/profile");
  }, [router]);

  return null;
}
