import type { Metadata, Viewport } from 'next';

import './globals.css';
import { MotionShell } from '@/components/motion';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: '준공 이관검사 시스템',
  description:
    '이관검사 신청부터 감독관 검토승인, 1차·최종 합격·불합격 판정과 결과 통보까지 한 곳에서 처리합니다.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#171b21',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* 프로토타입의 인라인 스타일이 폰트를 이름으로 지정하므로 이름 그대로 로드한다 */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Roboto+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <MotionShell>
          <ToastProvider>{children}</ToastProvider>
        </MotionShell>
      </body>
    </html>
  );
}
