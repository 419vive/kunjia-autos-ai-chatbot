import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { sanitizeSearchQuery } from "../security";

export const vehicleRouter = router({
  list: publicProcedure.query(async () => {
    return db.getAllVehicles();
  }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getVehicleById(input.id);
    }),

  search: publicProcedure
    .input(z.object({
      brand: z.string().optional(),
      model: z.string().optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
      minYear: z.string().optional(),
      maxYear: z.string().optional(),
      fuelType: z.string().optional(),
      bodyType: z.string().optional(),
      query: z.string().optional(),
    }))
    .query(async ({ input }) => {
      // SECURITY: Sanitize search inputs to prevent SQL LIKE injection
      const sanitizedInput = {
        ...input,
        brand: input.brand ? sanitizeSearchQuery(input.brand) : undefined,
        model: input.model ? sanitizeSearchQuery(input.model) : undefined,
        bodyType: input.bodyType ? sanitizeSearchQuery(input.bodyType) : undefined,
        query: input.query ? sanitizeSearchQuery(input.query) : undefined,
      };
      return db.searchVehicles(sanitizedInput);
    }),

  brands: publicProcedure.query(async () => {
    return db.getVehicleBrands();
  }),
});
