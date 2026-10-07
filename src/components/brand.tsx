import Link from "next/link";
import Image from "next/image";

export function Brand() {
  return (
    <Link href="/" className="inline-flex shrink-0 items-center gap-1.5 rounded-sm" aria-label="Mockly home">
      <Image
        src="https://res.cloudinary.com/dfxb1wthw/image/upload/v1791311965/forwebapp_zietrc.png"
        alt=""
        width={48}
        height={48}
        sizes="48px"
        className="size-12 shrink-0 object-contain"
      />
      <span className="text-xl font-semibold tracking-tight">mockly<span className="text-accent">.</span></span>
    </Link>
  );
}
