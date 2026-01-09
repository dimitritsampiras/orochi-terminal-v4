import { GateScanController } from "@/components/controllers/gate-scan-controller";
import { authorizePageUser } from "@/lib/core/auth/authorize-user";

export default async function GateScanPage() {
  await authorizePageUser("gate-scan");

  return <GateScanController />;
}
