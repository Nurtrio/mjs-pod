interface BackorderItem {
  customerName: string;
  invoiceNumber: string;
  driverName: string;
  backorderNotes: string;
}

interface DriverSummary {
  name: string;
  totalStops: number;
  completedAt: string | null;
}

interface BackorderSummaryData {
  date: string;
  totalDelivered: number;
  totalBackorders: number;
  totalDrivers: number;
  backorders: BackorderItem[];
  drivers: DriverSummary[];
}

function formatTime(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Los_Angeles',
  });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function buildBackorderSummaryHtml(data: BackorderSummaryData): string {
  const backorderCards = data.backorders
    .map(
      (bo) => `
    <tr>
    <td style="padding:0 40px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fee2e2;border-radius:12px;overflow:hidden;">
    <tr>
    <td style="background:#fef2f2;padding:14px 18px;border-bottom:1px solid #fee2e2;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td>
      <p style="margin:0;font-size:15px;font-weight:700;color:#1a1a1a;">${bo.customerName}</p>
      <p style="margin:2px 0 0;font-size:12px;color:#888;">INV #${bo.invoiceNumber} &bull; Driver: ${bo.driverName}</p>
    </td>
    <td align="right">
      <span style="background:#ff3b30;color:#fff;font-size:10px;font-weight:700;padding:4px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;">Backorder</span>
    </td>
    </tr></table>
    </td>
    </tr>
    <tr>
    <td style="padding:14px 18px;">
      <p style="margin:0;font-size:14px;color:#333;line-height:1.6;">${bo.backorderNotes
        .split(/[,;\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => `&#9679;&nbsp;&nbsp;${item}`)
        .join('<br>')}</p>
    </td>
    </tr>
    </table>
    </td>
    </tr>`,
    )
    .join('\n');

  const driverRows = data.drivers
    .map(
      (d) => `
    <tr>
    <td style="padding:12px 14px;font-size:14px;font-weight:600;color:#1a1a1a;border-top:1px solid #f0f0f0;">${d.name}</td>
    <td style="padding:12px 14px;font-size:14px;color:#333;border-top:1px solid #f0f0f0;">${d.totalStops}</td>
    <td style="padding:12px 14px;font-size:14px;color:#333;border-top:1px solid #f0f0f0;">${formatTime(d.completedAt)}</td>
    <td style="padding:12px 14px;border-top:1px solid #f0f0f0;"><span style="background:#f0fdf4;color:#34c759;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">Done</span></td>
    </tr>`,
    )
    .join('\n');

  const noBackordersSection =
    data.backorders.length === 0
      ? `<tr><td style="padding:0 40px 12px;">
          <div style="background:#f0fdf4;border:1px solid #dcfce7;border-radius:12px;padding:24px;text-align:center;">
            <p style="margin:0;font-size:20px;">&#10003;</p>
            <p style="margin:8px 0 0;font-size:16px;font-weight:700;color:#34c759;">No Backorders Today</p>
            <p style="margin:4px 0 0;font-size:13px;color:#888;">All deliveries were fulfilled completely.</p>
          </div>
        </td></tr>`
      : '';

  return `<html>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

<!-- Header -->
<tr>
<td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:32px 40px;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td>
<p style="margin:0;font-size:13px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1.5px;">Mobile Janitorial Supply</p>
<h1 style="margin:8px 0 0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Daily Backorder Summary</h1>
</td>
<td align="right" valign="top">
<div style="background:${data.totalBackorders > 0 ? 'rgba(255,59,48,0.15)' : 'rgba(52,199,89,0.15)'};border-radius:12px;padding:10px 16px;display:inline-block;">
<p style="margin:0;font-size:24px;font-weight:800;color:${data.totalBackorders > 0 ? '#ff3b30' : '#34c759'};line-height:1;">${data.totalBackorders}</p>
<p style="margin:2px 0 0;font-size:10px;font-weight:600;color:${data.totalBackorders > 0 ? '#ff6b6b' : '#4ade80'};text-transform:uppercase;letter-spacing:0.5px;">Backorders</p>
</div>
</td>
</tr>
</table>
<p style="margin:16px 0 0;font-size:14px;color:rgba(255,255,255,0.45);">${formatDate(data.date)} &bull; Report generated at 5:05 PM</p>
</td>
</tr>

<!-- Summary Stats -->
<tr>
<td style="padding:28px 40px 0;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td width="33%" style="padding:12px 8px 12px 0;">
<div style="background:#f0fdf4;border-radius:12px;padding:16px;text-align:center;">
<p style="margin:0;font-size:28px;font-weight:800;color:#34c759;">${data.totalDelivered}</p>
<p style="margin:4px 0 0;font-size:11px;font-weight:600;color:#22c55e;text-transform:uppercase;letter-spacing:0.5px;">Delivered</p>
</div>
</td>
<td width="33%" style="padding:12px 4px;">
<div style="background:${data.totalBackorders > 0 ? '#fef2f2' : '#f0fdf4'};border-radius:12px;padding:16px;text-align:center;">
<p style="margin:0;font-size:28px;font-weight:800;color:${data.totalBackorders > 0 ? '#ff3b30' : '#34c759'};">${data.totalBackorders}</p>
<p style="margin:4px 0 0;font-size:11px;font-weight:600;color:${data.totalBackorders > 0 ? '#ef4444' : '#22c55e'};text-transform:uppercase;letter-spacing:0.5px;">Backorders</p>
</div>
</td>
<td width="33%" style="padding:12px 0 12px 8px;">
<div style="background:#f0f9ff;border-radius:12px;padding:16px;text-align:center;">
<p style="margin:0;font-size:28px;font-weight:800;color:#007aff;">${data.totalDrivers}</p>
<p style="margin:4px 0 0;font-size:11px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.5px;">Drivers</p>
</div>
</td>
</tr>
</table>
</td>
</tr>

<!-- Backorder Section -->
<tr>
<td style="padding:28px 40px 12px;">
<h2 style="margin:0;font-size:18px;font-weight:700;color:#1a1a1a;letter-spacing:-0.3px;">${data.totalBackorders > 0 ? 'Backorder Details' : 'Delivery Status'}</h2>
<p style="margin:4px 0 0;font-size:13px;color:#888;">${data.totalBackorders > 0 ? 'Items that need to be fulfilled' : 'All orders delivered in full'}</p>
</td>
</tr>

${data.totalBackorders > 0 ? backorderCards : noBackordersSection}

<!-- Driver Table -->
<tr>
<td style="padding:20px 40px 12px;">
<h2 style="margin:0;font-size:18px;font-weight:700;color:#1a1a1a;letter-spacing:-0.3px;">Driver Summary</h2>
</td>
</tr>
<tr>
<td style="padding:0 40px 8px;">
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
<tr style="background:#f9fafb;">
<td style="padding:10px 14px;font-size:12px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Driver</td>
<td style="padding:10px 14px;font-size:12px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Stops</td>
<td style="padding:10px 14px;font-size:12px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Completed</td>
<td style="padding:10px 14px;font-size:12px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Status</td>
</tr>
${driverRows}
</table>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:28px 40px 32px;">
<div style="border-top:1px solid #eee;padding-top:20px;">
<p style="margin:0;font-size:12px;color:#aaa;line-height:1.6;">
This is an automated daily summary from the MJS Proof of Delivery system.<br>
${data.totalBackorders > 0 ? 'Backorders listed above require fulfillment. Please coordinate with warehouse.' : 'No action required — all deliveries complete.'}
</p>
<p style="margin:12px 0 0;font-size:12px;color:#ccc;">
Mobile Janitorial Supply &bull; 3066 E La Palma Ave, Anaheim, CA 92806
</p>
</div>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
