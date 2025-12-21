import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname,
        port: '',
        pathname: '/storage/**'
      },
      {
        protocol: 'https',
        hostname: 'shippo-static.s3.amazonaws.com',
        port: '',
        pathname: '/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
        port: '',
        pathname: '/**'
      }
    ]
  }
};

export default nextConfig;
