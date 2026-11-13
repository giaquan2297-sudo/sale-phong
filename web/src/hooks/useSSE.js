import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useSSE(onNotification) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource('/api/events');

    es.addEventListener('connected', () => {
      setConnected(true);
    });

    es.addEventListener('rooms_changed', () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['storage'] });
    });

    es.addEventListener('landlords_changed', () => {
      queryClient.invalidateQueries({ queryKey: ['landlords'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    });

    es.addEventListener('customers_changed', () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['sends'] });
    });

    es.addEventListener('sheet_synced', (e) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['sheets'] });
      try {
        const payload = JSON.parse(e.data);
        onNotification?.(
          `Đồng bộ Sheet xong: +${payload.added} mới, ${payload.updated} cập nhật, ${payload.removed} đã hết`,
          'success'
        );
      } catch {
        // Ignore parse failure
      }
    });

    es.addEventListener('sheet_sync_error', (e) => {
      queryClient.invalidateQueries({ queryKey: ['sheets'] });
      try {
        const payload = JSON.parse(e.data);
        onNotification?.(`Lỗi đồng bộ Sheet: ${payload.error}`, 'error');
      } catch {
        // Ignore
      }
    });

    es.addEventListener('storage_cleaned', (e) => {
      queryClient.invalidateQueries({ queryKey: ['storage'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      try {
        const payload = JSON.parse(e.data);
        onNotification?.(`Đã dọn ${payload.deletedFiles} ảnh cũ của phòng đã thuê`, 'info');
      } catch {
        // Ignore
      }
    });

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
    };
  }, [queryClient, onNotification]);

  return connected;
}
