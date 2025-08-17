import z from "zod";
import { faker } from '@faker-js/faker';
import type { Prisma } from "@prisma/client";

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
    .input(z.object({ 
      tableId: z.string(),
      limit: z.number().min(1).max(1000).default(100),
      cursor: z.number().default(0),
      sortRules: z.array(z.object({
        columnId: z.string(),
        direction: z.enum(['asc', 'desc'])
      })).optional()
    }))
    .query(async ({ ctx, input }) => {
      const { tableId, limit, cursor, sortRules = [] } = input;
      
      // Get table metadata (columns and count)
      const table = await ctx.db.table.findUnique({
        where: { id: tableId },
        include: {
          columns: {
            orderBy: { order: "asc" },
          },
          _count: {
            select: { rows: true },
          },
        },
      });

      if (!table) {
        throw new Error("Table not found");
      }

      // Get paginated rows with sorting
      let rows: Prisma.RowGetPayload<{
        include: {
          cells: {
            include: {
              column: true;
            };
          };
        };
      }>[];
      
      if (sortRules.length === 0) {
        // Default sorting by row order
        rows = await ctx.db.row.findMany({
          where: { tableId },
          include: {
            cells: {
              include: {
                column: true,
              },
            },
          },
          orderBy: { order: "asc" },
          skip: cursor,
          take: limit,
        });
      } else {
        // Use database-level sorting with proper type handling
        try {
          console.log('Executing SQL query with parameters:', { tableId, limit, cursor, sortRules });
          
          // Build the SQL query with proper type handling
          // Include sort expressions in SELECT to satisfy PostgreSQL's DISTINCT requirement
          const sortExpressions = sortRules.map((rule, index) => {
            return `(CASE
              WHEN col${index}.type = 'NUMBER' THEN
                LPAD(COALESCE(NULLIF(c${index}.value->>'text', ''), '0'), 20, '0')
              ELSE
                LOWER(COALESCE(c${index}.value->>'text', ''))
            END) AS sort_expr_${index}`;
          });
          
          let sqlQuery = `
            SELECT DISTINCT r.id, r."tableId", r."order"${sortExpressions.length > 0 ? ', ' + sortExpressions.join(', ') : ''}
            FROM "Row" r`;
          
          // Add LEFT JOINs for each sort rule
          sortRules.forEach((rule, index) => {
            sqlQuery += `
            LEFT JOIN "Cell" c${index} ON r.id = c${index}."rowId" AND c${index}."columnId" = '${rule.columnId}'
            LEFT JOIN "Column" col${index} ON c${index}."columnId" = col${index}.id`;
          });
          
          sqlQuery += `
            WHERE r."tableId" = $1
            ORDER BY `;
          
          // Build ORDER BY clause using the aliased expressions
          const orderClauses = sortRules.map((rule, index) => {
            const direction = rule.direction.toUpperCase();
            return `sort_expr_${index} ${direction} NULLS LAST`;
          });
          
          sqlQuery += orderClauses.join(', ') + ', r."order" ASC';
          sqlQuery += `
            LIMIT $2 OFFSET $3`;
          
          console.log('Executing SQL query:', sqlQuery);
          console.log('With parameters:', { tableId, limit, cursor, sortRules });

          const sortedRowIds = await ctx.db.$queryRawUnsafe<Array<{id: string}>>(
            sqlQuery,
            tableId,
            limit,
            cursor
          );

          // Get the full row data for the sorted row IDs
          if (sortedRowIds.length > 0) {
            const rowIds = sortedRowIds.map(row => row.id);
            const rowsWithCells = await ctx.db.row.findMany({
              where: { id: { in: rowIds } },
              include: {
                cells: {
                  include: {
                    column: true,
                  },
                },
              },
            });

            // Maintain the order from the SQL query
            rows = rowIds.map(id => rowsWithCells.find(row => row.id === id)!).filter(Boolean);
          } else {
            rows = [];
          }
        } catch (error) {
          console.error('Error executing sort query:', error);
          console.log('Sort rules:', JSON.stringify(sortRules, null, 2));
          
          // Fallback to client-side sorting
          console.log('Falling back to client-side sorting');
          
          const allRows = await ctx.db.row.findMany({
            where: { tableId },
            include: {
              cells: {
                include: {
                  column: true,
                },
              },
            },
            orderBy: { order: "asc" },
          });
        
          // Sort rows based on sort rules
          const sortedRows = allRows.sort((a, b) => {
            for (const rule of sortRules) {
              const cellA = a.cells.find(cell => cell.columnId === rule.columnId);
              const cellB = b.cells.find(cell => cell.columnId === rule.columnId);
              
              const valueA = cellA?.value as { text?: string } | null;
              const valueB = cellB?.value as { text?: string } | null;
              
              const textA = valueA?.text ?? '';
              const textB = valueB?.text ?? '';
              
              // Determine column type
              const column = table.columns.find(col => col.id === rule.columnId);
              const isNumber = column?.type === 'NUMBER';
              
              let comparison = 0;
              
              if (isNumber) {
                const numA = parseFloat(textA) || 0;
                const numB = parseFloat(textB) || 0;
                comparison = numA - numB;
              } else {
                comparison = textA.toLowerCase().localeCompare(textB.toLowerCase());
              }
              
              if (comparison !== 0) {
                return rule.direction === 'desc' ? -comparison : comparison;
              }
            }
            
            // If all sort rules are equal, fall back to row order
            return a.order - b.order;
          });
          
          // Apply pagination to sorted results
          rows = sortedRows.slice(cursor, cursor + limit);
        }
      }

      return {
        ...table,
        rows,
        nextCursor: rows.length === limit ? cursor + limit : null,
      };
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

  updateCell: protectedProcedure
    .input(z.object({
      cellId: z.string(),
      value: z.union([z.string(), z.number(), z.object({ text: z.string() })]),
    }))
    .mutation(async ({ ctx, input }) => {
      // Update the cell value
      const cell = await ctx.db.cell.update({
        where: { id: input.cellId },
        data: { 
          value: typeof input.value === 'string' 
            ? { text: input.value }
            : typeof input.value === 'number'
            ? { number: input.value }
            : input.value
        },
      });
      return cell;
    }),

  insertRowAbove: protectedProcedure
    .input(z.object({
      tableId: z.string(),
      targetRowId: z.string(),
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

  insertRowBelow: protectedProcedure
    .input(z.object({
      tableId: z.string(),
      targetRowId: z.string(),
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

  deleteRow: protectedProcedure
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

  bulkInsertRows: protectedProcedure
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

      // Function to generate fake data based on column name and type
      const generateFakeValue = (columnName: string, columnType: string) => {
        const lowerName = columnName.toLowerCase();
        
        if (lowerName.includes('name') || lowerName.includes('title')) {
          return faker.person.fullName();
        } else if (lowerName.includes('email')) {
          return faker.internet.email();
        } else if (lowerName.includes('note') || lowerName.includes('description') || lowerName.includes('comment')) {
          return faker.lorem.word();
        } else if (lowerName.includes('assignee') || lowerName.includes('owner') || lowerName.includes('user')) {
          return faker.person.firstName();
        } else if (lowerName.includes('status')) {
          return faker.helpers.arrayElement(['In Progress', 'Complete', 'Pending', 'Review', 'Blocked']);
        } else if (lowerName.includes('priority')) {
          return faker.helpers.arrayElement(['High', 'Medium', 'Low', 'Critical']);
        } else if (lowerName.includes('phone')) {
          return faker.phone.number();
        } else if (lowerName.includes('address')) {
          return faker.location.streetAddress();
        } else if (lowerName.includes('city')) {
          return faker.location.city();
        } else if (lowerName.includes('company') || lowerName.includes('organization')) {
          return faker.company.name();
        } else if (lowerName.includes('attachment') || lowerName.includes('file')) {
          return faker.helpers.arrayElement(['', 'document.pdf', 'image.jpg', 'spreadsheet.xlsx']);
        } else if (columnType === 'NUMBER') {
          return faker.number.int({ min: 1, max: 1000 }).toString();
        } else {
          // Default text data
          return faker.lorem.words(faker.number.int({ min: 1, max: 4 }));
        }
      };

      // Process in batches to avoid memory/timeout issues
      const batchSize = 1000;
      const batches = Math.ceil(count / batchSize);

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
          });
        }
      }

      return { success: true, insertedCount: count };
    }),
});