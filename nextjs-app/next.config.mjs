/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, {isServer}) => {
    // Needed for webpack to know how to load '.node' files from 'chromadb' dependency.
    // See issue: https://github.com/chroma-core/chroma/issues/1178
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    });

    return config;
  },
  experimental: {
    // TODO: I hope this loader is compatible with Turbopack someday.
    // For now it isn't. Check on:
    // https://github.com/vercel/turborepo/issues/4265
    //
    // turbo: { rules: {
    //   '*.node': { loaders: ['node-loader'],
    //     },
    //   },
    // },
  },
};

export default nextConfig;
