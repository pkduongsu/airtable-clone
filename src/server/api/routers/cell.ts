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

      // First, validate that the row and column exist
      const [row, column] = await Promise.all([
        ctx.db.row.findUnique({ where: { id: input.rowId }, select: { id: true, order: true } }),
        ctx.db.column.findUnique({ where: { id: input.columnId }, select: { id: true } })
      ]);

      if (!row) {
        throw new TRPCError({ 
          code: 'NOT_FOUND', 
          message: `ROW_NOT_FOUND: Row with ID ${input.rowId} does not exist` 
        });
      }

      if (!column) {
        throw new TRPCError({ 
          code: 'NOT_FOUND', 
          message: `COLUMN_NOT_FOUND: Column with ID ${input.columnId} does not exist` 
        });
      }

      console.log(`✅ Row validation passed - ID: ${row.id}, Order: ${row.order}`);

  const normalizedValue =
  typeof input.value === "string"
    ? { text: input.value }
    : typeof input.value === "number"
    ? { number: input.value }
    : input.value; // if already object { text: string }

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
    
    console.log(`✅ Cell updated successfully - ID: ${cell.id}, RowID: ${input.rowId}, ColumnID: ${input.columnId}, Order: ${row.order}, Value:`, normalizedValue);
    return cell;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch(e: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.log(`❌ Cell update error - Code: ${e?.code}, Message: ${e?.message}, Row Order: ${row?.order}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (e?.code === 'P2003') {
      // Foreign key constraint failure - row or column was deleted during update
      console.log(`🚫 Foreign key constraint failed - Row or column was deleted during update`);
      throw new TRPCError({ 
        code: 'PRECONDITION_FAILED', 
        message: `ROW_OR_COLUMN_DELETED: Row ${input.rowId} (order: ${row?.order}) or column ${input.columnId} was deleted during update` 
      });
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (e?.code === 'P2002') {
      // Unique constraint failure - cell already exists, try to find and return it
      console.log(`🔄 Unique constraint failed, trying to find and update existing cell`);
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
          console.log(`✅ Cell updated after resolving unique constraint - ID: ${updatedCell.id}, RowID: ${input.rowId}, ColumnID: ${input.columnId}, Order: ${row.order}, Value:`, normalizedValue);
          return updatedCell;
        } else {
          console.log(`❌ Could not find existing cell after unique constraint error`);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `CELL_CONFLICT: Unique constraint failed but existing cell not found for row ${input.rowId} (order: ${row.order}), column ${input.columnId}`
          });
        }
      } catch (findError) {
        console.error("Failed to find/update existing cell after unique constraint error:", findError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `CELL_UPDATE_FAILED: Failed to resolve cell update conflict for row ${input.rowId} (order: ${row.order}), column ${input.columnId}`
        });
      }
    }

    console.log(`💥 Unhandled error in cell update for row ${input.rowId} (order: ${row?.order}), column ${input.columnId}:`, e);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      message: `CELL_UPDATE_ERROR: Failed to update cell for row ${input.rowId} (order: ${row?.order}), column ${input.columnId}: ${e?.message ?? 'Unknown error'}`
    });
  }

    }),
});