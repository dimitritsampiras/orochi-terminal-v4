// src/components/widgets/task-progress-widget.tsx
"use client";

import { useTaskQueue } from "@/lib/stores/task-queue";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function TaskProgressWidget() {
  const { tasks, clearCompleted, removeTask } = useTaskQueue();

  const activeTasks = tasks.filter((t) => t.status === "running" || t.status === "pending");
  const hasActive = activeTasks.length > 0;
  const latestActiveTask = activeTasks[0];

  // if (tasks.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "relative gap-2 transition-all duration-300 ease-out",
            hasActive && "animate-pulse",
            tasks.length === 0 ? "max-w-0 opacity-0 px-0" : "max-w-[300px] opacity-100"
          )}
        >
          <div className="flex items-center gap-2 overflow-clip">
            <Icon
              icon={hasActive ? "ph:spinner" : "ph:check-circle"}
              className={cn("size-4 shrink-0", hasActive && "animate-spin")}
            />
            {hasActive ? (
              <span className="text-xs whitespace-nowrap">
                {latestActiveTask?.progress}% - {latestActiveTask?.label}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground whitespace-nowrap">Tasks</span>
            )}
          </div>
          {activeTasks.length > 0 && (
            <span className="absolute -top-1 -right-1 size-3 bg-blue-500 text-white text-[10px] rounded-full flex items-center justify-center">
              {activeTasks.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Background Tasks</h4>
            <Button variant="ghost" size="sm" className="text-xs h-6" onClick={clearCompleted}>
              Clear completed
            </Button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tasks.map((task) => (
              <div key={task.id} className="p-2 rounded-md bg-muted/50 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium truncate flex-1">{task.label}</span>
                  <div className="flex items-center gap-1">
                    <TaskStatusBadge status={task.status} />
                    <button
                      onClick={() => removeTask(task.id)}
                      className="p-0.5 rounded hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
                      title="Remove task"
                    >
                      <Icon icon="ph:x" className="size-3" />
                    </button>
                  </div>
                </div>

                {(task.status === "running" || task.status === "pending") && (
                  <Progress value={task.progress} className="h-1" />
                )}

                <div className="text-[10px] text-muted-foreground">
                  {task.items.filter((i) => i.status === "completed").length}/{task.items.length} completed
                  {task.items.filter((i) => i.status === "failed").length > 0 && (
                    <span className="text-red-500 ml-1">
                      ({task.items.filter((i) => i.status === "failed").length} failed)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TaskStatusBadge({ status }: { status: string }) {
  const config = {
    pending: { icon: "ph:clock", color: "text-yellow-500" },
    running: { icon: "ph:spinner", color: "text-blue-500", spin: true },
    completed: { icon: "ph:check-circle-fill", color: "text-green-500" },
    failed: { icon: "ph:x-circle", color: "text-red-500" },
    cancelled: { icon: "ph:minus-circle", color: "text-gray-500" },
  }[status] || { icon: "ph:circle", color: "text-gray-500" };

  return <Icon icon={config.icon} className={cn("size-3.5", config.color, config.spin && "animate-spin")} />;
}
