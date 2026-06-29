/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@builder/shared', '@builder/ui'],
  output: 'standalone',
};

export default nextConfig;
