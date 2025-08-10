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

interface CreateTableModalProps {
  baseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateTableModal({ 
  baseId, 
  open, 
  onOpenChange,
  onSuccess 
}: CreateTableModalProps) {
  const [tableName, setTableName] = useState("");
  const [generateData, setGenerateData] = useState(true);

  const createTable = api.table.create.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      setTableName("");
      onSuccess?.();
    },
  });

  const handleCreate = () => {
    if (!tableName.trim()) return;
    
    createTable.mutate({
      baseId,
      name: tableName,
      generateSampleData: generateData,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Table</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium">Table Name</label>
            <Input
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="e.g., Customers, Products, Tasks"
              className="mt-1"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="generate"
              checked={generateData}
              onCheckedChange={(checked) => setGenerateData(!!checked)}
            />
            <label htmlFor="generate" className="text-sm">
              Generate 100 rows of sample data
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate}
            disabled={!tableName.trim() || createTable.isPending}
          >
            {createTable.isPending ? "Creating..." : "Create Table"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}