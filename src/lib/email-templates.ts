interface BackorderItem {
  customerName: string;
  invoiceNumber: string;
  driverName: string;
  backorderNotes: string;
}

interface DeliveryItem {
  customerName: string;
  invoiceNumber: string;
  driverName: string;
  completedAt: string | null;
  dwellSeconds: number | null;
  hasBackorder: boolean;
}

interface DriverSummary {
  name: string;
  totalStops: number;
  completedStops: number;
  completedAt: string | null;
}

interface BackorderSummaryData {
  date: string;
  totalDelivered: number;
  totalBackorders: number;
  totalDrivers: number;
  backorders: BackorderItem[];
  drivers: DriverSummary[];
  deliveries?: DeliveryItem[];
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
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
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDwell(seconds: number | null): string {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function buildBackorderSummaryHtml(data: BackorderSummaryData): string {
  const hasBackorders = data.totalBackorders > 0;
  const statusColor = hasBackorders ? '#E53935' : '#2E7D32';
  const statusBg = hasBackorders ? '#FFF5F5' : '#F0FAF0';
  const statusLabel = hasBackorders ? `${data.totalBackorders} Backorder${data.totalBackorders > 1 ? 's' : ''}` : 'All Clear';

  // Backorder cards
  const backorderSection = hasBackorders
    ? data.backorders
        .map(
          (bo) => `
    <tr><td style="padding:0 0 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #FFCDD2;">
        <tr>
          <td style="background:#FFF5F5;padding:14px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td>
                <span style="font-size:15px;font-weight:600;color:#212121;">${bo.customerName}</span><br>
                <span style="font-size:12px;color:#888;">INV #${bo.invoiceNumber} &nbsp;&middot;&nbsp; ${bo.driverName}</span>
              </td>
              <td align="right" valign="top">
                <span style="background:#E53935;color:#fff;font-size:10px;font-weight:700;padding:4px 10px;border-radius:4px;text-transform:uppercase;letter-spacing:0.5px;">Backorder</span>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="background:#fff;padding:14px 20px;border-top:1px solid #FFCDD2;">
            <span style="font-size:14px;color:#333;line-height:1.7;">${bo.backorderNotes
              .split(/[,;\n]/)
              .map((item) => item.trim())
              .filter(Boolean)
              .map((item) => `&bull;&nbsp; ${item}`)
              .join('<br>')}</span>
          </td>
        </tr>
      </table>
    </td></tr>`,
        )
        .join('')
    : `<tr><td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #C8E6C9;">
          <td style="background:#F0FAF0;padding:28px 20px;text-align:center;">
            <span style="font-size:28px;">&#10004;</span><br>
            <span style="font-size:16px;font-weight:600;color:#2E7D32;margin-top:4px;display:inline-block;">No Backorders Today</span><br>
            <span style="font-size:13px;color:#666;">Every delivery was fulfilled completely.</span>
          </td>
        </table>
      </td></tr>`;

  // Driver rows
  const driverRows = data.drivers
    .map(
      (d) => `
    <tr>
      <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#212121;border-bottom:1px solid #F0F0F0;">${d.name}</td>
      <td style="padding:10px 16px;font-size:14px;color:#555;border-bottom:1px solid #F0F0F0;" align="center">${d.completedStops ?? d.totalStops} / ${d.totalStops}</td>
      <td style="padding:10px 16px;font-size:14px;color:#555;border-bottom:1px solid #F0F0F0;" align="center">${formatTime(d.completedAt)}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #F0F0F0;" align="center">
        <span style="background:${(d.completedStops ?? d.totalStops) >= d.totalStops ? '#F0FAF0' : '#FFF8E1'};color:${(d.completedStops ?? d.totalStops) >= d.totalStops ? '#2E7D32' : '#F57F17'};font-size:11px;font-weight:700;padding:3px 10px;border-radius:4px;">${(d.completedStops ?? d.totalStops) >= d.totalStops ? 'Complete' : 'In Progress'}</span>
      </td>
    </tr>`,
    )
    .join('');

  // Delivery log rows
  const deliveryRows = (data.deliveries ?? [])
    .map(
      (d) => `
    <tr>
      <td style="padding:8px 16px;font-size:13px;color:#212121;border-bottom:1px solid #F5F5F5;">${d.customerName}</td>
      <td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #F5F5F5;" align="center">${d.invoiceNumber}</td>
      <td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #F5F5F5;" align="center">${d.driverName}</td>
      <td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #F5F5F5;" align="center">${formatTime(d.completedAt)}</td>
      <td style="padding:8px 16px;font-size:13px;color:#555;border-bottom:1px solid #F5F5F5;" align="center">${formatDwell(d.dwellSeconds)}</td>
      <td style="padding:8px 16px;border-bottom:1px solid #F5F5F5;" align="center">${d.hasBackorder ? '<span style="color:#E53935;font-size:11px;font-weight:700;">BO</span>' : '<span style="color:#2E7D32;font-size:14px;">&#10003;</span>'}</td>
    </tr>`,
    )
    .join('');

  const deliverySection = (data.deliveries ?? []).length > 0
    ? `
    <!-- Delivery Log -->
    <tr><td style="padding:32px 40px 12px;">
      <span style="font-size:16px;font-weight:700;color:#212121;">Delivery Log</span>
    </td></tr>
    <tr><td style="padding:0 40px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #E0E0E0;">
        <tr style="background:#FAFAFA;">
          <td style="padding:10px 16px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Customer</td>
          <td style="padding:10px 16px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;" align="center">Invoice</td>
          <td style="padding:10px 16px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;" align="center">Driver</td>
          <td style="padding:10px 16px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;" align="center">Time</td>
          <td style="padding:10px 16px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;" align="center">Dwell</td>
          <td style="padding:10px 16px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;" align="center">Status</td>
        </tr>
        ${deliveryRows}
      </table>
    </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#EEEEEE;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#EEEEEE;padding:32px 16px;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

<!-- Top Accent Bar -->
<tr><td style="height:4px;background:${statusColor};"></td></tr>

<!-- Header -->
<tr>
<td style="padding:32px 40px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td>
      <span style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1.5px;">Mobile Janitorial Supply</span><br>
      <span style="font-size:22px;font-weight:700;color:#212121;letter-spacing:-0.3px;line-height:1.4;">Daily Delivery Report</span><br>
      <span style="font-size:13px;color:#999;">${formatDate(data.date)}</span>
    </td>
    <td align="right" valign="top">
      <table cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid ${hasBackorders ? '#FFCDD2' : '#C8E6C9'};">
        <td style="background:${statusBg};padding:10px 18px;text-align:center;">
          <span style="font-size:20px;font-weight:800;color:${statusColor};line-height:1;">${hasBackorders ? data.totalBackorders : '&#10003;'}</span><br>
          <span style="font-size:10px;font-weight:700;color:${statusColor};text-transform:uppercase;letter-spacing:0.5px;">${statusLabel}</span>
        </td>
      </table>
    </td>
  </tr></table>
</td>
</tr>

<!-- Stat Cards -->
<tr>
<td style="padding:0 40px 28px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="33%" style="padding-right:8px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;border:1px solid #E0E0E0;overflow:hidden;">
        <td style="padding:16px;text-align:center;">
          <span style="font-size:28px;font-weight:800;color:#212121;">${data.totalDelivered}</span><br>
          <span style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Delivered</span>
        </td>
      </table>
    </td>
    <td width="33%" style="padding:0 4px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;border:1px solid #E0E0E0;overflow:hidden;">
        <td style="padding:16px;text-align:center;">
          <span style="font-size:28px;font-weight:800;color:${hasBackorders ? '#E53935' : '#212121'};">${data.totalBackorders}</span><br>
          <span style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Backorders</span>
        </td>
      </table>
    </td>
    <td width="33%" style="padding-left:8px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;border:1px solid #E0E0E0;overflow:hidden;">
        <td style="padding:16px;text-align:center;">
          <span style="font-size:28px;font-weight:800;color:#212121;">${data.totalDrivers}</span><br>
          <span style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Drivers</span>
        </td>
      </table>
    </td>
  </tr></table>
</td>
</tr>

<!-- Divider -->
<tr><td style="padding:0 40px;"><div style="border-top:1px solid #F0F0F0;"></div></td></tr>

<!-- Backorders Section -->
<tr><td style="padding:24px 40px 12px;">
  <span style="font-size:16px;font-weight:700;color:#212121;">${hasBackorders ? 'Backorder Details' : 'Backorder Status'}</span>
</td></tr>
<tr><td style="padding:0 40px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    ${backorderSection}
  </table>
</td></tr>

<!-- Divider -->
<tr><td style="padding:8px 40px;"><div style="border-top:1px solid #F0F0F0;"></div></td></tr>

<!-- Driver Summary -->
<tr><td style="padding:24px 40px 12px;">
  <span style="font-size:16px;font-weight:700;color:#212121;">Driver Summary</span>
</td></tr>
<tr><td style="padding:0 40px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #E0E0E0;">
    <tr style="background:#FAFAFA;">
      <td style="padding:10px 16px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Driver</td>
      <td style="padding:10px 16px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;" align="center">Stops</td>
      <td style="padding:10px 16px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;" align="center">Last Drop</td>
      <td style="padding:10px 16px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;" align="center">Status</td>
    </tr>
    ${driverRows}
  </table>
</td></tr>

${deliverySection}

<!-- Footer -->
<tr>
<td style="padding:32px 40px;">
  <div style="border-top:1px solid #F0F0F0;padding-top:20px;">
    <span style="font-size:12px;color:#AAA;line-height:1.7;">
      ${hasBackorders ? 'Backorders listed above require fulfillment. Please coordinate with warehouse.' : 'No action required — all deliveries fulfilled.'}<br>
      Automated daily report &middot; 5:05 PM PT
    </span><br>
    <span style="font-size:11px;color:#CCC;margin-top:8px;display:inline-block;">
      Mobile Janitorial Supply &middot; 3066 E La Palma Ave, Anaheim, CA 92806
    </span>
  </div>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
