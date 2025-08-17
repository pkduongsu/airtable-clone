import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { baseRouter } from "./routers/base";
import { tableRouter } from "./routers/table";
import { viewRouter } from "./routers/view";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  base: baseRouter,
  table: tableRouter,
  view: viewRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.base.list();
 */
export const createCaller = createCallerFactory(appRouter);
