import { formatPrice } from './format';

/**
 * Build a tenant-safe Zalo message.
 * NEVER includes address (house number), private_note, or landlord phone/zalo.
 */
export function buildZaloMessage(rooms, settings = {}, options = {}) {
  const {
    includeGreeting = true,
    includeSignature = true,
    includeUtilities = true,
    includeAmenities = true,
    includeDescription = true,
    customGreeting,
    customSignature,
  } = options;

  const lines = [];
  const greeting = (customGreeting ?? settings.zalo_greeting ?? '').trim();
  const signature = (customSignature ?? settings.zalo_signature ?? '').trim();

  if (includeGreeting && greeting) {
    lines.push(greeting, '');
  }

  rooms.forEach((room, index) => {
    const titleParts = [];
    if (room.code) titleParts.push(`[${room.code}]`);
    titleParts.push(room.room_type || 'Phòng trọ');
    const location = [room.street, room.district].filter(Boolean).join(', ');
    if (location) titleParts.push(`— ${location}`);

    lines.push(`${rooms.length > 1 ? `${index + 1}. ` : ''}${titleParts.join(' ')}`);

    const priceLine = [`Giá: ${formatPrice(room.price)}`];
    if (room.area_m2) priceLine.push(`Diện tích: ~${room.area_m2}m²`);
    if (room.deposit && room.deposit !== room.price) {
      priceLine.push(`Cọc: ${formatPrice(room.deposit)}`);
    } else if (room.deposit) {
      priceLine.push('Cọc 1 đóng 1');
    }
    lines.push(`• ${priceLine.join(' | ')}`);

    if (room.available_from) {
      lines.push(`• Thời gian vào: ${room.available_from}`);
    }

    if (includeUtilities && (room.electric_price || room.water_price)) {
      const util = [];
      if (room.electric_price) util.push(`Điện ${room.electric_price}`);
      if (room.water_price) util.push(`Nước ${room.water_price}`);
      lines.push(`• Dịch vụ: ${util.join(', ')}`);
    }

    if (includeAmenities && room.amenities) {
      lines.push(`• Nội thất & tiện ích: ${room.amenities}`);
    }

    if (includeDescription && room.description) {
      lines.push(`• Mô tả: ${room.description}`);
    }

    if (index < rooms.length - 1) {
      lines.push('');
    }
  });

  if (includeSignature && signature) {
    lines.push('', signature);
  }

  return lines.join('\n');
}

/**
 * Copy a room image directly to system clipboard as PNG so user can paste into Zalo PC.
 */
export async function copyImageToClipboard(image) {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
    throw new Error('Trình duyệt hiện tại không hỗ trợ copy ảnh trực tiếp vào clipboard');
  }

  const fetchUrl = image.filename ? image.url : `/api/images/${image.id}/proxy`;
  const resp = await fetch(fetchUrl);
  if (!resp.ok) {
    throw new Error('Không tải được dữ liệu ảnh');
  }
  const srcBlob = await resp.blob();

  const pngBlob = await new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(srcBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Không thể chuyển ảnh sang clipboard'));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Không đọc được ảnh'));
    };
    img.src = objectUrl;
  });

  await navigator.clipboard.write([
    new ClipboardItem({
      'image/png': pngBlob,
    }),
  ]);
}
