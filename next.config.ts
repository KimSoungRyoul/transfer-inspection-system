import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 컨테이너 이미지를 작게 만들기 위한 standalone 출력
  output: 'standalone',
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
