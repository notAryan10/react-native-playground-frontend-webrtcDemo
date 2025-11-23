import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    turbo: {
      resolveAlias: {
        "react-native": "react-native-web"
      }
    }
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve?.alias || {}),
      'react-native': 'react-native-web'
    };
    return config;
  }
};

export default nextConfig;
