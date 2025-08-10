"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Checkbox } from "~/components/ui/checkbox";

interface CreateBaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateBaseModal({ 
  open, 
  onOpenChange,
  onSuccess 
}: CreateBaseModalProps) {
  const [baseName, setBaseName] = useState("");
  const [createSampleTable, setCreateSampleTable] = useState(true);

  const createBase = api.base.create.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      setBaseName("");
      onSuccess?.();
    },
  });

  const handleCreate = () => {
    if (!baseName.trim()) return;
    
    createBase.mutate({
      name: baseName,
      createSampleTable,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Base</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium">Base Name</label>
            <Input
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              placeholder="e.g., Project Management, Customer CRM, Inventory"
              className="mt-1"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="sample"
              checked={createSampleTable}
              onCheckedChange={(checked) => setCreateSampleTable(!!checked)}
            />
            <label htmlFor="sample" className="text-sm">
              Create sample table with default columns
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate}
            disabled={!baseName.trim() || createBase.isPending}
          >
            {createBase.isPending ? "Creating..." : "Create Base"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}