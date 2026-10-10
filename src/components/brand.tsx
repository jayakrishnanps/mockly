import Image from "next/image";

const logos = {
  default: "https://res.cloudinary.com/dfxb1wthw/image/upload/v1791311965/forwebapp_zietrc.png",
  JK: "https://res.cloudinary.com/dfxb1wthw/image/upload/v1791560683/forJK-removebg-preview_lne58x.png",
  HE: "https://res.cloudinary.com/dfxb1wthw/image/upload/v1791560683/forHE-removebg-preview_m1b6nq.png",
};

export function Brand() {
  return (
    <div className="inline-flex shrink-0 items-center gap-1.5">
      {Object.entries(logos).map(([user, src]) => (
        <Image
          key={user}
          src={src}
          alt=""
          width={48}
          height={48}
          sizes="48px"
          data-brand-user={user}
          className="brand-logo size-12 shrink-0 object-contain"
        />
      ))}
      <span className="text-xl font-semibold tracking-tight">mockly<span className="text-accent">.</span></span>
    </div>
  );
}
