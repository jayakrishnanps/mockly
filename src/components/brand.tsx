import Image from "next/image";
import Link from "next/link";
import type { User } from "@/lib/users";

const logos = {
  default: "https://res.cloudinary.com/dfxb1wthw/image/upload/v1791311965/forwebapp_zietrc.png",
  JK: "https://res.cloudinary.com/dfxb1wthw/image/upload/v1791560683/forJK-removebg-preview_lne58x.png",
  HE: "https://res.cloudinary.com/dfxb1wthw/image/upload/v1791560683/forHE-removebg-preview_m1b6nq.png",
};

export function Brand({ user }: { user?: User | null }) {
  const content = (
    <>
      <Image
        src={logos[user ?? "default"]}
        alt=""
        width={48}
        height={48}
        sizes="(min-width: 640px) 44px, 40px"
        loading="eager"
        className="size-10 shrink-0 object-contain sm:size-11"
      />
      {user ? (
        <span className="identity-initials whitespace-nowrap text-xl" aria-hidden="true">
          {Array.from("mockly", (letter, index) => (
            <span
              key={index}
              className="brand-letter"
              style={{ animationDelay: `${index * 300}ms, ${16000 + index * 300}ms` }}
            >
              {letter}
            </span>
          ))}
          <span className="text-accent">.</span>
        </span>
      ) : (
        <span className="text-xl font-semibold tracking-tight">mockly<span className="text-accent">.</span></span>
      )}
    </>
  );
  const className = "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md";
  return user ? (
    <Link href={`/u/${user}`} className={className} aria-label={`Mockly — ${user}'s mocks`}>
      {content}
    </Link>
  ) : <div className={className}>{content}</div>;
}
