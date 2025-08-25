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
      rowId: z.string().min(1),
      columnId: z.string().min(1),
      value: z.union([z.string(), z.number(), z.object({ text: z.string() })]),
    }))
    .mutation(async ({ ctx, input }) => {
      // Prepare the value based on type
      const cellValue = typeof input.value === 'string' 
        ? { text: input.value }
        : typeof input.value === 'number'
        ? { number: input.value }
        : input.value;

      // Find existing cell first, then update or create
      const existingCell = await ctx.db.cell.findFirst({
        where: {
          rowId: input.rowId,
          columnId: input.columnId,
        }
      });

      if (existingCell) {
        // Update existing cell
        const cell = await ctx.db.cell.update({
          where: { id: existingCell.id },
          data: { value: cellValue }
        });
        return cell;
      } else {
        // Create new cell
        const cell = await ctx.db.cell.create({
          data: {
            rowId: input.rowId,
            columnId: input.columnId,
            value: cellValue
          }
        });
        return cell;
      }
    }),
});