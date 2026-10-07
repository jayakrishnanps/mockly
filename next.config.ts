import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      new URL("https://res.cloudinary.com/dfxb1wthw/image/upload/v1791311965/forwebapp_zietrc.png"),
    ],
  },
};

export default nextConfig;
