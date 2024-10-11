/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, {isServer}) => {
    // Ignoring this module for the browser since it's not needed and
    // causes issues:
    // See https://huggingface.co/docs/transformers.js/tutorials/next
    config.resolve.alias = {
      ...config.resolve.alias,
      'onnxruntime-node$': false,
    };

    return config;
  },
  experimental: {
    turbo: {
      // See https://nextjs.org/docs/app/api-reference/next-config-js/turbo#resolve-aliases
      resolveAlias: {
        'onnxruntime-node': {browser: ''},
      },
    },
  },
};

export default nextConfig;
