import { Button, buttonVariants } from "@/components/ui/button";
import { authorizePageUser } from "@/lib/core/auth/authorize-user";
import { Icon } from "@iconify/react";
import { ArrowRightIcon, BookOpenIcon } from "lucide-react";
import Link from "next/link";

// blank server component
export default async function DashboardPage() {
  await authorizePageUser('dashboard');
  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <Link
        href="/sessions/create"
        className={buttonVariants({
          variant: "outline",
          className:
            "mt-4 h-18 bg-white! hover:bg-zinc-50! text-black! hover:text-black! w-full flex items-center justify-between! px-8!",
        })}
      >
        <div className="flex items-center gap-2">
          {/* <Icon icon="ph:book-open" className="size-4" /> */}
          <BookOpenIcon className="size-4" />
          Create a new session
        </div>
        <ArrowRightIcon className="size-4 text-zinc-400" />
      </Link>
    </div>
  );
}
