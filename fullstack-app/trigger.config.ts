import {prismaExtension} from '@trigger.dev/build/extensions/prisma';
import {defineConfig, logger} from '@trigger.dev/sdk/v3';
import 'dotenv/config';

export default defineConfig({
  project: process.env.TRIGGER_DEV_PROJECT_ID!,
  runtime: 'node',
  logLevel: 'log',
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ['./src/server/trigger'],
  build: {
    external: ['sharp', 'onnxruntime-node'],
    extensions: [
      prismaExtension({
        schema: 'prisma/schema.prisma',
      }),
    ],
  },
  onStart: async (payload, {ctx}) => {
    if (ctx.environment.type === 'DEVELOPMENT') {
      logger.info('Task started', {
        taskId: ctx.task.id,
        attempt: ctx.attempt,
        payload,
      });
    }
  },
  onSuccess: async (payload, output, {ctx}) => {
    if (ctx.environment.type === 'DEVELOPMENT') {
      logger.info('Task succeeded', {
        taskId: ctx.task.id,
        attempt: ctx.attempt,
        output,
      });
    }
  },
  onFailure: async (payload, error, {ctx}) => {
    if (ctx.environment.type === 'DEVELOPMENT') {
      logger.error('Task failed', {
        taskId: ctx.task.id,
        attempt: ctx.attempt,
        error,
      });
    }
  },
});
