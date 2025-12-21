import { Spinner } from "@/components/ui/spinner";

export default function CreateSessionPageLoading() {
  return (
    <div>
      <h1 className="page-title">Create Session</h1>
      <div className="w-full h-full bg-zinc-100 rounded-lg p-4 flex flex-col items-center justify-center mt-4 gap-2">
        <div>Loading order queue</div>
        <Spinner />
      </div>
    </div>
  );
}
