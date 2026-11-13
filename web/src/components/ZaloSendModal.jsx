import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Copy,
  FolderOpen,
  Check,
  UserPlus,
  Send,
  Share2,
  Image as ImageIcon,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { api } from '../api/client';
import { formatPrice } from '../utils/format';
import { buildZaloMessage, copyImageToClipboard } from '../utils/zaloMessage';
import { useToast } from './Toast';
import { useEscapeKey } from '../hooks/useEscapeKey';

export default function ZaloSendModal({ rooms, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  useEscapeKey(onClose);

  const { data: settings = {} } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: api.getCustomers,
  });

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', zalo_phone: '', need_note: '' });

  const [options, setOptions] = useState({
    includeGreeting: true,
    includeSignature: true,
    includeUtilities: true,
    includeAmenities: true,
    includeDescription: true,
  });

  const generatedMessage = useMemo(
    () => buildZaloMessage(rooms, settings, options),
    [rooms, settings, options]
  );

  const [messageText, setMessageText] = useState('');
  const [messageEdited, setMessageEdited] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImageId, setCopiedImageId] = useState(null);
  const [createdCartUrl, setCreatedCartUrl] = useState('');
  const [copiedCartUrl, setCopiedCartUrl] = useState(false);
  const [savedSend, setSavedSend] = useState(false);

  useEffect(() => {
    if (!messageEdited) {
      setMessageText(generatedMessage);
    }
  }, [generatedMessage, messageEdited]);

  useEffect(() => {
    setSavedSend(false);
  }, [selectedCustomerId, messageText, rooms]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.zalo_phone || '').toLowerCase().includes(q) ||
        (c.districts || '').toLowerCase().includes(q) ||
        (c.need_note || '').toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c.id) === String(selectedCustomerId)) || null,
    [customers, selectedCustomerId]
  );

  const totalImages = useMemo(
    () => rooms.reduce((sum, r) => sum + (r.images?.length || 0), 0),
    [rooms]
  );

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopiedText(true);
      toast('Đã copy tin nhắn Zalo (không chứa số nhà & SĐT chủ nhà)');
      setTimeout(() => setCopiedText(false), 2200);
    } catch {
      toast('Không copy được tin nhắn, hãy bôi đen và Ctrl+C / Cmd+C', 'error');
    }
  };

  const handleCopyCartUrl = async () => {
    if (!createdCartUrl) return;
    try {
      await navigator.clipboard.writeText(createdCartUrl);
      setCopiedCartUrl(true);
      toast('Đã copy link giỏ phòng vào clipboard');
      setTimeout(() => setCopiedCartUrl(false), 2000);
    } catch {
      toast('Không copy được link, hãy chọn và copy thủ công', 'error');
    }
  };

  const handleOpenFolder = async (roomId) => {
    try {
      const res = await api.openRoomFolder(roomId);
      if (res.downloaded > 0) {
        queryClient.invalidateQueries({ queryKey: ['rooms'] });
        toast(`Đã tải ${res.downloaded} ảnh từ Sheet và mở thư mục ảnh`);
      } else {
        toast('Đã mở thư mục ảnh trên máy để kéo thả vào Zalo PC');
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleCopyImage = async (img) => {
    try {
      await copyImageToClipboard(img);
      setCopiedImageId(img.id);
      toast('Đã copy ảnh vào clipboard — bấm Ctrl+V / Cmd+V trong Zalo PC để dán!');
      setTimeout(() => {
        setCopiedImageId((curr) => (curr === img.id ? null : curr));
      }, 2200);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const createCustomerMutation = useMutation({
    mutationFn: api.createCustomer,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setSelectedCustomerId(String(created.id));
      setCustomerSearch('');
      setShowNewCustomer(false);
      setNewCustomer({ name: '', zalo_phone: '', need_note: '' });
      toast(`Đã thêm khách "${created.name}"`);
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const recordSendMutation = useMutation({
    mutationFn: api.recordSend,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['sends'] });
      setSavedSend(true);
      toast('Đã lưu lịch sử gửi phòng cho khách');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const createCartMutation = useMutation({
    mutationFn: api.createCart,
    onSuccess: async (cart) => {
      const url = `${window.location.origin}/share/${cart.slug}`;
      setCreatedCartUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        setCopiedCartUrl(true);
        setTimeout(() => setCopiedCartUrl(false), 2000);
        toast('Đã tạo link giỏ phòng công khai & copy vào clipboard');
      } catch {
        toast('Đã tạo link giỏ phòng công khai');
      }
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const handleSaveSend = () => {
    if (!selectedCustomerId) {
      toast('Chọn hoặc tạo khách hàng trước khi lưu lịch sử gửi', 'error');
      return;
    }
    recordSendMutation.mutate({
      customer_id: parseInt(selectedCustomerId, 10),
      room_ids: rooms.map((r) => r.id),
      message: messageText,
    });
  };

  const handleCreateCart = () => {
    const title = selectedCustomer
      ? `Phòng gợi ý cho ${selectedCustomer.name}`
      : `Giỏ ${rooms.length} phòng gợi ý`;
    createCartMutation.mutate({
      title,
      customer_id: selectedCustomerId ? parseInt(selectedCustomerId, 10) : null,
      room_ids: rooms.map((r) => r.id),
    });
  };

  const handleQuickAddCustomer = () => {
    if (!newCustomer.name.trim() || createCustomerMutation.isPending) return;
    createCustomerMutation.mutate(newCustomer);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Gửi ${rooms.length} phòng qua Zalo PC`}
        className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tabular-nums">
              Gửi {rooms.length} phòng qua Zalo PC
            </h2>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0D6E6E] shrink-0" />
              <span>Tự động ẩn số nhà, ghi chú riêng và SĐT chủ nhà để bảo mật nguồn hàng</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ gửi Zalo"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 overflow-y-auto flex-1">
          {/* Left: Message composer & Customer log */}
          <div className="p-4 sm:p-5 space-y-4 flex flex-col">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="zalo-customer-select"
                  className="text-xs font-semibold text-slate-700"
                >
                  Khách hàng nhận tin (để lưu lịch sử gửi)
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewCustomer((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#0D6E6E] hover:underline"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{showNewCustomer ? 'Chọn khách có sẵn' : 'Thêm khách nhanh'}</span>
                </button>
              </div>

              {showNewCustomer ? (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Tên khách *"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer((p) => ({ ...p, name: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleQuickAddCustomer();
                        }
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#0D6E6E]"
                    />
                    <input
                      type="text"
                      placeholder="SĐT / Zalo"
                      value={newCustomer.zalo_phone}
                      onChange={(e) =>
                        setNewCustomer((p) => ({ ...p, zalo_phone: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleQuickAddCustomer();
                        }
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#0D6E6E]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ghi chú nhu cầu (quận, tầm giá...)"
                      value={newCustomer.need_note}
                      onChange={(e) =>
                        setNewCustomer((p) => ({ ...p, need_note: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleQuickAddCustomer();
                        }
                      }}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#0D6E6E]"
                    />
                    <button
                      type="button"
                      onClick={handleQuickAddCustomer}
                      disabled={!newCustomer.name.trim() || createCustomerMutation.isPending}
                      className="px-3 py-1.5 rounded-lg bg-[#0D6E6E] hover:bg-[#0A5858] text-white text-xs font-medium disabled:opacity-50 shrink-0"
                    >
                      {createCustomerMutation.isPending ? 'Đang lưu...' : 'Lưu khách'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {customers.length > 4 && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Lọc nhanh tên, SĐT hoặc nhu cầu khách..."
                        aria-label="Lọc khách hàng"
                        className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:border-[#0D6E6E]"
                      />
                      {customerSearch && (
                        <button
                          type="button"
                          onClick={() => setCustomerSearch('')}
                          aria-label="Xoá tìm kiếm khách"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  <select
                    id="zalo-customer-select"
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#0D6E6E]"
                  >
                    <option value="">
                      {customerSearch
                        ? `-- Chọn trong ${filteredCustomers.length} khách khớp --`
                        : '-- Chọn khách hàng (tuỳ chọn) --'}
                    </option>
                    {filteredCustomers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.zalo_phone ? ` (${c.zalo_phone})` : ''}
                        {c.districts ? ` — ${c.districts}` : ''}
                      </option>
                    ))}
                  </select>

                  {selectedCustomer && (
                    <div className="px-3 py-2 rounded-lg bg-[#0D6E6E]/5 border border-[#0D6E6E]/20 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-medium text-slate-900">
                          {selectedCustomer.name}
                          {selectedCustomer.zalo_phone && (
                            <span className="font-mono text-slate-600 ml-1.5">
                              ({selectedCustomer.zalo_phone})
                            </span>
                          )}
                        </div>
                        {(selectedCustomer.districts ||
                          selectedCustomer.budget_min ||
                          selectedCustomer.budget_max ||
                          selectedCustomer.need_note) && (
                          <div className="text-[11px] text-slate-600 truncate">
                            {[
                              selectedCustomer.districts,
                              selectedCustomer.budget_min || selectedCustomer.budget_max
                                ? `${selectedCustomer.budget_min ? formatPrice(selectedCustomer.budget_min) : '0'}–${selectedCustomer.budget_max ? formatPrice(selectedCustomer.budget_max) : '...'}`
                                : '',
                              selectedCustomer.need_note,
                            ]
                              .filter(Boolean)
                              .join(' • ')}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-[#0D6E6E] tabular-nums shrink-0">
                        Đã gửi {selectedCustomer.send_count || 0} lần
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-slate-700">
              {[
                ['includeGreeting', 'Lời chào'],
                ['includeUtilities', 'Điện nước'],
                ['includeAmenities', 'Nội thất'],
                ['includeDescription', 'Mô tả'],
                ['includeSignature', 'Lời kết'],
              ].map(([key, label]) => (
                <label key={key} className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options[key]}
                    onChange={(e) => {
                      setMessageEdited(false);
                      setOptions((prev) => ({ ...prev, [key]: e.target.checked }));
                    }}
                    className="rounded border-slate-300 accent-[#0D6E6E]"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="flex-1 flex flex-col min-h-[220px]">
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="zalo-message-textarea"
                  className="text-xs font-semibold text-slate-700"
                >
                  Nội dung tin nhắn Zalo
                </label>
                {messageEdited && (
                  <button
                    type="button"
                    onClick={() => setMessageEdited(false)}
                    className="text-xs text-[#0D6E6E] hover:underline"
                  >
                    Tạo lại theo mẫu
                  </button>
                )}
              </div>
              <textarea
                id="zalo-message-textarea"
                value={messageText}
                onChange={(e) => {
                  setMessageEdited(true);
                  setMessageText(e.target.value);
                }}
                className="flex-1 w-full rounded-lg border border-slate-300 p-3 text-sm leading-relaxed focus:outline-none focus:border-[#0D6E6E] min-h-[210px]"
              />
            </div>

            {copiedText && (
              <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Đã copy nội dung — bấm Ctrl+V / Cmd+V vào ô chat Zalo PC để gửi!</span>
              </div>
            )}

            {createdCartUrl && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs flex items-center justify-between gap-2">
                <span className="text-emerald-800 truncate">
                  Link giỏ phòng:{' '}
                  <a
                    href={createdCartUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-medium"
                  >
                    {createdCartUrl}
                  </a>
                </span>
                <button
                  type="button"
                  onClick={handleCopyCartUrl}
                  className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded border font-medium transition-colors ${
                    copiedCartUrl
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  {copiedCartUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Đã copy</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy link</span>
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyMessage}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${
                  copiedText
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-[#0D6E6E] hover:bg-[#0A5858]'
                }`}
              >
                {copiedText ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedText ? 'Đã copy tin nhắn!' : 'Copy tin nhắn Zalo'}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveSend}
                disabled={!selectedCustomerId || recordSendMutation.isPending || savedSend}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-60 ${
                  savedSend
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                {savedSend ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                <span>
                  {recordSendMutation.isPending
                    ? 'Đang lưu...'
                    : savedSend
                      ? 'Đã lưu lịch sử'
                      : 'Lưu lịch sử gửi'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleCreateCart}
                disabled={createCartMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" />
                <span>
                  {createCartMutation.isPending ? 'Đang tạo...' : 'Tạo trang giỏ phòng'}
                </span>
              </button>
            </div>
          </div>

          {/* Right: Photos & Open Folder for Drag-and-Drop to Zalo PC */}
          <div className="p-4 sm:p-5 space-y-4 bg-slate-50/60">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Ảnh từng phòng (kéo thả hoặc copy từng ảnh vào Zalo PC)
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 tabular-nums shrink-0">
                Tổng {totalImages} ảnh
              </span>
            </div>

            <div className="space-y-4">
              {rooms.map((room) => {
                const photoCount = room.images?.length || 0;
                return (
                  <div
                    key={room.id}
                    className="bg-white rounded-lg border border-slate-200 p-3.5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-slate-900">
                            {room.code ? `[${room.code}] ` : ''}
                            {room.street ? `${room.street}, ` : ''}
                            {room.district}
                          </span>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full font-medium tabular-nums ${
                              photoCount > 0
                                ? 'bg-[#0D6E6E]/10 text-[#0D6E6E]'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {photoCount} ảnh
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                          {room.room_type} •{' '}
                          <span className="font-semibold text-[#0D6E6E]">
                            {formatPrice(room.price)}
                          </span>
                          {room.area_m2 ? ` • ${room.area_m2} m²` : ''}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenFolder(room.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shrink-0"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-[#0D6E6E]" />
                        <span>Mở thư mục ảnh</span>
                      </button>
                    </div>

                    {photoCount > 0 ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {room.images.map((img, idx) => {
                          const isCopied = copiedImageId === img.id;
                          return (
                            <div
                              key={img.id}
                              className={`relative group rounded-md overflow-hidden border aspect-square bg-slate-100 ${
                                isCopied
                                  ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                                  : 'border-slate-200'
                              }`}
                            >
                              <img
                                src={img.url}
                                alt={`Ảnh ${idx + 1} phòng ${room.code || room.id}`}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => handleCopyImage(img)}
                                aria-label={`Copy ảnh ${idx + 1} phòng ${room.code || room.id}`}
                                className={`absolute inset-0 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-medium gap-1 ${
                                  isCopied
                                    ? 'bg-emerald-700/80 opacity-100'
                                    : 'bg-slate-900/55 opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                                }`}
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-4 h-4 text-white" />
                                    <span>Đã copy</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4" />
                                    <span>Copy ảnh</span>
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-4 rounded-md border border-dashed border-slate-200 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                        <ImageIcon className="w-4 h-4" />
                        <span>Phòng này chưa có ảnh</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
