import z from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

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
      console.log(`🔄 Cell update requested - RowID: ${input.rowId}, ColumnID: ${input.columnId}, Value:`, input.value);

  const normalizedValue =
  typeof input.value === "string"
    ? { text: input.value }
    : typeof input.value === "number"
    ? { number: input.value }
    : input.value; // if already object { text: string }

  console.log(`📝 Normalized value:`, normalizedValue);

  try {
    const cell = await ctx.db.cell.upsert({
  where: {
    rowId_columnId: {
      rowId: input.rowId,
      columnId: input.columnId,
    },
  },
  update: {
    value: normalizedValue,   
  },
  create: {
    rowId: input.rowId,
    columnId: input.columnId,
    value: normalizedValue, 
  },
});
    
    console.log(`Cell updated successfully - ID: ${cell.id}, RowID: ${input.rowId}, ColumnID: ${input.columnId}, Value:`, normalizedValue);
    return cell;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch(e: any) {
    console.log(`❌ Cell update error - Code: ${e?.code}, Message: ${e?.message}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (e?.code === 'P2003') {
      // Foreign key constraint failure - row or column doesn't exist
      console.log(`🚫 Foreign key constraint failed - ROW_OR_COLUMN_NOT_READY`);
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'ROW_OR_COLUMN_NOT_READY' });
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (e?.code === 'P2002') {
      // Unique constraint failure - cell already exists, try to find and return it
      console.log(`🔄 Unique constraint failed, trying to find existing cell`);
      try {
        const existingCell = await ctx.db.cell.findFirst({
          where: {
            rowId: input.rowId,
            columnId: input.columnId,
          },
        });
        if (existingCell) {
          // Update the existing cell with the new value
          const updatedCell = await ctx.db.cell.update({
            where: { id: existingCell.id },
            data: { value: normalizedValue },
          });
          console.log(`Cell updated after unique constraint error - ID: ${updatedCell.id}, RowID: ${input.rowId}, ColumnID: ${input.columnId}, Value:`, normalizedValue);
          return updatedCell;
        }
      } catch (findError) {
        console.error("Failed to find existing cell after unique constraint error:", findError);
      }
    }

    console.log(`💥 Unhandled error in cell update:`, e);
    throw e;
  }

    }),
});