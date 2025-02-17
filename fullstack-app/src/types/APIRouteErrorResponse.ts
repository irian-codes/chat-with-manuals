import {type TRPCError} from '@trpc/server';

// Following the shape of TRPCClientError (but defining it from TRPCError
// because it's way easier to do)
export type APIRouteErrorResponse = {
  message: TRPCError['message'];
  data: {
    code: TRPCError['code'];
  };
};
