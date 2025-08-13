import z from "zod";

import {  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";

export const baseRouter = createTRPCRouter({
    create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255).default("Untitled Base"),
      createSampleTable: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const base = await ctx.db.base.create({
        data: {
          name: input.name,
          userId: ctx.session.user.id,
        },
      });

      // Optionally create a sample table
      if (input.createSampleTable) {
        await ctx.db.table.create({
          data: {
            name: "Table 1",
            baseId: base.id,
            columns: {
              create: [
                { name: "Name", type: "TEXT", order: 0, width: 300 },
                { name: "Notes", type: "TEXT", order: 1, width: 200 },
                { name: "Assignee", type: "TEXT", order: 2, width: 200 },
                { name: "Priority", type: "NUMBER", order: 3, width: 150 },
              ],
            },
          },
        });
      }

      return base;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.base.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        tables: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.base.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        include: {
          tables: true,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the base belongs to the user before deleting
      const base = await ctx.db.base.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      });

      if (!base) {
        throw new Error("Base not found or you don't have permission to delete it");
      }

      // Delete in the correct order due to foreign key constraints
      // First, delete all cells, then rows, columns, views, and finally tables
      const tables = await ctx.db.table.findMany({
        where: { baseId: input.id },
        select: { id: true }
      });

      for (const table of tables) {
        // Delete cells
        await ctx.db.cell.deleteMany({
          where: {
            row: {
              tableId: table.id
            }
          }
        });

        // Delete rows
        await ctx.db.row.deleteMany({
          where: { tableId: table.id }
        });

        // Delete columns
        await ctx.db.column.deleteMany({
          where: { tableId: table.id }
        });

        // Delete views
        await ctx.db.view.deleteMany({
          where: { tableId: table.id }
        });

        // Delete the table
        await ctx.db.table.delete({
          where: { id: table.id }
        });
      }

      // Finally, delete the base
      await ctx.db.base.delete({
        where: {
          id: input.id,
        },
      });

      return { success: true };
    }),
})