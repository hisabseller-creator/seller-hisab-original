import Image from "next/image";
import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="brand-root inline-flex shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      aria-label="SellerHisab home"
    >
      {compact ? (
        <Image
          src="/sellerhisab-mark.svg"
          alt="SellerHisab"
          width={512}
          height={512}
          className="h-9 w-9 object-contain"
          priority
        />
      ) : (
        <Image
          src="/sellerhisab-logo-horizontal.svg"
          alt="SellerHisab"
          width={1800}
          height={600}
          className="h-auto w-[102px] object-contain sm:w-[132px] lg:w-[148px]"
          priority
        />
      )}
    </Link>
  );
}
