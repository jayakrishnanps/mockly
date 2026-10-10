import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      new URL("https://res.cloudinary.com/dfxb1wthw/image/upload/v1791311965/forwebapp_zietrc.png"),
      new URL("https://res.cloudinary.com/dfxb1wthw/image/upload/v1791560683/forJK-removebg-preview_lne58x.png"),
      new URL("https://res.cloudinary.com/dfxb1wthw/image/upload/v1791560683/forHE-removebg-preview_m1b6nq.png"),
    ],
  },
};

export default nextConfig;
