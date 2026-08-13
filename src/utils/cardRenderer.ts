import QRCode from 'qrcode';
import { CardData } from '../types';

/**
 * Generates a high-contrast QR code image from the card data.
 */
async function generateQRCodeImage(data: CardData): Promise<HTMLImageElement | null> {
  const payloadLines = [
    data.idNumber ? `ID: ${data.idNumber.trim()}` : '',
    data.name ? `Name: ${data.name.trim()}` : '',
    data.phoneNumber ? `Phone: ${data.phoneNumber.trim()}` : '',
    data.address ? `Address: ${data.address.trim()}` : ''
  ].filter(Boolean);

  const qrText = payloadLines.length > 0 ? payloadLines.join('\n') : 'TIRANGA-ID-CARD-2026';

  try {
    const dataUrl = await QRCode.toDataURL(qrText, {
      margin: 1,
      width: 400,
      color: {
        dark: '#0B1224',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });
    return await loadImageSafe(dataUrl, 3000);
  } catch (err) {
    console.error('Failed to generate QR code:', err);
    return null;
  }
}

/**
 * Draws the Ashoka Chakra (24-spoke wheel) at (cx, cy) with radius r.
 */
function drawAshokaChakra(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string = '#000080'
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, r / 9);

  // Outer circle
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Inner hub
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // 24 spokes
  const spokes = 24;
  for (let i = 0; i < spokes; i++) {
    const angle = (i * Math.PI * 2) / spokes;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    ctx.stroke();
  }

  // Small dots on rim between spokes
  for (let i = 0; i < spokes; i++) {
    const angle = ((i + 0.5) * Math.PI * 2) / spokes;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * (r * 0.9), cy + Math.sin(angle) * (r * 0.9), r * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Helper to draw a rounded rectangle path.
 */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | { tl: number; tr: number; br: number; bl: number }
) {
  const r = typeof radius === 'number'
    ? { tl: radius, tr: radius, br: radius, bl: radius }
    : radius;

  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + width - r.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r.tr);
  ctx.lineTo(x + width, y + height - r.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r.br, y + height);
  ctx.lineTo(x + r.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  ctx.closePath();
}

/**
 * Safely loads an image from URL with crossOrigin support and fallback timeout.
 */
function loadImageSafe(url: string, timeoutMs: number = 3000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let timer: NodeJS.Timeout | null = setTimeout(() => {
      timer = null;
      resolve(null);
    }, timeoutMs);

    img.onload = () => {
      if (timer) {
        clearTimeout(timer);
        resolve(img);
      }
    };
    img.onerror = () => {
      if (timer) {
        clearTimeout(timer);
        resolve(null);
      }
    };
    img.src = url;
  });
}

/**
 * Draws a clean Indian Tricolor flag box.
 */
function drawSmallFlag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  flagImg?: HTMLImageElement | null
) {
  ctx.save();
  roundedRect(ctx, x, y, w, h, 4);
  ctx.clip();

  if (flagImg) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, w, h);

    const imgRatio = flagImg.width / flagImg.height;
    const boxRatio = w / h;
    let renderW = w;
    let renderH = h;
    let offsetX = 0;
    let offsetY = 0;

    if (imgRatio > boxRatio) {
      renderW = h * imgRatio;
      offsetX = (w - renderW) / 2;
    } else {
      renderH = w / imgRatio;
      offsetY = (h - renderH) / 2;
    }

    ctx.drawImage(flagImg, x + offsetX, y + offsetY, renderW, renderH);
  } else {
    const stripeH = h / 3;

    // Saffron
    ctx.fillStyle = '#FF9933';
    ctx.fillRect(x, y, w, stripeH);

    // White
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y + stripeH, w, stripeH);

    // Green
    ctx.fillStyle = '#138808';
    ctx.fillRect(x, y + stripeH * 2, w, stripeH);

    // Ashoka Chakra
    drawAshokaChakra(ctx, x + w / 2, y + h / 2, stripeH * 0.42, '#000080');
  }
  ctx.restore();

  // Flag Border
  ctx.save();
  roundedRect(ctx, x, y, w, h, 4);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#D1D5DB';
  ctx.stroke();
  ctx.restore();
}

/**
 * Renders the high-resolution 1600x1000 Indian Card onto the canvas.
 * Perfectly calibrated to match the reference design 1:1.
 */
export async function renderCardToCanvas(
  canvas: HTMLCanvasElement,
  data: CardData
): Promise<void> {
  canvas.width = 1600;
  canvas.height = 1000;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, 1600, 1000);

  // Load external assets in parallel
  const satyaImgPromise = loadImageSafe('./assets/satya1.png', 4000);
  const xbLogoPromise = loadImageSafe('./assets/brand-logo.png', 4000);
  const tirangaImgPromise = loadImageSafe('./assets/tiranga photo.png', 4000);
  const bgImgPromise = loadImageSafe('./assets/card_bg.jpg', 4000);
  const qrImgPromise = generateQRCodeImage(data);

  let userPhotoImg: HTMLImageElement | null = null;
  if (data.photoUrl) {
    userPhotoImg = await loadImageSafe(data.photoUrl, 4000);
  }

  const satyaImg = await satyaImgPromise;
  const xbLogo = await xbLogoPromise;
  const tirangaImg = await tirangaImgPromise;
  const cardBgImg = await bgImgPromise;
  const qrImg = await qrImgPromise;

  // Card Outer Dimensions & Margins
  const x = 10;
  const y = 10;
  const w = 1580;
  const h = 980;
  const cardRadius = 28;

  // ----------------------------------------------------
  // 1. CARD BASE & BORDERS
  // ----------------------------------------------------
  ctx.save();
  // Card Cream Background
  roundedRect(ctx, x, y, w, h, cardRadius);
  ctx.fillStyle = '#FFFDF5';
  ctx.fill();

  // Outer Gold Border Line
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#FB9E28';
  ctx.stroke();
  ctx.restore();

  // Clip content inside rounded card boundary
  ctx.save();
  roundedRect(ctx, x, y, w, h, cardRadius);
  ctx.clip();

  // Draw background image if available
  if (cardBgImg) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.drawImage(cardBgImg, x, y, w, h);
    ctx.restore();
  }

  // Fine Gold Double-Frame Accent Line inside outer border
  ctx.save();
  const innerInset = 16;
  roundedRect(ctx, x + innerInset, y + innerInset, w - innerInset * 2, h - innerInset * 2, cardRadius - 8);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#F3C068';
  ctx.stroke();
  ctx.restore();

  // ----------------------------------------------------
  // 2. HEADER BANNER (SAFFRON ORANGE)
  // ----------------------------------------------------
  const headerHeight = 200;
  const headerGrad = ctx.createLinearGradient(x, y, x + w, y);
  headerGrad.addColorStop(0, '#FB9E28');
  headerGrad.addColorStop(0.5, '#F99B1C');
  headerGrad.addColorStop(1, '#F57C00');

  ctx.fillStyle = headerGrad;
  ctx.fillRect(x, y, w, headerHeight);

  // Header bottom gold stripe
  ctx.fillStyle = '#F5AF00';
  ctx.fillRect(x, y + headerHeight, w, 5);

  // Header Left Emblem (Circle with Ashoka Chakra)
  const emblemX = x + 95;
  const emblemY = y + 100;
  const emblemRadius = 50;

  ctx.save();
  ctx.beginPath();
  ctx.arc(emblemX, emblemY, emblemRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#FFB300';
  ctx.stroke();

  drawAshokaChakra(ctx, emblemX, emblemY, 36, '#000080');
  ctx.restore();

  // Header Titles
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 50px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('मेरा भारत , मेरी पहचान', emblemX + 75, y + 88);

  ctx.fillStyle = '#FFFDF0';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('PERSONAL IDENTITY CARD • INDIAN PATRIOTIC EDITION', emblemX + 75, y + 135);

  // Top-Right White Pill Badge ("★ गर्व से कहें – हम भारतीय हैं ★")
  const badgeW = 510;
  const badgeH = 66;
  const badgeX = x + w - badgeW - 35;
  const badgeY = y + 67;

  ctx.save();
  roundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 33);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  // Badge subtle shadow
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  // Small flag inside badge
  drawSmallFlag(ctx, badgeX + 18, badgeY + 13, 56, 40, tirangaImg);

  // Text inside badge
  ctx.fillStyle = '#222222';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('★ गर्व से कहें – हम भारतीय हैं ★', badgeX + 295, badgeY + 42);
  ctx.restore();

  // ----------------------------------------------------
  // 3. MAIN CARD BODY
  // ----------------------------------------------------
  const bodyY = y + headerHeight + 5;

  // --- Photo Section (Left) ---
  const photoX = x + 70;
  const photoY = bodyY + 35;
  const photoW = 320;
  const photoH = 440;
  const photoRadius = 24;

  // Outer photo box with dual border (Orange top/sides & Green bottom)
  ctx.save();
  roundedRect(ctx, photoX, photoY, photoW, photoH, photoRadius);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();

  // Green bottom stroke
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#138808';
  ctx.stroke();

  // Orange top/sides stroke
  ctx.save();
  ctx.beginPath();
  roundedRect(ctx, photoX, photoY, photoW, photoH - 30, { tl: photoRadius, tr: photoRadius, bl: 0, br: 0 });
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#FF9800';
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  // Render User Photo or Fallback Avatar
  if (userPhotoImg) {
    ctx.save();
    roundedRect(ctx, photoX + 5, photoY + 5, photoW - 10, photoH - 10, photoRadius - 4);
    ctx.clip();

    const imgRatio = userPhotoImg.width / userPhotoImg.height;
    const boxRatio = photoW / photoH;
    let renderW = photoW;
    let renderH = photoH;
    let offsetX = 0;
    let offsetY = 0;

    if (imgRatio > boxRatio) {
      renderW = photoH * imgRatio;
      offsetX = (photoW - renderW) / 2;
    } else {
      renderH = photoW / imgRatio;
      offsetY = (photoH - renderH) / 2;
    }

    ctx.drawImage(userPhotoImg, photoX + offsetX, photoY + offsetY, renderW, renderH);
    ctx.restore();
  } else {
    // Default Avatar Graphic
    ctx.save();
    const avatarCx = photoX + photoW / 2;
    const avatarCy = photoY + photoH / 2 - 25;

    // Head
    ctx.beginPath();
    ctx.arc(avatarCx, avatarCy - 20, 52, 0, Math.PI * 2);
    ctx.fillStyle = '#CBD5E1';
    ctx.fill();

    // Body Arc
    ctx.beginPath();
    ctx.arc(avatarCx, avatarCy + 85, 85, Math.PI, Math.PI * 2);
    ctx.fillStyle = '#CBD5E1';
    ctx.fill();

    // "+ फोटो जोड़ें" label
    ctx.fillStyle = '#D97706';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('+ फोटो जोड़ें', photoX + photoW / 2, photoY + photoH - 45);
    ctx.restore();
  }

  // --- Details Block (Center) ---
  const labelX = photoX + photoW + 65; // ~455px
  const valueX = labelX + 175;         // ~630px
  const lineRightX = x + w - 420;     // ~1170px

  let currentY = bodyY + 65; // Start row Y at ~270px

  // Dotted underline renderer
  const drawDottedLine = (lineY: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = '#E8B448';
    ctx.lineWidth = 2.5;
    ctx.moveTo(labelX, lineY);
    ctx.lineTo(lineRightX, lineY);
    ctx.stroke();
    ctx.restore();
  };

  // Row 1: Name (नाम)
  ctx.textAlign = 'left';
  ctx.font = 'bold 38px sans-serif';
  ctx.fillStyle = '#78350F';
  ctx.fillText('नाम :', labelX, currentY);

  const nameVal = data.name.trim();
  if (nameVal) {
    ctx.font = 'bold 44px sans-serif';
    ctx.fillStyle = '#0F172A';
    ctx.fillText(nameVal, valueX, currentY);
  } else {
    ctx.font = 'bold 38px sans-serif';
    ctx.fillStyle = '#0F172A';
    ctx.fillText('________________________', valueX, currentY);
  }

  drawDottedLine(currentY + 22);
  currentY += 95;

  // Row 2: ID No.
  ctx.font = 'bold 38px sans-serif';
  ctx.fillStyle = '#78350F';
  ctx.fillText('ID No. :', labelX, currentY);

  const idVal = data.idNumber.trim() || 'IND-2026-7890';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillStyle = '#0F172A';
  ctx.fillText(idVal, valueX, currentY);

  drawDottedLine(currentY + 22);
  currentY += 95;

  // Row 3: Address (पता)
  ctx.font = 'bold 38px sans-serif';
  ctx.fillStyle = '#78350F';
  ctx.fillText('पता :', labelX, currentY);

  const addrVal = data.address.trim();
  if (addrVal) {
    ctx.font = 'bold 38px sans-serif';
    ctx.fillStyle = '#0F172A';

    const maxAddrW = lineRightX - valueX;
    const words = addrVal.split(' ');
    let addrLine = '';
    let addrY = currentY;
    for (let n = 0; n < words.length; n++) {
      const testLine = addrLine + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxAddrW && n > 0) {
        ctx.fillText(addrLine, valueX, addrY);
        addrLine = words[n] + ' ';
        addrY += 44;
      } else {
        addrLine = testLine;
      }
    }
    ctx.fillText(addrLine, valueX, addrY);

    drawDottedLine(addrY + 22);
    currentY = Math.max(currentY + 95, addrY + 95);
  } else {
    ctx.font = 'bold 38px sans-serif';
    ctx.fillStyle = '#0F172A';
    ctx.fillText('________________________', valueX, currentY);

    drawDottedLine(currentY + 22);
    currentY += 95;
  }

  // Row 4: Phone (फोन) - Only show if phone number is entered by user
  const phoneVal = data.phoneNumber.trim();
  if (phoneVal) {
    ctx.font = 'bold 38px sans-serif';
    ctx.fillStyle = '#78350F';
    ctx.fillText('फोन :', labelX, currentY);

    ctx.font = 'bold 44px sans-serif';
    ctx.fillStyle = '#0F172A';
    ctx.fillText(phoneVal, valueX, currentY);

    drawDottedLine(currentY + 22);
  }

  // --- Chip Icon & Devanagari Slogan Block (Below Details) ---
  const chipX = labelX;
  const chipY = photoY + photoH - 80; // ~645px

  // Gold SIM Chip
  ctx.save();
  const chipW = 96;
  const chipH = 72;
  roundedRect(ctx, chipX, chipY, chipW, chipH, 10);
  const chipGrad = ctx.createLinearGradient(chipX, chipY, chipX + chipW, chipY + chipH);
  chipGrad.addColorStop(0, '#FDE68A');
  chipGrad.addColorStop(0.5, '#F59E0B');
  chipGrad.addColorStop(1, '#D97706');
  ctx.fillStyle = chipGrad;
  ctx.fill();
  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Grid contact lines on chip
  ctx.strokeStyle = '#78350F';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(chipX + 32, chipY);
  ctx.lineTo(chipX + 32, chipY + chipH);
  ctx.moveTo(chipX + 64, chipY);
  ctx.lineTo(chipX + 64, chipY + chipH);
  ctx.moveTo(chipX, chipY + 36);
  ctx.lineTo(chipX + chipW, chipY + 36);
  ctx.stroke();

  // Inner center chip rectangle
  roundedRect(ctx, chipX + 36, chipY + 21, 24, 30, 5);
  ctx.fillStyle = '#D97706';
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Vertical Divider Line next to chip
  ctx.save();
  ctx.strokeStyle = '#E67E22';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(chipX + 122, chipY - 8);
  ctx.lineTo(chipX + 122, chipY + chipH + 8);
  ctx.stroke();
  ctx.restore();

  // Devanagari Stacked Slogan ("एक पहचान," / "एक देश," / "एक अभियान")
  const sloganX = chipX + 142;
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';

  ctx.fillStyle = '#EA580C'; // Orange
  ctx.fillText('एक पहचान,', sloganX, chipY + 22);

  ctx.fillStyle = '#1E293B'; // Dark Navy/Black
  ctx.fillText('एक देश,', sloganX, chipY + 50);

  ctx.fillStyle = '#16A34A'; // Green
  ctx.fillText('एक अभियान', sloganX, chipY + 78);

  // --- Indian Flag (Right Side) ---
  const flagW = 320;
  const flagH = 200;
  const flagX = x + w - flagW - 55;
  const flagY = bodyY + 115;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.16)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;

  roundedRect(ctx, flagX, flagY, flagW, flagH, 8);
  ctx.clip();

  if (tirangaImg) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(flagX, flagY, flagW, flagH);

    const imgRatio = tirangaImg.width / tirangaImg.height;
    const boxRatio = flagW / flagH;
    let renderW = flagW;
    let renderH = flagH;
    let offsetX = 0;
    let offsetY = 0;

    if (imgRatio > boxRatio) {
      renderW = flagH * imgRatio;
      offsetX = (flagW - renderW) / 2;
    } else {
      renderH = flagW / imgRatio;
      offsetY = (flagH - renderH) / 2;
    }

    ctx.drawImage(tirangaImg, flagX + offsetX, flagY + offsetY, renderW, renderH);
  } else {
    // 3 Horizontal Stripes
    const stripeH = flagH / 3;

    // Saffron
    ctx.fillStyle = '#FF9933';
    ctx.fillRect(flagX, flagY, flagW, stripeH);

    // White
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(flagX, flagY + stripeH, flagW, stripeH);

    // Green
    ctx.fillStyle = '#138808';
    ctx.fillRect(flagX, flagY + stripeH * 2, flagW, stripeH);

    // Navy Ashoka Chakra
    drawAshokaChakra(ctx, flagX + flagW / 2, flagY + flagH / 2, stripeH * 0.42, '#000080');
  }
  ctx.restore();

  // Flag Border
  ctx.save();
  roundedRect(ctx, flagX, flagY, flagW, flagH, 8);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#CBD5E1';
  ctx.stroke();
  ctx.restore();

  // --- Dynamic QR Code (Right Side, Directly Below Indian Flag) ---
  if (qrImg) {
    const qrContainerW = 115;
    const qrContainerH = 115;
    const qrContainerX = flagX + (flagW - qrContainerW) / 2;
    const qrContainerY = flagY + flagH + 26;

    ctx.save();
    // Soft drop shadow
    ctx.shadowColor = 'rgba(11, 18, 36, 0.12)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    // Clean cream/white container background with rounded corners
    roundedRect(ctx, qrContainerX, qrContainerY, qrContainerW, qrContainerH, 12);
    ctx.fillStyle = '#FFFDF9';
    ctx.fill();

    // Reset shadow before drawing decorative border
    ctx.shadowColor = 'transparent';

    // Tricolor gradient border matching card theme (Saffron -> Gold -> Green)
    const borderGrad = ctx.createLinearGradient(
      qrContainerX,
      qrContainerY,
      qrContainerX + qrContainerW,
      qrContainerY + qrContainerH
    );
    borderGrad.addColorStop(0, '#FF9933'); // Saffron
    borderGrad.addColorStop(0.5, '#FFD700'); // Gold Accent
    borderGrad.addColorStop(1, '#138808'); // Green

    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Top Saffron & Bottom Green subtle accent bars
    ctx.save();
    roundedRect(ctx, qrContainerX, qrContainerY, qrContainerW, qrContainerH, 12);
    ctx.clip();

    ctx.fillStyle = '#FF9933';
    ctx.fillRect(qrContainerX, qrContainerY, qrContainerW, 3); // Top saffron line

    ctx.fillStyle = '#138808';
    ctx.fillRect(qrContainerX, qrContainerY + qrContainerH - 3, qrContainerW, 3); // Bottom green line
    ctx.restore();

    // Draw the high-contrast QR image centered inside padding
    const qrPad = 8;
    ctx.drawImage(
      qrImg,
      qrContainerX + qrPad,
      qrContainerY + qrPad + 1,
      qrContainerW - qrPad * 2,
      qrContainerH - qrPad * 2 - 2
    );
    ctx.restore();

    // Centered label below QR
    ctx.save();
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    ctx.fillText('स्कैन करें / SCAN QR', qrContainerX + qrContainerW / 2, qrContainerY + qrContainerH + 18);
    ctx.restore();
  }

  // ----------------------------------------------------
  // 4. FOOTER BANNER (DEEP GREEN)
  // ----------------------------------------------------
  const footerH = 190;
  const footerY = y + h - footerH; // ~800px

  const footerGrad = ctx.createLinearGradient(x, footerY, x + w, footerY);
  footerGrad.addColorStop(0, '#0A6826');
  footerGrad.addColorStop(0.5, '#08531E');
  footerGrad.addColorStop(1, '#0A5C1E');

  ctx.fillStyle = footerGrad;
  ctx.fillRect(x, footerY, w, footerH);

  // Gold top accent bar
  ctx.fillStyle = '#FFB300';
  ctx.fillRect(x, footerY, w, 5);

  // --- Left Footer: Ashoka Stambh (`satya1.png`) & Satyamev Jayate ---
  const fLeftX = x + 40;
  if (satyaImg) {
    ctx.save();
    const satyaH = 140;
    const satyaW = (satyaImg.width / satyaImg.height) * satyaH;
    ctx.drawImage(satyaImg, fLeftX, footerY + 25, satyaW, satyaH);
    ctx.restore();

    const textLeftX = fLeftX + satyaW + 20;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('सत्यमेव जयते', textLeftX, footerY + 82);

    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('TRUTH ALONE TRIUMPHS', textLeftX, footerY + 120);
  } else {
    // Fallback if satya1.png image didn't load
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('सत्यमेव जयते', fLeftX + 20, footerY + 82);

    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('TRUTH ALONE TRIUMPHS', fLeftX + 20, footerY + 120);
  }

  // --- Center Footer: White Pill Badge ("🇮🇳 जय हिंद • Vande Mataram") ---
  const cPillW = 470;
  const cPillH = 70;
  const cPillX = x + (w - cPillW) / 2;
  const cPillY = footerY + (footerH - cPillH) / 2 + 5;

  ctx.save();
  roundedRect(ctx, cPillX, cPillY, cPillW, cPillH, 35);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  // Flag inside center pill
  drawSmallFlag(ctx, cPillX + 20, cPillY + 15, 56, 40, tirangaImg);

  ctx.fillStyle = '#222222';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('जय हिंद • Vande Mataram', cPillX + 280, cPillY + 44);
  ctx.restore();

  // --- Right Footer: Branding (`www.blueorbitdevs.org` + `brand-logo.png`) ---
  if (xbLogo) {
    const logoSize = 92;
    const logoX = x + w - logoSize - 40;
    const logoY = footerY + (footerH - logoSize) / 2 + 2;

    ctx.save();
    roundedRect(ctx, logoX, logoY, logoSize, logoSize, 16);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.clip();
    ctx.drawImage(xbLogo, logoX, logoY, logoSize, logoSize);
    ctx.restore();

    // Text on the left of logo
    const fRightTextX = logoX - 25;
    ctx.fillStyle = '#FFD700'; // Bright Gold
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('www.blueorbitdevs.org', fRightTextX, footerY + 82);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('BlueOrbit Devs', fRightTextX, footerY + 118);
  } else {
    // Fallback if xbLogo didn't load
    const fRightX = x + w - 45;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('www.blueorbitdevs.org', fRightX, footerY + 82);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('BlueOrbit Devs', fRightX, footerY + 118);
  }

  ctx.restore(); // Restore outer card clip
}
