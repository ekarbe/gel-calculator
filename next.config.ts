/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/gel-calculator',
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig