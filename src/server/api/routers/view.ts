import z from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// Define the view config schema
const viewConfigSchema = z.object({
  sortRules: z.array(z.object({
    id: z.string(),
    columnId: z.string(),
    columnName: z.string(),
    columnType: z.string(),
    direction: z.enum(['asc', 'desc'])
  })).default([]),
  filterRules: z.array(z.object({
    id: z.string(),
    columnId: z.string(),
    columnName: z.string(),
    columnType: z.enum(['TEXT', 'NUMBER']),
    operator: z.enum(['is_empty', 'is_not_empty', 'contains', 'not_contains', 'equals', 'greater_than', 'less_than']),
    value: z.union([z.string(), z.number()]).optional()
  })).default([]),
  hiddenColumns: z.array(z.string()).default([])
});

export const viewRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      tableId: z.string(),
      name: z.string().min(1).max(255),
      config: viewConfigSchema
    }))
    .mutation(async ({ ctx, input }) => {
      const view = await ctx.db.view.create({
        data: {
          tableId: input.tableId,
          name: input.name,
          config: input.config,
          isDefault: false
        }
      });
      return view;
    }),

  list: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      let views = await ctx.db.view.findMany({
        where: { tableId: input.tableId },
        orderBy: [
          { isDefault: 'desc' }, // Default view first
          { createdAt: 'asc' }    // Then by creation order
        ]
      });
      
      // If no views exist for this table, create a default view
      if (views.length === 0) {
        console.log('No views found for table', input.tableId, '- creating default view');
        
        // First verify the table exists
        const table = await ctx.db.table.findUnique({
          where: { id: input.tableId }
        });
        
        if (table) {
          const defaultView = await ctx.db.view.create({
            data: {
              tableId: input.tableId,
              name: "Grid view",
              config: {
                sortRules: [],
                filterRules: [],
                hiddenColumns: []
              },
              isDefault: true
            }
          });
          views = [defaultView];
        }
      }
      
      return views;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(255).optional(),
      config: viewConfigSchema.optional()
    }))
    .mutation(async ({ ctx, input }) => {
      console.log('View update mutation called with:', input);
      const { id, ...updateData } = input;
      console.log('Updating view:', id, 'with data:', updateData);
      
      const view = await ctx.db.view.update({
        where: { id },
        data: updateData
      });
      
      console.log('View updated successfully:', view.id);
      return view;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Prevent deletion of default views
      const view = await ctx.db.view.findUnique({
        where: { id: input.id },
        select: { isDefault: true }
      });

      if (view?.isDefault) {
        throw new Error("Cannot delete the default view");
      }

      const deletedView = await ctx.db.view.delete({
        where: { id: input.id }
      });
      return deletedView;
    }),

  setDefault: protectedProcedure
    .input(z.object({
      id: z.string(),
      tableId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // First, unset all default views for this table
      await ctx.db.view.updateMany({
        where: { tableId: input.tableId },
        data: { isDefault: false }
      });

      // Then set the specified view as default
      const view = await ctx.db.view.update({
        where: { id: input.id },
        data: { isDefault: true }
      });
      return view;
    }),

  getDefaultViewName: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get all existing view names to find next available number
      const existingViews = await ctx.db.view.findMany({
        where: { tableId: input.tableId },
        select: { name: true }
      });
      
      const existingNames = new Set(existingViews.map(view => view.name));
      console.log('Existing view names:', Array.from(existingNames));
      
      // If no "Grid view" exists, return that
      if (!existingNames.has("Grid view")) {
        console.log('No "Grid view" exists, returning "Grid view"');
        return "Grid view";
      }
      
      // Find the next available number
      let nextNumber = 2;
      while (existingNames.has(`Grid ${nextNumber}`)) {
        nextNumber++;
      }
      
      console.log('Generated view name:', `Grid ${nextNumber}`);
      return `Grid ${nextNumber}`;
    })
});