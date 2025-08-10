import z from "zod";
import { faker } from "@faker-js/faker";

import {  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
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
                width: 200,
              },
              {
                name: "Email",
                type: "TEXT", 
                order: 1,
                width: 250,
              },
              {
                name: "Age",
                type: "NUMBER",
                order: 2,
                width: 100,
              },
              {
                name: "Status",
                type: "TEXT",
                order: 3,
                width: 150,
              },
              {
                name: "Score",
                type: "NUMBER",
                order: 4,
                width: 120,
              },
            ],
          },
        },
        include: {
          columns: true,
        },
      });

      // Generate sample data if requested
      if (input.generateSampleData) {
        const rows = [];
        const cells = [];

        // Create 100 sample rows
        for (let i = 0; i < 100; i++) {
          const row = await ctx.db.row.create({
            data: {
              tableId: table.id,
              order: i,
            },
          });
          rows.push(row);

          // Create cells for each column
          for (const column of table.columns) {
            let value;
            
            switch (column.name) {
              case "Name":
                value = { text: faker.person.fullName() };
                break;
              case "Email":
                value = { text: faker.internet.email() };
                break;
              case "Age":
                value = { number: faker.number.int({ min: 18, max: 80 }) };
                break;
              case "Status":
                value = { text: faker.helpers.arrayElement(["Active", "Pending", "Inactive"]) };
                break;
              case "Score":
                value = { number: faker.number.float({ min: 0, max: 100 }) };
                break;
              default:
                value = { text: faker.lorem.word() };
            }

            cells.push({
              rowId: row.id,
              columnId: column.id,
              value,
            });
          }
        }

        // Bulk insert cells
        await ctx.db.cell.createMany({
          data: cells,
        });
      }

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
        orderBy: { createdAt: "desc" },
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
});