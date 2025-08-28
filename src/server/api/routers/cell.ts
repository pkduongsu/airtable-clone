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
      // Prepare the value based on type
      // const cellValue = typeof input.value === 'string' 
      //   ? { text: input.value }
      //   : typeof input.value === 'number'
      //   ? { number: input.value }
      //   : input.value;

      // // Find existing cell first, then update or create
      // const existingCell = await ctx.db.cell.findFirst({
      //   where: {
      //     rowId: input.rowId,
      //     columnId: input.columnId,
      //   }
      // });

      // if (existingCell) {
      //   // Update existing cell
      //   const cell = await ctx.db.cell.update({
      //     where: { id: existingCell.id },
      //     data: { value: cellValue }
      //   });
      //   return cell;
      // } else {
      //   // Create new cell
      //   const cell = await ctx.db.cell.create({
      //     data: {
      //       rowId: input.rowId,
      //       columnId: input.columnId,
      //       value: cellValue
      //     }
      //   });
      //   return cell;
      // }

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
    return cell;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch(e: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (e?.code === 'P2003') {
    // Return a precondition failure; the client is already buffering, so it will flush later.
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'ROW_OR_COLUMN_NOT_READY' });
  }

  throw e;
}

    }),
});