/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ["explorer.mantle.xyz"],
  },
};

module.exports = nextConfig;
