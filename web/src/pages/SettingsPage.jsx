import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  ShieldCheck,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  Laptop,
  Wifi,
  Globe,
  Power,
  ChevronDown,
  ChevronUp,
  Share2,
} from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import QrCodeSvg from '../components/QrCodeSvg';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  const { data: networkInfo } = useQuery({
    queryKey: ['networkInfo'],
    queryFn: api.getNetworkInfo,
    refetchInterval: 15000,
  });

  const [form, setForm] = useState({
    cleanup_days: '30',
    sync_interval_minutes: '3',
    zalo_greeting: '',
    zalo_signature: '',
  });

  const [copied, setCopied] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [showRemoteGuide, setShowRemoteGuide] = useState(false);
  const [activeTab, setActiveTab] = useState('ios'); // 'ios' | 'android'

  useEffect(() => {
    if (settings) {
      setForm({
        cleanup_days: settings.cleanup_days || '30',
        sync_interval_minutes: settings.sync_interval_minutes || '3',
        zalo_greeting: settings.zalo_greeting || '',
        zalo_signature: settings.zalo_signature || '',
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => api.updateSettings(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['storage'] });
      toast('Đã lưu cài đặt hệ thống');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  const mobileUrl =
    networkInfo?.mobileUrl ||
    (networkInfo?.lanUrls?.[0]?.url ?? `http://${window.location.hostname}:3000`);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(mobileUrl);
    setCopied(true);
    toast('Đã sao chép link điện thoại vào bộ nhớ đệm!');
    setTimeout(() => setCopied(false), 2500);
  };

  const autostartCmd = 'npm run autostart:on';
  const handleCopyCmd = () => {
    navigator.clipboard.writeText(autostartCmd);
    setCopiedCmd(true);
    toast('Đã sao chép lệnh cài đặt tự khởi động!');
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-500">Đang tải cài đặt...</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Cài đặt & Kết nối</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Mở web trên điện thoại, cấu hình tự khởi động cùng máy tính, tuỳ chỉnh mẫu tin nhắn và đồng bộ
        </p>
      </div>

      {/* Card 1: Kết nối điện thoại di động (Mạng Wi-Fi) */}
      <div className="bg-gradient-to-br from-white to-[#F0FDF4] rounded-2xl border-2 border-emerald-500/30 p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                Mở trên Điện thoại Di động
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                  <Wifi className="w-3 h-3 text-emerald-600" />
                  Cùng Wi-Fi
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Điện thoại và máy tính kết nối chung mạng Wi-Fi là mở được ngay lập tức
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center bg-white rounded-xl p-4 border border-emerald-100">
          {/* QR Code */}
          <div className="md:col-span-4 flex flex-col items-center justify-center p-2 bg-slate-50/60 rounded-xl border border-slate-100">
            <QrCodeSvg text={mobileUrl} size={160} />
            <p className="text-[11px] text-slate-500 font-medium mt-2 text-center">
              Dùng camera điện thoại quét để mở ngay
            </p>
          </div>

          {/* Direct Link & Copy */}
          <div className="md:col-span-8 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Hoặc gõ địa chỉ này vào trình duyệt điện thoại (Safari / Chrome):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={mobileUrl}
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-mono font-semibold text-emerald-700 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0 transition-colors shadow-sm"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Platform Guides (Tabs) */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-slate-700">
                  Cách cài icon mở như App thật:
                </span>
                <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab('ios')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      activeTab === 'ios'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    iPhone (iOS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('android')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      activeTab === 'android'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Android
                  </button>
                </div>
              </div>

              {activeTab === 'ios' ? (
                <ol className="text-xs text-slate-600 space-y-1 pl-4 list-decimal leading-relaxed">
                  <li>
                    Mở bằng trình duyệt <strong>Safari</strong> trên iPhone.
                  </li>
                  <li>
                    Bấm biểu tượng <strong>Chia sẻ</strong> (hình vuông mũi tên lên ở thanh dưới).
                  </li>
                  <li>
                    Cuộn xuống chọn <strong>"Thêm vào MH chính" (Add to Home Screen)</strong>.
                  </li>
                  <li>
                    Bấm <strong>Thêm</strong> ở góc trên bên phải. Biểu tượng Sale Trọ sẽ xuất hiện
                    ngoài màn hình chính, mở toàn màn hình mượt mà!
                  </li>
                </ol>
              ) : (
                <ol className="text-xs text-slate-600 space-y-1 pl-4 list-decimal leading-relaxed">
                  <li>
                    Mở bằng trình duyệt <strong>Chrome</strong> trên điện thoại Android.
                  </li>
                  <li>
                    Bấm vào biểu tượng <strong>Menu 3 chấm</strong> ở góc trên bên phải.
                  </li>
                  <li>
                    Chọn <strong>"Thêm vào màn hình chính"</strong> (hoặc "Cài đặt ứng dụng").
                  </li>
                  <li>
                    Bấm <strong>Cài đặt / Thêm</strong>. Biểu tượng ứng dụng sẽ nằm ngay ngoài màn hình
                    chính của bạn.
                  </li>
                </ol>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: Lúc nào mở máy cũng có sẵn (LaunchAgent Auto-start) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
            <Power className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900">
              Lúc nào mở máy tính cũng có sẵn (Tự khởi động cùng macOS)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Hệ thống tự chạy ngầm khi bật máy Mac. Bạn không cần mở terminal hay gõ lệnh khởi động.
            </p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">
              Lệnh kích hoạt tự động khởi động (chỉ cần chạy 1 lần):
            </span>
            <button
              type="button"
              onClick={handleCopyCmd}
              className="inline-flex items-center gap-1 text-[#0D6E6E] hover:text-[#0A5858] font-semibold text-xs"
            >
              {copiedCmd ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-600">Đã chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Sao chép lệnh</span>
                </>
              )}
            </button>
          </div>
          <div className="bg-slate-900 text-emerald-400 font-mono px-3.5 py-2.5 rounded-lg flex items-center justify-between overflow-x-auto text-xs">
            <span>{autostartCmd}</span>
          </div>
          <p className="text-slate-500 leading-relaxed text-[11px]">
            * Cơ chế sử dụng <strong>macOS LaunchAgent</strong> chuẩn của Apple. Khi bạn đăng nhập máy Mac,
            hệ thống sẽ tự chạy ngầm trong nền. Nếu tiến trình bị tắt, macOS sẽ tự bật lại. Muốn tắt tính
            năng này, bạn chỉ cần gõ <code className="bg-slate-200 text-slate-800 px-1 rounded font-mono">npm run autostart:off</code>.
          </p>
        </div>
      </div>

      {/* Card 3: Mở từ xa qua 4G (Khi ra ngoài đường) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-3">
        <button
          type="button"
          onClick={() => setShowRemoteGuide((p) => !p)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                Mở từ xa qua 4G / Ra ngoài đường
                <span className="text-xs font-normal text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                  Khi không cùng Wi-Fi
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Bấm để xem hướng dẫn mở web khi bạn đi dẫn khách ngoài đường hoặc máy tính tắt
              </p>
            </div>
          </div>
          {showRemoteGuide ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {showRemoteGuide && (
          <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-3">
            <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-3.5 space-y-2">
              <div className="font-semibold text-purple-900 flex items-center gap-1.5">
                <span>Cách 1: Dùng Cloudflare Tunnel (Miễn phí, link HTTPS an toàn)</span>
              </div>
              <p className="leading-relaxed text-slate-600">
                Nếu máy Mac để ở nhà hoặc văn phòng đang bật, bạn có thể tạo đường hầm Cloudflare Tunnel
                để có link web dạng <code className="font-mono bg-purple-100 text-purple-800 px-1 rounded">https://saletro.abc.trycloudflare.com</code>.
                Điện thoại bật 4G ở bất kỳ đâu ngoài đường cũng truy cập được bảng hàng và chốt deal ngay.
              </p>
            </div>

            <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 space-y-2">
              <div className="font-semibold text-blue-900 flex items-center gap-1.5">
                <span>Cách 2: Đưa lên Máy chủ Đám mây (Render / Railway / VPS)</span>
              </div>
              <p className="leading-relaxed text-slate-600">
                Nếu bạn muốn <strong>máy tính tắt hoặc gập nắp lại hoàn toàn</strong> mà điện thoại vẫn
                mở web 24/7 mọi lúc mọi nơi, toàn bộ mã nguồn và dữ liệu SQLite này có thể được deploy
                lên dịch vụ hosting đám mây miễn phí như Render hoặc Railway. Hệ thống vẫn tự động đồng
                bộ với Google Sheet của bạn bình thường!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Card 4: Cài đặt hệ thống (Dọn ảnh & Zalo & Đồng bộ Sheet) */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-xs"
      >
        <h3 className="font-bold text-base text-slate-900 border-b border-slate-100 pb-3">
          Tuỳ chỉnh Vận hành & Tin nhắn
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Số ngày tự dọn ảnh phòng "Đã thuê"
            </label>
            <input
              type="number"
              min="1"
              value={form.cleanup_days}
              onChange={(e) => setForm((p) => ({ ...p, cleanup_days: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:border-[#0D6E6E]"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Mặc định 30 ngày. Luôn giữ lại 1 ảnh đại diện của phòng.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Chu kỳ đồng bộ Google Sheet (phút)
            </label>
            <input
              type="number"
              min="1"
              value={form.sync_interval_minutes}
              onChange={(e) =>
                setForm((p) => ({ ...p, sync_interval_minutes: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:border-[#0D6E6E]"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Khuyến nghị 2–5 phút một lần.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Lời chào đầu tin nhắn Zalo
          </label>
          <textarea
            rows={2}
            value={form.zalo_greeting}
            onChange={(e) => setForm((p) => ({ ...p, zalo_greeting: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Câu kết cuối tin nhắn Zalo
          </label>
          <textarea
            rows={2}
            value={form.zalo_signature}
            onChange={(e) => setForm((p) => ({ ...p, zalo_signature: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
          />
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0D6E6E] hover:bg-[#0A5858] text-white text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{saveMutation.isPending ? 'Đang lưu...' : 'Lưu cài đặt'}</span>
          </button>
        </div>
      </form>

      {/* Card 5: Bảo mật & Dữ liệu */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 flex items-start gap-3 text-xs text-slate-600 shadow-xs">
        <ShieldCheck className="w-5 h-5 text-[#0D6E6E] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-slate-900">Bảo mật & Sao lưu dữ liệu an toàn</div>
          <p className="leading-relaxed">
            Hệ thống đang chạy trực tiếp trên máy Mac của bạn. Toàn bộ thông tin khách hàng, số điện thoại
            chủ nhà, hoa hồng và ảnh phòng đều được lưu cục bộ an toàn trong thư mục{' '}
            <code className="font-mono bg-slate-100 text-slate-800 px-1 py-0.5 rounded">data/</code>.
            Để sao lưu toàn bộ, bạn chỉ cần copy thư mục <code className="font-mono">data/</code> lưu sang USB hoặc Google Drive.
          </p>
        </div>
      </div>
    </div>
  );
}
