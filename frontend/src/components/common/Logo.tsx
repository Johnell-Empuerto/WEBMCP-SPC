interface LogoProps {
  className?: string
  size?: number
}

export default function Logo({ className, size = 32 }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="NXPERT EON"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain" }}
    />
  )
}
