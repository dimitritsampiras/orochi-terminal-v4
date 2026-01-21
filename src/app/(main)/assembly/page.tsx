import { AssemblyTable } from "@/components/table/assembly-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { db } from "@/lib/clients/db";
import { authorizePageUser } from "@/lib/core/auth/authorize-user";
import { getAssemblyLine } from "@/lib/core/session/create-assembly-line";

import { Icon } from "@iconify/react";

export default async function AssemblyPage() {
  await authorizePageUser("assembly");
  const activeSession = await db.query.batches.findMany({
    where: {
      active: true,
    },
  });

  if (activeSession.length > 1) {
    return (
      <div>
        <h1 className="page-title mb-4">Assembly</h1>
        <Alert variant="destructive">
          <Icon icon="ph:warning-circle" />
          <AlertTitle>Multiple active sessions</AlertTitle>
          <AlertDescription>There are multiple active sessions, cannot load assembly line.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (activeSession.length === 0) {
    return (
      <div>
        <h1 className="page-title mb-4">Assembly</h1>
        <Alert>
          <Icon icon="ph:info" />
          <AlertTitle>No active sessions</AlertTitle>
          <AlertDescription>There are no active sessions, cannot load assembly line.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { data, error } = await getAssemblyLine(activeSession[0].id);

  if (error || !data) {
    return (
      <div>
        <h1 className="page-title mb-4">Assembly</h1>
        <Alert variant="destructive">
          <Icon icon="ph:warning-circle" />
          <AlertTitle>Error generating assembly line</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (activeSession[0].startedAt === null) {
    return (
      <div>
        <h1 className="page-title mb-4">Assembly</h1>
        <Alert>
          <Icon icon="ph:info" />
          <AlertTitle>Session not started</AlertTitle>
          <AlertDescription>Session not started, cannot load assembly line.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Assembly</h1>
      <div className="text-sm text-muted-foreground">Session: {activeSession[0].id}</div>
      {data.removedItemIds.length > 0 && (
        <Alert className="my-4">
          <Icon icon="ph:info" />
          <AlertTitle>Items removed from assembly line</AlertTitle>
          <AlertDescription>
            {data.removedItemIds.length} item(s) were removed from this session (e.g., due to hold resolution) and are
            no longer in the assembly line.
          </AlertDescription>
        </Alert>
      )}
      <AssemblyTable assemblyLine={data.lineItems} batchId={activeSession[0].id} />
    </div>
  );
}
