import {createTRPCRouter, debugProcedure} from '../trpc';

export const debugRouter = createTRPCRouter({
  debug: debugProcedure.query(() => {
    return 'Hello World from a DEBUG router!';
  }),
});
