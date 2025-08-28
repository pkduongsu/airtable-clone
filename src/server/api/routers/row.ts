import z from "zod";
import { faker } from '@faker-js/faker';
import { Prisma } from "@prisma/client";
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

const MAX_CELLS_PER_TX = 20_000; 

async function computeBatchRows(ctx: any, tableId: string) {
  const columnCount = await ctx.db.column.count({ where: { tableId } });
  return Math.max(300, Math.floor(MAX_CELLS_PER_TX / Math.max(1, columnCount)));
}
async function insertBatchSQL(
  ctx: any,
  args: { tableId: string; startOrder: number; rows: number }
) {
  const { tableId, startOrder, rows } = args;

  await ctx.db.$transaction(async (tx: Prisma.TransactionClient) => {
    // optional but recommended for bulk loads
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '60s'`);
    await tx.$executeRawUnsafe(`SET LOCAL synchronous_commit = off`);

    // single SQL statement that does rows + cells
    await tx.$executeRawUnsafe(
      `
      WITH new_rows AS (
        INSERT INTO "Row" ("id","tableId","order")
        SELECT gen_random_uuid(), $1, $2 + gs.n
        FROM generate_series(0, $3 - 1) AS gs(n)
        RETURNING id
      )
      INSERT INTO "Cell" ("id","rowId","columnId","value")
      SELECT gen_random_uuid(), r.id, c.id, '{"text": ""}'::jsonb
      FROM new_rows r
      CROSS JOIN "Column" c
      WHERE c."tableId" = $1
      `,
      tableId,
      startOrder,
      rows
    );
  });
}

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

insertFirstBatch: protectedProcedure
  .input(z.object({ tableId: z.string(), count: z.number().default(100000) }))
  .mutation(async ({ ctx, input }) => {
    const { tableId, count } = input;

    const columns = await ctx.db.column.findMany({
      where: { tableId },
      orderBy: { order: 'asc' },
    });

    const maxOrderResult = await ctx.db.row.aggregate({
      where: { tableId },
      _max: { order: true },
    });
    const startOrder = (maxOrderResult._max.order ?? -1) + 1;

    const FIRST_BATCH_ROWS = Math.min(count, 1000); // ≤ 1000 for instant feedback

    const rowsData = Array.from({ length: FIRST_BATCH_ROWS }, (_, i) => ({
      tableId,
      order: startOrder + i,
    }));
    const insertedRows = await ctx.db.row.createManyAndReturn({ data: rowsData });

    const cellsData: Array<{ rowId: string; columnId: string; value: { text: string } }> = [];
    for (const row of insertedRows) {
      for (const column of columns) {
        cellsData.push({
          rowId: row.id,
          columnId: column.id,
          value: { text: generateFakeValue(column.name, column.type) },
        });
      }
    }

    if (cellsData.length > 0) {
      await ctx.db.cell.createMany({ data: cellsData, skipDuplicates: true });
    }

    return {
      success: true,
      insertedCount: FIRST_BATCH_ROWS,
      remaining: count - FIRST_BATCH_ROWS,
      nextStartOrder: startOrder + FIRST_BATCH_ROWS,
    };
  }),

  insertRemainingBatches: protectedProcedure
  .input(z.object({
    tableId: z.string(),
    remaining: z.number(),
    nextStartOrder: z.number(),
  }))
  .mutation(async ({ ctx, input }) => {
    const { tableId, remaining, nextStartOrder } = input;

    if (remaining <= 0) {
      return { success: true, insertedThisBatch: 0, remaining: 0, nextStartOrder, done: true };
    }

    const columns = await ctx.db.column.findMany({
      where: { tableId },
      orderBy: { order: 'asc' },
    });

    const batchSize = 5000; // safe size for prisma query to not exceed limits
    const rowsToInsert = Math.min(batchSize, remaining);

    const rowsData = Array.from({ length: rowsToInsert }, (_, i) => ({
      tableId,
      order: nextStartOrder + i,
    }));
    const insertedRows = await ctx.db.row.createManyAndReturn({ data: rowsData });

    const cellsData: Array<{ rowId: string; columnId: string; value: { text: string } }> = [];
    for (const row of insertedRows) {
      for (const column of columns) {
        cellsData.push({
          rowId: row.id,
          columnId: column.id,
          value: { text: generateFakeValue(column.name, column.type) },
        });
      }
    }

    if (cellsData.length > 0) {
      await ctx.db.cell.createMany({ data: cellsData, skipDuplicates: true });
    }

    return {
      success: true,
      insertedThisBatch: rowsToInsert,
      remaining: remaining - rowsToInsert,
      nextStartOrder: nextStartOrder + rowsToInsert,
      done: remaining - rowsToInsert <= 0,
    };
  }),
});