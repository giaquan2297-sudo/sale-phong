import { useState, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Share2,
  ClipboardList,
  Sparkles,
  UserCheck,
  Link as LinkIcon,
} from 'lucide-react';
import { useToast } from './Toast';
import { useEscapeKey } from '../hooks/useEscapeKey';

async function copyText(text) {
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback below
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch {
    document.body.removeChild(textarea);
    return false;
  }
}

export default function LeadFormShareModal({ isOpen = true, onClose }) {
  const toast = useToast();
  useEscapeKey(onClose, isOpen);

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedZalo, setCopiedZalo] = useState(false);

  const shareUrl = useMemo(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/nhu-cau`;
    }
    return '/nhu-cau';
  }, []);

  const zaloMessage = useMemo(() => {
    return `Chào bạn, bạn bấm vào link này điền nhanh nhu cầu phòng (khu vực, giá tiền, ngày chuyển vào) để bên mình lọc đúng các căn phù hợp gửi bạn qua Zalo ngay nhé:\n${shareUrl}`;
  }, [shareUrl]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    const success = await copyText(shareUrl);
    if (success) {
      setCopiedLink(true);
      toast('Đã sao chép đường link biểu mẫu tìm phòng');
      setTimeout(() => setCopiedLink(false), 2500);
    } else {
      toast('Không thể sao chép tự động. Bạn vui lòng copy thủ công', 'error');
    }
  };

  const handleCopyZaloMessage = async () => {
    const success = await copyText(zaloMessage);
    if (success) {
      setCopiedZalo(true);
      toast('Đã sao chép tin nhắn Zalo kèm link gửi khách');
      setTimeout(() => setCopiedZalo(false), 2500);
    } else {
      toast('Không thể sao chép tự động. Bạn vui lòng copy thủ công', 'error');
    }
  };

  const handleOpenPreview = () => {
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-teal-50/60 via-white to-emerald-50/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0D6E6E] text-white flex items-center justify-center shadow-xs">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                Chia sẻ biểu mẫu tìm phòng
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Gửi link để khách tự điền nhu cầu thuê phòng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-slate-700 text-sm">
          {/* Public URL Box */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
              Đường link công khai
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  onClick={(e) => e.target.select()}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-slate-800 focus:outline-none focus:border-[#0D6E6E]"
                />
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className={`px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0 shadow-xs ${
                  copiedLink
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                }`}
                title="Sao chép đường link"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Đã sao chép' : 'Sao chép link'}</span>
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-semibold shadow-xs transition-colors"
            >
              {copiedLink ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4 text-slate-500" />
              )}
              <span>📋 Sao chép đường link</span>
            </button>

            <button
              type="button"
              onClick={handleOpenPreview}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-teal-200 bg-teal-50/70 hover:bg-teal-100/70 text-[#0D6E6E] text-xs sm:text-sm font-semibold transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>👁️ Xem thử biểu mẫu</span>
            </button>
          </div>

          {/* Preformatted Zalo Message */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
                <span>Nội dung tin nhắn Zalo soạn sẵn</span>
              </label>
              <button
                type="button"
                onClick={handleCopyZaloMessage}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors inline-flex items-center gap-1 ${
                  copiedZalo
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'text-blue-600 hover:bg-blue-50'
                }`}
              >
                {copiedZalo ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedZalo ? 'Đã sao chép' : 'Sao chép tin nhắn'}</span>
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs text-slate-700 leading-relaxed font-sans relative group">
              <p className="whitespace-pre-line">{zaloMessage}</p>
            </div>

            <button
              type="button"
              onClick={handleCopyZaloMessage}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors"
            >
              {copiedZalo ? (
                <Check className="w-4 h-4" />
              ) : (
                <MessageCircle className="w-4 h-4" />
              )}
              <span>💬 Sao chép tin nhắn Zalo kèm link</span>
            </button>
          </div>

          {/* Explanatory Info Card */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs text-emerald-950 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-emerald-900">
              <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Tự động đồng bộ vào mục &quot;Khách hàng&quot;</span>
            </div>
            <p className="text-slate-600 leading-relaxed pl-6">
              Khi khách gửi yêu cầu qua link này, thông tin sẽ <strong>tự động xuất hiện</strong> trong tab{' '}
              <strong className="text-slate-800">Khách hàng</strong> với trạng thái{' '}
              <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 font-medium">Chưa chăm</span>{' '}
              kèm đánh dấu mức độ khẩn cấp (🔥 Cần gấp) và hạn dọn vào (⏰) để bạn nắm bắt ngay lập tức.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-medium transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
