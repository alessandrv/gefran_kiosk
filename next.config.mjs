/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Enable static export for Electron
  output: 'export',
  trailingSlash: true,
  distDir: 'out',
  // Configure asset prefix for Electron
  assetPrefix: process.env.NODE_ENV === 'production' ? './' : '',
  // Disable image optimization for static export
  images: {
    unoptimized: true,
    loader: 'custom',
    loaderFile: './lib/image-loader.js'
  },
}

export default nextConfig
