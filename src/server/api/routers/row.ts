import z from "zod";
import { faker } from '@faker-js/faker';
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// Function to generate fake data based on column name and type
const generateFakeValue = (columnName: string, columnType: string) => {
const lowerName = columnName.toLowerCase();
        
if (lowerName.includes('name') || lowerName.includes('title')) {
 return faker.person.fullName();
  } else if (lowerName.includes('email')) {
    return faker.internet.email();
  } else if (lowerName.includes('note') || lowerName.includes('description') || lowerName.includes('comment')) {
    return faker.lorem.word(10);
  } else if (lowerName.includes('assignee') || lowerName.includes('owner') || lowerName.includes('user')) {
  return faker.person.firstName();
  } else if (lowerName.includes('status')) {
    return faker.helpers.arrayElement(['In Progress', 'Complete', 'Pending', 'Review', 'Blocked']);
  } else if (lowerName.includes('priority')) {
    return faker.helpers.arrayElement(['High', 'Medium', 'Low', 'Critical']);
  } else if (lowerName.includes('attachment') || lowerName.includes('file')) {
    return faker.helpers.arrayElement(['', 'document.pdf', 'image.jpg', 'spreadsheet.xlsx']);
  } else if (columnType === 'NUMBER') {
    return faker.number.int({ min: 1, max: 99 }).toString();
  } else {
    // Default text data
    return faker.lorem.words(faker.number.int({ min: 1, max: 4 }));
  }
};

const GetRowsByOrderRangeInput = z.object({
  tableId: z.string(),
  startOrder: z.number().int().nonnegative(),
  endOrder: z.number().int().nonnegative(),
})

const RangeWithCellsInput = z.object({
  tableId: z.string(),
  startOrder: z.number().int().nonnegative(),
  endOrder: z.number().int().nonnegative(),
  columnIds: z.array(z.string()).optional(),
});

export const rowRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      tableId: z.string(),
      id: z.string().optional(), // Optional client-generated ID
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
          id: input.id,
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

  insertAbove: protectedProcedure
    .input(z.object({
      tableId: z.string(),
      targetRowId: z.string(),
      id: z.string().optional(), 
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the target row to find its order
      const targetRow = await ctx.db.row.findUnique({
        where: { id: input.targetRowId },
        select: { order: true },
      });

      if (!targetRow) {
        throw new Error("Target row not found");
      }

      const newOrder = targetRow.order;

      // Increment order of all rows at or after the target position
      await ctx.db.row.updateMany({
        where: {
          tableId: input.tableId,
          order: { gte: newOrder },
        },
        data: {
          order: { increment: 1 },
        },
      });

      // Create the new row at the target position
      const row = await ctx.db.row.create({
        data: {
          tableId: input.tableId,
          order: newOrder,
          id: input.id,
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
          value: { text: "" },
        }));

        await ctx.db.cell.createMany({
          data: cells,
        });
      }

      return row;
    }),

  insertBelow: protectedProcedure
    .input(z.object({
      tableId: z.string(),
      targetRowId: z.string(),
      id: z.string().optional(), 
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the target row to find its order
      const targetRow = await ctx.db.row.findUnique({
        where: { id: input.targetRowId },
        select: { order: true },
      });

      if (!targetRow) {
        throw new Error("Target row not found");
      }

      const newOrder = targetRow.order + 1;

      // Increment order of all rows after the target position
      await ctx.db.row.updateMany({
        where: {
          tableId: input.tableId,
          order: { gte: newOrder },
        },
        data: {
          order: { increment: 1 },
        },
      });

      // Create the new row at the position after target
      const row = await ctx.db.row.create({
        data: {
          tableId: input.tableId,
          order: newOrder,
          id: input.id,
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
          value: { text: "" },
        }));

        await ctx.db.cell.createMany({
          data: cells,
          skipDuplicates: true,
        });
      }

      return row;
    }),

  delete: protectedProcedure
    .input(z.object({
      tableId: z.string(),
      rowId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the target row to find its order
      const targetRow = await ctx.db.row.findUnique({
        where: { id: input.rowId },
        select: { order: true },
      });

      if (!targetRow) {
        throw new Error("Row not found");
      }

      // Delete all cells associated with this row
      await ctx.db.cell.deleteMany({
        where: { rowId: input.rowId },
      });

      // Delete the row
      await ctx.db.row.delete({
        where: { id: input.rowId },
      });

      // Decrement order of all rows after the deleted row
      await ctx.db.row.updateMany({
        where: {
          tableId: input.tableId,
          order: { gt: targetRow.order },
        },
        data: {
          order: { decrement: 1 },
        },
      });

      return { success: true };
    }),

  bulkInsert: protectedProcedure
    .input(z.object({
      tableId: z.string(),
      count: z.number().default(100000),
    }))
    .mutation(async ({ ctx, input }) => {
      const { tableId, count } = input;

      // Get table columns to generate appropriate fake data
      const columns = await ctx.db.column.findMany({
        where: { tableId },
        orderBy: { order: 'asc' },
      });

      // Get current max order for rows
      const maxOrderResult = await ctx.db.row.aggregate({
        where: { tableId },
        _max: { order: true },
      });

      const startOrder = (maxOrderResult._max.order ?? -1) + 1;

      // Process in batches to avoid memory/timeout issues
      const batchSize = 5000; //pushes to 5000 records to make adding records faster
      const batches = Math.ceil(count / batchSize); //total batches count 5000 -> 20 batches

      for (let batch = 0; batch < batches; batch++) {
        const batchStart = batch * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, count);
        const batchCount = batchEnd - batchStart;

        // Prepare rows for this batch
        const rowsData = [];
        for (let i = 0; i < batchCount; i++) {
          rowsData.push({
            tableId,
            order: startOrder + batchStart + i,
          });
        }

        // Insert rows in batch
        const insertedRows = await ctx.db.row.createManyAndReturn({
          data: rowsData,
        });

        // Prepare cells for this batch
        const cellsData = [];
        for (const row of insertedRows) {
          for (const column of columns) {
            const fakeValue = generateFakeValue(column.name, column.type);
            cellsData.push({
              rowId: row.id,
              columnId: column.id,
              value: { text: fakeValue },
            });
          }
        }

        // Insert cells in batch
        if (cellsData.length > 0) {
          await ctx.db.cell.createMany({
            data: cellsData,
            skipDuplicates: true,
          });
        }
      }
      return { success: true, insertedCount: count };
    }),

  getCurrentMaxOrder: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      const maxOrder = await ctx.db.row.aggregate({
        where: { tableId: input.tableId },
        _max: { order: true },
      });
      // next available order is max+1 (or 0 if table empty)
      return { baseOrder: (maxOrder._max.order ?? -1) + 1 };
    }),

  // --- 2) Insert ONE chunk of empty rows (+ empty cells) ---
 insertEmptyRowsChunk: protectedProcedure
    .input(z.object({
      tableId: z.string(),
      baseOrder: z.number().int().nonnegative(),
      globalOffset: z.number().int().nonnegative(),
      size: z.number().int().positive().max(10_000),
      cellBatchSize: z.number().int().positive().default(50_000),
      withCells: z.boolean().optional().default(false), // NEW: default to rows-only
    }))
    .mutation(async ({ ctx, input }) => {
      const { tableId, baseOrder, globalOffset, size, cellBatchSize, withCells } = input;

      const startOrder = baseOrder + globalOffset;
      const endOrder   = startOrder + size - 1;

      const rowsPayload = Array.from({ length: size }, (_, i) => ({
        tableId,
        order: startOrder + i,
      }));

      await ctx.db.row.createMany({ data: rowsPayload, skipDuplicates: true });

      const insertedRows = await ctx.db.row.findMany({
        where: { tableId, order: { gte: startOrder, lte: endOrder } },
        select: { id: true },
        orderBy: { order: "asc" },
      });
      const rowIds = insertedRows.map(r => r.id);
      const rowsInserted = rowIds.length;

      // FAST PATH: rows-only by default (no cells yet)
      if (!withCells || rowIds.length === 0) {
        return { rowsInserted, cellsInserted: 0, from: startOrder, to: endOrder };
      }

      // (Optional) create empty cells if explicitly requested
      let cellsInserted = 0;
      const columns = await ctx.db.column.findMany({ where: { tableId }, select: { id: true } });
      if (columns.length) {
        const colIds = columns.map(c => c.id);
        let buffer: Array<{ rowId: string; columnId: string; value: { text: string } }> = [];
        const flush = async () => {
          if (!buffer.length) return;
          const res = await ctx.db.cell.createMany({ data: buffer, skipDuplicates: true });
          cellsInserted += res.count ?? 0;
          buffer = [];
        };
        for (const rId of rowIds) {
          for (const cId of colIds) {
            buffer.push({ rowId: rId, columnId: cId, value: { text: "" } });
            if (buffer.length >= cellBatchSize) await flush();
          }
        }
        await flush();
      }

      return { rowsInserted, cellsInserted, from: startOrder, to: endOrder };
    }),

     listByOrderRange: protectedProcedure
    .input(GetRowsByOrderRangeInput)
    .query(async ({ ctx, input }) => {
      const { tableId, startOrder, endOrder } = input
      const rows = await ctx.db.row.findMany({
        where: { tableId, order: { gte: startOrder, lte: endOrder } },
        select: { id: true, order: true },
        orderBy: { order: 'asc' },
      })
      return rows
    }),

  // 2) Get cells for a set of rowIds, column-pruned
  listCellsByRowIds: protectedProcedure
    .input(z.object({
      rowIds: z.array(z.string()).min(1),
      columnIds: z.array(z.string()).optional(), // omit => all columns
    }))
    .query(async ({ ctx, input }) => {
      const { rowIds, columnIds } = input
      const cells = await ctx.db.cell.findMany({
        where: {
          rowId: { in: rowIds },
          ...(columnIds?.length ? { columnId: { in: columnIds } } : {}),
        },
        select: { id: true, rowId: true, columnId: true, value: true },
      })
      return cells
    }),
    listRowsWithCellsByOrderRange: protectedProcedure
    .input(RangeWithCellsInput)
    .query(async ({ ctx, input }) => {
      const { tableId, startOrder, endOrder, columnIds } = input;

      const rows = await ctx.db.row.findMany({
        where: { tableId, order: { gte: startOrder, lte: endOrder } },
        select: { id: true, order: true },
        orderBy: { order: 'asc' },
      });

      if (!rows.length) return { rows: [], cells: [] };

      const rowIds = rows.map(r => r.id);

      const cells = await ctx.db.cell.findMany({
        where: {
          rowId: { in: rowIds },
          ...(columnIds?.length ? { columnId: { in: columnIds } } : {}),
        },
        select: { id: true, rowId: true, columnId: true, value: true },
      });

      return { rows, cells };
    }),

  // Create a row at a specific order (for sparse data)
  createAtOrder: protectedProcedure
    .input(z.object({
      tableId: z.string(),
      order: z.number().int().nonnegative(),
      id: z.string().optional(), // Optional client-generated ID
    }))
    .mutation(async ({ ctx, input }) => {
      const { tableId, order, id } = input;

      // Check if a row with this order already exists
      const existingRow = await ctx.db.row.findFirst({
        where: { tableId, order },
      });

      if (existingRow) {
        return existingRow; // Return existing row if it already exists
      }

      // Create the new row at the specified order
      const row = await ctx.db.row.create({
        data: {
          tableId,
          order,
          id,
        },
      });

      // Get all columns for this table
      const columns = await ctx.db.column.findMany({
        where: { tableId },
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

