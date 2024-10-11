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
  experimental: {},
};

export default nextConfig;
