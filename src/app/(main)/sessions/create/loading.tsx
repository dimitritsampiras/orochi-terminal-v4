import { Spinner } from "@/components/ui/spinner";

export default function CreateSessionPageLoading() {
  return (
    <div>
      <h1 className="page-title">Create Session</h1>
      <div className="w-full h-full flex items-center justify-center">
        <div>Loading order queue...</div>
        <Spinner />
      </div>
    </div>
  );
}
