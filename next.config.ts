/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/gel-calculator',
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['192.168.1.76'],
}

module.exports = nextConfig