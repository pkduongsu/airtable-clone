import z from "zod";
import { Prisma } from "@prisma/client";
import { faker } from "@faker-js/faker";

import {  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";

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
const rowInclude = {
  cells: { include: { column: true } },
} as const;

type RowWithCells = Prisma.RowGetPayload<{ include: typeof rowInclude }>;

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
                width: 250,
              },
            ],
          },
        },
        include: {
          columns: true,
        },
      });

      // Generate sample rows if requested
      if (input.generateSampleData) {
        const rows = [];
        const cells = [];

        // Create 3 sample rows
        for (let i = 0; i < 3; i++) {
          const row = await ctx.db.row.create({
            data: {
              tableId: table.id,
              order: i,
            },
          });
          rows.push(row);
          
          for (const column of table.columns) {
           const fake = generateFakeValue(column.name, column.type);
            cells.push({
              rowId: row.id,
              columnId: column.id,
              // Keep your JSON shape: store as text; coerce to string for consistency
              value: { text: String(fake ?? "") },
            });
          }
        }
        // Bulk insert cells
        await ctx.db.cell.createMany({
          data: cells,
        });
      }

      // Create default view for the new table
      await ctx.db.view.create({
        data: {
          tableId: table.id,
          name: "Grid view",
          config: {
            sortRules: [],
            filterRules: [],
            hiddenColumns: []
          },
          isDefault: true
        }
      });

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
    const tableId = input.id;

    // Tunables: keep each DB call quick
    const ROW_BATCH = 5_000;
    const COL_BATCH = 5_000;
    //const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    // 1) Delete rows in batches: (cells by those rowIds) → rows
    for (;;) {
      const rows = await ctx.db.row.findMany({
        where: { tableId },
        select: { id: true },
        take: ROW_BATCH,
      });
      if (rows.length === 0) break;

      const rowIds = rows.map(r => r.id);

      // Delete cells attached to these rows
      await ctx.db.cell.deleteMany({ where: { rowId: { in: rowIds } } });
      // Delete the rows
      await ctx.db.row.deleteMany({ where: { id: { in: rowIds } } });

      // Optional tiny pause so we don’t hog the pool (useful on shared DBs)
      // await sleep(5);
    }

    // 2) Delete columns (and any leftover cells by those columns) in batches
    for (;;) {
      const cols = await ctx.db.column.findMany({
        where: { tableId },
        select: { id: true },
        take: COL_BATCH,
      });
      if (cols.length === 0) break;

      const colIds = cols.map(c => c.id);

      // Defensive: remove any cells still referencing these columns
      // (normally there should be none after row deletion, but this is safe)
      await ctx.db.cell.deleteMany({ where: { columnId: { in: colIds } } });
      await ctx.db.column.deleteMany({ where: { id: { in: colIds } } });
      // await sleep(5);
    }

    // 3) Delete views (usually small)
    await ctx.db.view.deleteMany({ where: { tableId } });

    // 4) Finally, delete the table record
    const table = await ctx.db.table.delete({ where: { id: tableId } });
    return table;
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.table.findUnique({
        where: { id: input.id },
        include: {
          columns: true,
          _count: {
            select: { rows: true },
          },
        },
      });
      
      console.log(`🔢 Backend: table.getById - TableID: ${input.id}, RowCount: ${result?._count?.rows}`);
      return result;
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
      })).optional(),
      filterRules: z.array(z.object({
        id: z.string(),
        columnId: z.string(),
        columnName: z.string(),
        columnType: z.enum(['TEXT', 'NUMBER']),
        operator: z.enum(['is_empty', 'is_not_empty', 'contains', 'not_contains', 'equals', 'greater_than', 'less_than']),
        value: z.union([z.string(), z.number()]).optional(),
        logicOperator: z.enum(['and', 'or']).optional(),
      })).optional(),
      globalSearch: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { tableId, limit, cursor, sortRules = [], filterRules = [], globalSearch } = input;
      
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
      let rows: RowWithCells[] = [];
      
      if (sortRules.length === 0 && filterRules.length === 0) {
        // Default sorting by row order
        rows = await ctx.db.row.findMany({
          where: {
            tableId,
            ...(globalSearch?.trim()
              ? { cells: { some: { value: { path: ['text'], string_contains: globalSearch } } } }
              : {}),
          },
          include: rowInclude,
          orderBy: { order: 'asc' },
          skip: cursor,
          take: limit,
        }) as RowWithCells[];
      } else {
        // Use database-level sorting and filtering with proper type handling
        try {
          console.log('Executing SQL query with parameters:', { tableId, limit, cursor, sortRules, filterRules });
          
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

          // Helper function to build filter condition
          const buildFilterCondition = (rule: typeof filterRules[0], index: number, paramIndex: number) => {
            const cellValue = `c_filter_${index}.value->>'text'`;
            switch (rule.operator) {
              case 'is_empty': 
                return `(${cellValue} IS NULL OR ${cellValue} = '')`;
              case 'is_not_empty': 
                return `(${cellValue} IS NOT NULL AND ${cellValue} != '')`;
              case 'contains': 
                return rule.value !== null && rule.value !== undefined 
                  ? `LOWER(COALESCE(${cellValue}, '')) LIKE LOWER($${paramIndex})`
                  : 'FALSE'; // No match if no search value
              case 'not_contains': 
                return rule.value !== null && rule.value !== undefined
                  ? `(${cellValue} IS NULL OR LOWER(COALESCE(${cellValue}, '')) NOT LIKE LOWER($${paramIndex}))`
                  : 'TRUE'; // Match all if no search value
              case 'equals': 
                if (rule.columnType === 'NUMBER') {
                  return `CAST(NULLIF(${cellValue}, '') AS NUMERIC) = $${paramIndex}`;
                }
                return `LOWER(COALESCE(${cellValue}, '')) = LOWER($${paramIndex})`;
              case 'greater_than': 
                return `CAST(NULLIF(${cellValue}, '') AS NUMERIC) > $${paramIndex}`;
              case 'less_than': 
                return `CAST(NULLIF(${cellValue}, '') AS NUMERIC) < $${paramIndex}`;
              default:
                return 'TRUE';
            }
          };

          // Build filter conditions and collect parameters
          const filterConditions: string[] = [];
          const queryParams = [tableId, limit, cursor];
          let paramIndex = 4; // Start after tableId, limit, cursor

          filterRules.forEach((rule, index) => {
            const condition = buildFilterCondition(rule, index, paramIndex);
            filterConditions.push(condition);
            
            // Add parameter value if needed (skip if value is null or undefined)
            if (['contains', 'not_contains'].includes(rule.operator) && rule.value !== undefined && rule.value !== null) {
              queryParams.push(`%${rule.value}%`);
              paramIndex++;
            } else if (['equals', 'greater_than', 'less_than'].includes(rule.operator) && rule.value !== undefined && rule.value !== null) {
              queryParams.push(String(rule.value));
              paramIndex++;
            }
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

          // Add LEFT JOINs for each filter rule
          filterRules.forEach((rule, index) => {
            sqlQuery += `
            LEFT JOIN "Cell" c_filter_${index} ON r.id = c_filter_${index}."rowId" AND c_filter_${index}."columnId" = '${rule.columnId}'
            LEFT JOIN "Column" col_filter_${index} ON c_filter_${index}."columnId" = col_filter_${index}.id`;
          });
          
          sqlQuery += `
            WHERE r."tableId" = $1`;
          
          // Add filter conditions
          if (filterConditions.length > 0) {
            const orGroups: string[] = [];
            let current: string[] = [];

            filterRules.forEach((rule, i) => {
              const splitBefore = i > 0 && rule.logicOperator === 'or';
              if (splitBefore) {
                if (current.length) orGroups.push(`(${current.join(' AND ')})`);
                current = [];
              }
              current.push(filterConditions[i]!);
            });

            if (current.length) orGroups.push(`(${current.join(' AND ')})`);
            sqlQuery += ` AND (${orGroups.join(' OR ')})`;
          }

          // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
          if (globalSearch && globalSearch.trim()) {
            sqlQuery += `
              AND EXISTS (
                SELECT 1
                FROM "Cell" gc
                WHERE gc."rowId" = r.id
                  AND LOWER(COALESCE(gc.value->>'text', '')) LIKE LOWER($${paramIndex})
              )`;
            queryParams.push(`%${globalSearch}%`);
            paramIndex++;
          }
          
          if (sortRules.length > 0) {
            sqlQuery += ` ORDER BY `;
            // Build ORDER BY clause using the aliased expressions
            const orderClauses = sortRules.map((rule, index) => {
              const direction = rule.direction.toUpperCase();
              return `sort_expr_${index} ${direction} NULLS LAST`;
            });
            sqlQuery += orderClauses.join(', ') + ', r."order" ASC';
          } else {
            sqlQuery += ` ORDER BY r."order" ASC`;
          }
          
          sqlQuery += `
            LIMIT $2 OFFSET $3`;
          
          console.log('Executing SQL query:', sqlQuery);
          console.log('With parameters:', { queryParams });

          const sortedRowIds = await ctx.db.$queryRawUnsafe<Array<{ id: string }>>(
            sqlQuery,
            ...queryParams
          );

          if (sortedRowIds.length > 0) {
            const rowIds = sortedRowIds.map(r => r.id);

            const rowsWithCells = await ctx.db.row.findMany({
              where: { id: { in: rowIds } },
              include: rowInclude,
            }) as RowWithCells[];

            // Preserve SQL order
            rows = rowIds
              .map(id => rowsWithCells.find(r => r.id === id)!)
              .filter(Boolean);
          } else {
            rows = [];
          }
        } catch (error) {
          console.error('Error executing sort query:', error);
          console.log('Sort rules:', JSON.stringify(sortRules, null, 2));
          
          // Fallback to client-side sorting with pagination
          console.log('Falling back to client-side sorting');
          
          // For fallback, we need to apply filters first, then sort, then paginate
          // Build filter conditions for Prisma where clause
          let whereConditions: Prisma.RowWhereInput = { tableId };
          
          if (filterRules.length > 0) {
            //eslint-disable-next-line @typescript-eslint/no-unused-vars
            const filterConditions: Prisma.RowWhereInput[] = filterRules.map(rule => {
              const baseCondition: Prisma.RowWhereInput = {
                cells: {
                  some: {
                    columnId: rule.columnId,
                  }
                }
              };
              
              switch (rule.operator) {
                case 'is_empty':
                  return {
                    cells: {
                      some: {
                        columnId: rule.columnId,
                        OR: [
                          { value: { equals: Prisma.DbNull } },
                          { value: { path: ['text'], equals: '' } }
                        ]
                      }
                    }
                  } satisfies Prisma.RowWhereInput;
                case 'is_not_empty':
                  return {
                    cells: {
                      some: {
                        columnId: rule.columnId,
                        AND: [
                          { value: { not: Prisma.DbNull } },
                          { value: { path: ['text'], not: '' } }
                        ]
                      }
                    }
                  } satisfies Prisma.RowWhereInput;
                case 'contains':
                  return rule.value ? {
                    cells: {
                      some: {
                        columnId: rule.columnId,
                        value: { path: ['text'], string_contains: rule.value as string }
                      }
                    }
                  } satisfies Prisma.RowWhereInput : { id: 'no-match' } satisfies Prisma.RowWhereInput;
                case 'not_contains':
                  return rule.value ? {
                    NOT: {
                      cells: {
                        some: {
                          columnId: rule.columnId,
                          value: { path: ['text'], string_contains: rule.value as string }
                        }
                      }
                    }
                  } satisfies Prisma.RowWhereInput : { tableId } satisfies Prisma.RowWhereInput;
                default:
                  return baseCondition;
              }
            });
            
          }

           // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
          if (globalSearch && globalSearch.trim()) {
            const existingAND =
              Array.isArray(whereConditions.AND)
                ? whereConditions.AND
                : (whereConditions.AND ? [whereConditions.AND] : []);

            whereConditions = {
              ...whereConditions,
              AND: [
                ...existingAND,
                {
                  cells: {
                    some: { value: { path: ['text'], string_contains: globalSearch } },
                  },
                },
              ],
            };
 }
          
          // Limit fallback query to prevent timeout on large tables
          // Only fetch what we need for this page plus some buffer for sorting
          const maxFallbackRows = Math.max(1000, cursor + limit * 3);
          
          const allRows = await ctx.db.row.findMany({
            where: whereConditions,
            include: rowInclude,
            orderBy: { order: 'asc' },
            take: maxFallbackRows,
          }) as RowWithCells[];

          type FRule = typeof filterRules[number];

          function getCellText(row: RowWithCells, columnId: string) {
            const cell = row.cells.find(c => c.columnId === columnId);
            const v = (cell?.value as { text?: string } | null)?.text;
            return v == null ? '' : String(v);
          }

          function matchesRule(row: RowWithCells, rule: FRule) {
            const text = getCellText(row, rule.columnId);
            switch (rule.operator) {
              case 'is_empty':      return text === '';
              case 'is_not_empty':  return text !== '';
              case 'contains':      return rule.value != null && text.toLowerCase().includes(String(rule.value).toLowerCase());
              case 'not_contains':  return rule.value != null ? !text.toLowerCase().includes(String(rule.value).toLowerCase()) : true;
              case 'equals':
                return rule.columnType === 'NUMBER'
                  ? Number(text || '0') === Number(rule.value)
                  : text.toLowerCase() === String(rule.value ?? '').toLowerCase();
              case 'greater_than':  return Number(text || '0') > Number(rule.value);
              case 'less_than':     return Number(text || '0') < Number(rule.value);
              default:              return true;
            }
          }

          function groupByOr(rules: FRule[]) {
            const groups: FRule[][] = [];
            let curr: FRule[] = [];
            rules.forEach((r, i) => {
              const splitBefore = i > 0 && r.logicOperator === 'or';
              if (splitBefore) {
                if (curr.length) groups.push(curr);
                curr = [];
              }
              curr.push(r);
            });
            if (curr.length) groups.push(curr);
            return groups;
          }

          const groups = groupByOr(filterRules);
          const filteredRows = groups.length
            ? allRows.filter(row => groups.some(g => g.every(r => matchesRule(row, r))))
            : allRows;


          // Sort rows based on sort rules
          const sortedRows = filteredRows.sort((a, b) => {
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


  searchTable: protectedProcedure
    .input(z.object({
      tableId: z.string(),
      query: z.string().min(1),
      sortRules: z.array(z.object({
        columnId: z.string(),
        direction: z.enum(['asc', 'desc'])
      })).optional(),
      filterRules: z.array(z.object({
        id: z.string(),
        columnId: z.string(),
        columnName: z.string(),
        columnType: z.enum(['TEXT', 'NUMBER']),
        operator: z.enum(['is_empty', 'is_not_empty', 'contains', 'not_contains', 'equals', 'greater_than', 'less_than']),
        value: z.union([z.string(), z.number()]).optional(),
        logicOperator: z.enum(['and', 'or']).optional(),
      })).optional()
    }))
    .query(async ({ ctx, input }) => {
      const { tableId, query, sortRules = [], filterRules = [] } = input;
      
      // Search for matching column names
      const matchingColumns = await ctx.db.column.findMany({
        where: {
          tableId,
          name: {
            contains: query,
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
          name: true,
          order: true,
        },
      });

      // Search for matching cells using raw SQL with proper sorting that matches table display
      let matchingCells;
      
      if (sortRules.length === 0 && filterRules.length === 0) {
        // Use simple query when no sorting/filtering
        matchingCells = await ctx.db.$queryRaw<Array<{
          id: string;
          value: { text: string } | null;
          columnId: string;
          rowId: string;
          rowOrder: number;
          columnName: string;
          columnOrder: number;
        }>>`
          SELECT 
            c.id,
            c.value,
            c."columnId",
            c."rowId",
            r."order" as "rowOrder",
            col.name as "columnName",
            col."order" as "columnOrder"
          FROM "Cell" c
          JOIN "Row" r ON c."rowId" = r.id
          JOIN "Column" col ON c."columnId" = col.id
          WHERE col."tableId" = ${tableId}
          AND LOWER(c.value->>'text') LIKE LOWER(${`%${query}%`})
          ORDER BY r."order" ASC, col."order" ASC
        `;
      } else {
        // Use complex query that matches the table's current sort order
        // Get all rows with their current sort order first
        const sortExpressions = sortRules.map((rule, index) => {
          return `(CASE
            WHEN sort_col${index}.type = 'NUMBER' THEN
              LPAD(COALESCE(NULLIF(sort_c${index}.value->>'text', ''), '0'), 20, '0')
            ELSE
              LOWER(COALESCE(sort_c${index}.value->>'text', ''))
          END)`;
        });
        
        // Build filter conditions for the search query
        const buildFilterCondition = (rule: typeof filterRules[0], index: number, paramIndex: number) => {
          const cellValue = `filter_c${index}.value->>'text'`;
          switch (rule.operator) {
            case 'is_empty': 
              return `(${cellValue} IS NULL OR ${cellValue} = '')`;
            case 'is_not_empty': 
              return `(${cellValue} IS NOT NULL AND ${cellValue} != '')`;
            case 'contains': 
              return rule.value !== null && rule.value !== undefined 
                ? `LOWER(COALESCE(${cellValue}, '')) LIKE LOWER($${paramIndex})`
                : 'FALSE';
            case 'not_contains': 
              return rule.value !== null && rule.value !== undefined
                ? `(${cellValue} IS NULL OR LOWER(COALESCE(${cellValue}, '')) NOT LIKE LOWER($${paramIndex}))`
                : 'TRUE';
            case 'equals': 
              if (rule.columnType === 'NUMBER') {
                return `CAST(NULLIF(${cellValue}, '') AS NUMERIC) = $${paramIndex}`;
              }
              return `LOWER(COALESCE(${cellValue}, '')) = LOWER($${paramIndex})`;
            case 'greater_than': 
              return `CAST(NULLIF(${cellValue}, '') AS NUMERIC) > $${paramIndex}`;
            case 'less_than': 
              return `CAST(NULLIF(${cellValue}, '') AS NUMERIC) < $${paramIndex}`;
            default:
              return 'TRUE';
          }
        };

        const filterConditions: string[] = [];
        const queryParams = [tableId, `%${query}%`];
        let paramIndex = 3;

        filterRules.forEach((rule, index) => {
          const condition = buildFilterCondition(rule, index, paramIndex);
          filterConditions.push(condition);
          
          if (['contains', 'not_contains'].includes(rule.operator) && rule.value !== undefined && rule.value !== null) {
            queryParams.push(`%${rule.value}%`);
            paramIndex++;
          } else if (['equals', 'greater_than', 'less_than'].includes(rule.operator) && rule.value !== undefined && rule.value !== null) {
            queryParams.push(String(rule.value));
            paramIndex++;
          }
        });
        
        let sqlQuery = `
          SELECT 
            c.id,
            c.value,
            c."columnId",
            c."rowId",
            ROW_NUMBER() OVER (ORDER BY ${sortRules.length > 0 ? sortExpressions.map((expr, i) => `${expr} ${sortRules[i]!.direction.toUpperCase()} NULLS LAST`).join(', ') + ', r."order" ASC' : 'r."order" ASC'}) - 1 as "rowOrder",
            col.name as "columnName",
            col."order" as "columnOrder"
          FROM "Cell" c
          JOIN "Row" r ON c."rowId" = r.id
          JOIN "Column" col ON c."columnId" = col.id`;
        
        // Add JOINs for sorting
        sortRules.forEach((rule, index) => {
          sqlQuery += `
          LEFT JOIN "Cell" sort_c${index} ON r.id = sort_c${index}."rowId" AND sort_c${index}."columnId" = '${rule.columnId}'
          LEFT JOIN "Column" sort_col${index} ON sort_c${index}."columnId" = sort_col${index}.id`;
        });

        // Add JOINs for filtering
        filterRules.forEach((rule, index) => {
          sqlQuery += `
          LEFT JOIN "Cell" filter_c${index} ON r.id = filter_c${index}."rowId" AND filter_c${index}."columnId" = '${rule.columnId}'`;
        });
        
        sqlQuery += `
          WHERE col."tableId" = $1
          AND LOWER(c.value->>'text') LIKE LOWER($2)`;
        
        if (filterConditions.length > 0) {
          // fixed (splits BEFORE the rule flagged as 'or')
          const orGroups: string[] = [];
          let current: string[] = [];

          filterRules.forEach((rule, i) => {
            const splitBefore = i > 0 && rule.logicOperator === 'or';
            if (splitBefore) {
              if (current.length) orGroups.push(`(${current.join(' AND ')})`);
              current = [];
            }
            current.push(filterConditions[i]!);
          });

          if (current.length) orGroups.push(`(${current.join(' AND ')})`);
          sqlQuery += ` AND (${orGroups.join(' OR ')})`; 
        }
        
        
        sqlQuery += `
          ORDER BY ${sortRules.length > 0 ? sortExpressions.map((expr, i) => `${expr} ${sortRules[i]!.direction.toUpperCase()} NULLS LAST`).join(', ') + ', r."order" ASC' : 'r."order" ASC'}, col."order" ASC`;

        console.log('Search SQL Query:', sqlQuery);
        console.log('Search Query Params:', queryParams);

        matchingCells = await ctx.db.$queryRawUnsafe<Array<{
          id: string;
          value: { text: string } | null;
          columnId: string;
          rowId: string;
          rowOrder: number;
          columnName: string;
          columnOrder: number;
        }>>(sqlQuery, ...queryParams);
      }

      // Calculate statistics
      const uniqueRowIds = new Set(matchingCells.map(cell => cell.rowId));
      const fieldCount = matchingColumns.length;
      const cellCount = matchingCells.length;
      const recordCount = uniqueRowIds.size;

      // Combine results and sort by row order (higher rows first means lower order numbers first)
      const allResults = [
        ...matchingColumns.map(column => ({
          type: 'field' as const,
          id: column.id,
          name: column.name,
          columnId: column.id,
          columnOrder: column.order,
          rowId: null,
          rowOrder: -1, // Fields come before cells
        })),
        ...matchingCells.map(cell => ({
          type: 'cell' as const,
          id: cell.id,
          name: cell.columnName,
          columnId: cell.columnId,
          columnOrder: cell.columnOrder,
          rowId: cell.rowId,
          rowOrder: cell.rowOrder,
        })),
      ].sort((a, b) => {
        // Fields come before cells (fields have rowOrder -1)
        if (a.rowOrder === -1 && b.rowOrder !== -1) return -1;
        if (b.rowOrder === -1 && a.rowOrder !== -1) return 1;
        
        // For cells, sort by row order first, then column order
        if (a.rowOrder !== -1 && b.rowOrder !== -1) {
        if (a.rowOrder !== b.rowOrder) return a.rowOrder - b.rowOrder;
        return a.columnOrder - b.columnOrder;
      }
        
        // For fields only, sort by column order
        return a.columnOrder - b.columnOrder;
      });

      return {
        results: allResults,
        statistics: {
          fieldCount,
          cellCount,
          recordCount,
        },
      };
    }),
});