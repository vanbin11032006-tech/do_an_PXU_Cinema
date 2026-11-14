interface ReceiptInput {
  amount: number;
  content: string;
  bank: string;
  account: string;
  owner: string;
  reference: string;
  at: string;
  status?: string;
}

/** Renders a realistic bank-transfer receipt image (SVG data URL) for the demo receipt queue. */
export function makeReceiptDataUrl(input: ReceiptInput): string {
  const amount = new Intl.NumberFormat('vi-VN').format(input.amount);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1120" viewBox="0 0 720 1120">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a3d91"/><stop offset="1" stop-color="#061f4d"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f8fafc"/><stop offset="1" stop-color="#e2e8f0"/>
    </linearGradient>
  </defs>
  <rect width="720" height="1120" fill="url(#bg)"/>
  <circle cx="640" cy="80" r="180" fill="#ffffff" opacity="0.05"/>
  <circle cx="60" cy="1040" r="220" fill="#ffffff" opacity="0.04"/>
  <text x="48" y="86" fill="#dbeafe" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="bold">${input.bank}</text>
  <text x="48" y="120" fill="#93c5fd" font-family="Arial, Helvetica, sans-serif" font-size="17">Biên lai chuyển khoản</text>
  <g transform="translate(48,168)">
    <rect width="624" height="700" rx="24" fill="url(#card)"/>
    <circle cx="312" cy="82" r="40" fill="#16a34a"/>
    <path d="M292 82 l14 15 l28 -30" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="312" y="152" fill="#0f172a" font-family="Arial, Helvetica, sans-serif" font-size="21" text-anchor="middle">Chuyển khoản thành công</text>
    <text x="312" y="224" fill="#0f172a" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="bold" text-anchor="middle">${amount} VND</text>
    <line x1="48" y1="268" x2="576" y2="268" stroke="#cbd5e1" stroke-dasharray="6 6"/>
    ${[
      ['Người nhận', input.owner],
      ['Số tài khoản', input.account],
      ['Nội dung', input.content],
      ['Mã giao dịch', input.reference],
      ['Thời gian', input.at],
      ['Trạng thái', input.status ?? 'Thành công'],
    ]
      .map(([k, v], i) => `<text x="48" y="${322 + i * 58}" fill="#64748b" font-family="Arial, Helvetica, sans-serif" font-size="18">${k}</text>
    <text x="576" y="${322 + i * 58}" fill="#0f172a" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="bold" text-anchor="end">${v}</text>`)
      .join('')}
    <rect x="48" y="672" width="528" height="1" fill="#cbd5e1"/>
  </g>
  <text x="360" y="928" fill="#bfdbfe" font-family="Arial, Helvetica, sans-serif" font-size="16" text-anchor="middle">Ảnh chụp màn hình giao dịch · PXU Cinema demo</text>
  <rect x="48" y="972" width="624" height="76" rx="16" fill="#ffffff" opacity="0.08"/>
  <text x="72" y="1018" fill="#e0f2fe" font-family="Arial, Helvetica, sans-serif" font-size="16">Hotline hỗ trợ 1900 6363 · hotro@pxucinema.vn</text>
</svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}
