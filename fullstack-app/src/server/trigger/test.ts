import {env} from '@/env';
import {getFile} from '@/server/utils/fileStorage';
import {logger, task, wait} from '@trigger.dev/sdk/v3';
import './init';

export const helloWorldTask = task({
  id: 'hello-world',
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 300, // Stop executing after 300 secs (5 mins) of compute
  run: async (payload: {data?: string}, {ctx}) => {
    logger.log('Hello, world!', {payload, ctx});

    await wait.for({seconds: 3});

    const suffix = payload.data ? `${payload.data}` : 'No payload';

    return {
      message: 'Hello, world! Payload: ' + suffix,
    };
  },
});

export const fileTestTask = task({
  id: 'file-test',
  run: async (payload: {filePath: string}, {ctx}) => {
    logger.log('File test', {payload, ctx});

    const file = await getFile({
      filePath: payload.filePath,
      mimeType: 'application/pdf',
    });

    const fileDetails = {
      name: file.name,
      size: file.size,
      text: await file.text(),
    };

    return {
      message: 'File test success',
      name: fileDetails.name,
      path: payload.filePath,
    };
  },
});

export const envVarTestTask = task({
  id: 'env-var-test',
  run: async (payload: null | undefined, {ctx}) => {
    logger.log('Env var test', {payload, ctx});

    const envVars = {
      environment: env.NODE_ENV,
      mockFileParsing: env.MOCK_FILE_PARSING,
    };

    return {
      message: 'Env var test success',
      envVars,
    };
  },
});
