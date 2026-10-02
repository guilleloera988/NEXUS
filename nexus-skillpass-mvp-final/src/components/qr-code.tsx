import QRCode from 'qrcode';

/**
 * Real, scannable QR code rendered server-side as SVG. It encodes exactly `value`
 * (the public verification URL) — never a decorative pattern.
 */
export async function QrCode({ value, size = 176, label, className = '' }: { value: string; size?: number; label: string; className?: string }) {
  const svg = await QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#08080aff', light: '#ffffffff' } });
  return (
    <figure className={`inline-block rounded-xl bg-white p-2 ${className}`} style={{ width: size, height: size }}>
      <div role="img" aria-label={label} className="size-full [&>svg]:size-full" data-qr-value={value}
        // SVG produced by the qrcode library from the URL; no user-controlled markup is interpolated.
        dangerouslySetInnerHTML={{ __html: svg }} />
    </figure>
  );
}
