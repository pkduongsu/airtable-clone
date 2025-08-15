import z from "zod";

import {  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";

//CRUD
export const tableRouter = createTRPCRouter({
    create: protectedProcedure
    .input(
        z.object({
            baseId: z.string(),
            name: z.string().min(1).max(255),
            generateSampleData: z.boolean().default(true),
        })
    )
    .mutation(async ({ ctx, input }) => {
      // Create table with default columns and sample data
      const table = await ctx.db.table.create({
        data: {
          name: input.name,
          baseId: input.baseId,
          columns: {
            create: [
              {
                name: "Name",
                type: "TEXT",
                order: 0,
                width: 180,
              },
              {
                name: "Notes",
                type: "TEXT", 
                order: 1,
                width: 180,
              },
              {
                name: "Assignee",
                type: "TEXT",
                order: 2,
                width: 180,
              },
              {
                name: "Status",
                type: "TEXT",
                order: 3,
                width: 180,
              },
              {
                name: "Attachments",
                type: "TEXT",
                order: 4,
                width: 180,
              },
              {
                name: "Attachment Summary",
                type: "TEXT",
                order: 5,
                width: 220,
              },
            ],
          },
        },
        include: {
          columns: true,
        },
      });

      // Generate empty rows if requested
      if (input.generateSampleData) {
        const rows = [];
        const cells = [];

        // Create 3 empty rows
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

      return table;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(255),
    }))
    .mutation(async ({ ctx, input }) => {
      const table = await ctx.db.table.update({
        where: { id: input.id },
        data: { name: input.name },
      });
      return table;
    }),

  delete: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Delete all related data in the correct order due to foreign key constraints
      
      // First, delete all cells
      await ctx.db.cell.deleteMany({
        where: {
          row: {
            tableId: input.id
          }
        }
      });

      // Then, delete all rows
      await ctx.db.row.deleteMany({
        where: { tableId: input.id }
      });

      // Delete all columns
      await ctx.db.column.deleteMany({
        where: { tableId: input.id }
      });

      // Delete all views
      await ctx.db.view.deleteMany({
        where: { tableId: input.id }
      });

      // Finally, delete the table
      const table = await ctx.db.table.delete({
        where: { id: input.id },
      });
      
      return table;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.table.findUnique({
        where: { id: input.id },
        include: {
          columns: {
            orderBy: { order: "asc" },
          },
          _count: {
            select: { rows: true },
          },
        },
      });
    }),

  list: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.table.findMany({
        where: { baseId: input.baseId },
        include: {
          columns: {
            orderBy: { order: "asc" },
          },
          _count: {
            select: { rows: true },
          },
        },
        orderBy: { name: "asc" },
      });
    }),

  getTableData: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.table.findUnique({
        where: { id: input.tableId },
        include: {
          columns: {
            orderBy: { order: "asc" },
          },
          rows: {
            include: {
              cells: {
                include: {
                  column: true,
                },
              },
            },
            orderBy: { order: "asc" },
            take: 50, // Limit to first 50 rows for performance
          },
          _count: {
            select: { rows: true },
          },
        },
      });
    }),

  createColumn: protectedProcedure
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

  createRow: protectedProcedure
    .input(z.object({
      tableId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the current max order for rows in this table
      const maxOrderResult = await ctx.db.row.aggregate({
        where: { tableId: input.tableId },
        _max: { order: true },
      });
      
      const nextOrder = (maxOrderResult._max.order ?? -1) + 1;

      // Create the new row
      const row = await ctx.db.row.create({
        data: {
          tableId: input.tableId,
          order: nextOrder,
        },
      });

      // Get all columns for this table
      const columns = await ctx.db.column.findMany({
        where: { tableId: input.tableId },
      });

      // Create empty cells for this new row in all existing columns
      if (columns.length > 0) {
        const cells = columns.map(column => ({
          rowId: row.id,
          columnId: column.id,
          value: { text: "" }, // Empty value for new row
        }));

        await ctx.db.cell.createMany({
          data: cells,
        });
      }

      return row;
    }),
});