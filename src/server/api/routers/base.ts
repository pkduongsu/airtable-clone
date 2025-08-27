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
        const table = await ctx.db.table.create({
          data: {
            name: "Table 1",
            baseId: base.id,
            columns: {
              create: [
                { name: "Name", type: "TEXT", order: 0, width: 200 },
                { name: "Notes", type: "TEXT", order: 1, width: 250 },
                { name: "Assignee", type: "TEXT", order: 2, width: 150 },
                { name: "Status", type: "TEXT", order: 3, width: 120 },
                { name: "Attachments", type: "TEXT", order: 4, width: 150 },
                { name: "Attachment Summary", type: "TEXT", order: 5, width: 200 },
              ],
            },
          },
          include: {
            columns: true,
          },
        });

        // Create 3 empty rows with empty cells
        const rows = [];
        const cells = [];

        for (let i = 0; i < 3; i++) {
          const row = await ctx.db.row.create({
            data: {
              tableId: table.id,
              order: i,
            },
          });
          rows.push(row);

          // Create empty cells for each column
          for (const column of table.columns) {
            cells.push({
              rowId: row.id,
              columnId: column.id,
              value: { text: "" }, // Empty text value
            });
          }
        }

        // Bulk insert empty cells
        await ctx.db.cell.createMany({
          data: cells,
        });
      }

      return await ctx.db.base.findFirst({
        where: { id: base.id },
        include: {
          tables: {
            include: {
              columns: true,
              rows: {
                include: {
                  cells: true, 
                },
              },
            },
          },
        },
      });

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
          tables: {
            orderBy: { name: "asc" },
          },
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