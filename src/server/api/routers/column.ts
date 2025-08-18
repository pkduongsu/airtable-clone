import z from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const columnRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      tableId: z.string(),
      name: z.string().min(1).max(255),
      type: z.enum(["TEXT", "NUMBER"]),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the current max order for columns in this table
      const maxOrderResult = await ctx.db.column.aggregate({
        where: { tableId: input.tableId },
        _max: { order: true },
      });
      
      const nextOrder = (maxOrderResult._max.order ?? -1) + 1;

      // Create the new column
      const column = await ctx.db.column.create({
        data: {
          tableId: input.tableId,
          name: input.name,
          type: input.type,
          order: nextOrder,
          width: 179, // Default width
        },
      });

      // Get all existing rows for this table
      const rows = await ctx.db.row.findMany({
        where: { tableId: input.tableId },
      });

      // Create empty cells for this new column in all existing rows
      if (rows.length > 0) {
        const cells = rows.map(row => ({
          rowId: row.id,
          columnId: column.id,
          value: { text: "" }, // Empty value for new column
        }));

        await ctx.db.cell.createMany({
          data: cells,
        });
      }

      return column;
    }),

  rename: protectedProcedure
    .input(z.object({
      columnId: z.string(),
      name: z.string().min(1).max(255),
    }))
    .mutation(async ({ ctx, input }) => {
      const column = await ctx.db.column.update({
        where: { id: input.columnId },
        data: { name: input.name },
      });
      return column;
    }),

  delete: protectedProcedure
    .input(z.object({
      columnId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (prisma) => {
        // Get column info before deletion
        const column = await prisma.column.findUnique({
          where: { id: input.columnId },
          select: { id: true, order: true, tableId: true },
        });

        if (!column) {
          throw new Error("Column not found");
        }

        // Delete all cells associated with this column
        await prisma.cell.deleteMany({
          where: { columnId: input.columnId },
        });

        // Delete the column
        await prisma.column.delete({
          where: { id: input.columnId },
        });

        // Reorder remaining columns
        await prisma.column.updateMany({
          where: {
            tableId: column.tableId,
            order: { gt: column.order },
          },
          data: {
            order: { decrement: 1 },
          },
        });

        return { success: true };
      });
    }),
});