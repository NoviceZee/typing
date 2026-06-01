import { ReactNode } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export function AdminOnly({ children }: { children: ReactNode }) {
  return <ProtectedRoute adminOnly>{children}</ProtectedRoute>;
}
