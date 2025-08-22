import z from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const cellRouter = createTRPCRouter({
  findByRowColumn: protectedProcedure
    .input(z.object({
      rowId: z.string(),
      columnId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Find an existing cell by rowId and columnId
      const cell = await ctx.db.cell.findFirst({
        where: {
          rowId: input.rowId,
          columnId: input.columnId,
        },
      });
      return cell;
    }),

  create: protectedProcedure
    .input(z.object({
      rowId: z.string(),
      columnId: z.string(),
      value: z.union([z.string(), z.number(), z.object({ text: z.string() })]),
    }))
    .mutation(async ({ ctx, input }) => {
      // Create a new cell
      const cell = await ctx.db.cell.create({
        data: {
          rowId: input.rowId,
          columnId: input.columnId,
          value: typeof input.value === 'string' 
            ? { text: input.value }
            : typeof input.value === 'number'
            ? { number: input.value }
            : input.value
        },
      });
      return cell;
    }),

  update: protectedProcedure
    .input(z.object({
      cellId: z.string().optional(),
      rowId: z.string().optional(),
      columnId: z.string().optional(),
      value: z.union([z.string(), z.number(), z.object({ text: z.string() })]),
    }).refine((data) => data.cellId ?? (data.rowId && data.columnId), {
      message: "Either cellId or both rowId and columnId must be provided"
    }))
    .mutation(async ({ ctx, input }) => {
      // Try to update the cell value using either cellId or rowId+columnId
      try {
        let cell;
        
        if (input.cellId) {
          // Use cellId approach (legacy)
          cell = await ctx.db.cell.update({
            where: { id: input.cellId },
            data: { 
              value: typeof input.value === 'string' 
                ? { text: input.value }
                : typeof input.value === 'number'
                ? { number: input.value }
                : input.value
            },
          });
        } else if (input.rowId && input.columnId) {
          // Use composite key approach
          const existingCell = await ctx.db.cell.findUnique({
            where: {
              rowId_columnId: {
                rowId: input.rowId,
                columnId: input.columnId
              }
            }
          });
          
          if (existingCell) {
            cell = await ctx.db.cell.update({
              where: { id: existingCell.id },
              data: { 
                value: typeof input.value === 'string' 
                  ? { text: input.value }
                  : typeof input.value === 'number'
                  ? { number: input.value }
                  : input.value
              },
            });
          } else {
            throw new Error('Cell not found for given rowId and columnId');
          }
        }
        
        return cell;
      } catch (error) {
        // If cell doesn't exist, we might need to handle this differently
        // For now, let the error propagate to trigger the createCell fallback
        throw error;
      }
    }),
});