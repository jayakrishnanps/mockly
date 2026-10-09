import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      new URL("https://res.cloudinary.com/dfxb1wthw/image/upload/v1791311965/forwebapp_zietrc.png"),
      new URL("https://res.cloudinary.com/dfxb1wthw/image/upload/v1791558842/forJK_m6e0jp.png"),
      new URL("https://res.cloudinary.com/dfxb1wthw/image/upload/v1791558842/forHE_ncruhn.png"),
    ],
  },
};

export default nextConfig;
