import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    NEXT_PUBLIC_TOGETHER_API_KEY: process.env.NEXT_PUBLIC_TOGETHER_API_KEY || '',
  },
  allowedDevOrigins: [
    '*.run.app',
    '*.us-west2.run.app',
    '*.asia-east1.run.app',
    '*.asia-east2.run.app',
    '*.us-central1.run.app',
    '*.europe-west1.run.app',
  ],
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  trailingSlash: true,
  devIndicators: false,
  images: {
    unoptimized: true,
  },
  output: 'export',
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
