"use client";

import { useState, useEffect } from "react";
import { useLocalServer } from "@/lib/hooks/use-local-server";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Icon } from "@iconify/react";
import { toast } from "sonner";

export function ProfileController() {
  const { config, updateConfig, isConfigLoaded, checkFileExists } = useLocalServer();
  const [arxpPath, setArxpPath] = useState(config.arxpFolderPath);
  const [hasChanges, setHasChanges] = useState(false);
  const [pathExists, setPathExists] = useState(false);

  useEffect(() => {
    if (!isConfigLoaded || !arxpPath) return;
    checkFileExists(arxpPath).then(setPathExists);
  }, [arxpPath, isConfigLoaded, checkFileExists]);

  const handleSave = () => {
    updateConfig({ arxpFolderPath: arxpPath });
    setHasChanges(false);
    toast.success("Settings saved");
  };

  const handleChange = (value: string) => {
    setArxpPath(value);
    setHasChanges(value !== config.arxpFolderPath);
  };

  if (!isConfigLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="space-y-2">
        <Label htmlFor="arxp-path">ARXP Folder Path</Label>
        <div className="flex items-center gap-2">
          <Input
            id="arxp-path"
            value={arxpPath}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="/path/to/ARXP"
          />
          {pathExists && (
            <Icon icon="ph:check-circle" className="size-5 text-green-500 shrink-0" />
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Local path to the ARXP folder for file operations
        </p>
      </div>

      <Button onClick={handleSave} disabled={!hasChanges}>
        Save
      </Button>
    </div>
  );
}

