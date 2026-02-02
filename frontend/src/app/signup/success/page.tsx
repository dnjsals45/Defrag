'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { authApi } from '@/lib/api';

export default function SignupSuccessPage() {
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [email, setEmail] = useState('');

  const handleResend = async () => {
    if (!email) {
      setResendMessage('이메일을 입력해주세요');
      return;
    }

    setIsResending(true);
    setResendMessage('');

    try {
      await authApi.resendVerification(email);
      setResendMessage('인증 이메일이 재발송되었습니다');
    } catch (err: any) {
      setResendMessage(err.response?.data?.message || '재발송에 실패했습니다');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4">
      <div className="w-full max-w-lg">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl shadow-blue-100/50 p-10 border border-blue-100">
          {/* Animated Mail Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full blur-2xl opacity-30 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-3xl shadow-lg transform hover:scale-105 transition-transform duration-300">
                <svg
                  className="w-16 h-16 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Title and Description */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              이메일을 확인해주세요
            </h1>
            <p className="text-gray-600 leading-relaxed">
              가입하신 이메일로 인증 링크를 발송했습니다.<br />
              이메일을 확인하고 링크를 클릭하여 계정을 활성화해주세요.
            </p>
          </div>

          {/* Resend Section */}
          <div className="space-y-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <p className="text-sm text-gray-700 mb-4 text-center">
                이메일이 도착하지 않았나요?
              </p>

              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="이메일 주소"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />

                <Button
                  onClick={handleResend}
                  isLoading={isResending}
                  variant="secondary"
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-200/50 border-0"
                >
                  {isResending ? '발송 중...' : '인증 이메일 재발송'}
                </Button>
              </div>

              {resendMessage && (
                <div className={`mt-4 p-3 rounded-xl text-sm text-center ${
                  resendMessage.includes('재발송되었습니다')
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-600'
                }`}>
                  {resendMessage}
                </div>
              )}
            </div>
          </div>

          {/* Tips */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-6">
            <p className="text-xs text-gray-600 leading-relaxed">
              💡 <strong>팁:</strong> 이메일이 보이지 않는다면 스팸 메일함을 확인해주세요.
              몇 분이 지나도 이메일이 도착하지 않으면 위의 재발송 버튼을 클릭해주세요.
            </p>
          </div>

          {/* Back to Login */}
          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center text-sm text-gray-600 hover:text-blue-600 transition-colors group"
            >
              <svg
                className="w-4 h-4 mr-1 transform group-hover:-translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              로그인으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
