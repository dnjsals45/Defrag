'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { authApi } from '@/lib/api';

type VerificationState = 'verifying' | 'success' | 'error';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [state, setState] = useState<VerificationState>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setErrorMessage('인증 토큰이 유효하지 않습니다');
      return;
    }

    verifyEmail(token);
  }, [token]);

  const verifyEmail = async (token: string) => {
    try {
      await authApi.verifyEmail(token);
      setState('success');
    } catch (err: any) {
      setState('error');
      setErrorMessage(
        err.response?.data?.message || '이메일 인증에 실패했습니다'
      );
    }
  };

  const handleResend = async () => {
    if (!email) {
      setErrorMessage('이메일을 입력해주세요');
      return;
    }

    setIsResending(true);

    try {
      await authApi.resendVerification(email);
      setErrorMessage('인증 이메일이 재발송되었습니다');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || '재발송에 실패했습니다');
    } finally {
      setIsResending(false);
    }
  };

  const handleLoginRedirect = () => {
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4">
      <div className="w-full max-w-lg">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl shadow-blue-100/50 p-10 border border-blue-100">

          {/* Verifying State */}
          {state === 'verifying' && (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-400 rounded-full blur-2xl opacity-30 animate-pulse"></div>
                  <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-3xl">
                    <svg
                      className="w-16 h-16 text-white animate-spin"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </div>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">
                이메일 인증 중...
              </h1>
              <p className="text-gray-600">
                잠시만 기다려주세요
              </p>
            </div>
          )}

          {/* Success State */}
          {state === 'success' && (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-green-400 rounded-full blur-2xl opacity-30 animate-pulse"></div>
                  <div className="relative bg-gradient-to-br from-green-400 to-emerald-600 p-6 rounded-3xl shadow-lg transform animate-bounce-once">
                    <svg
                      className="w-16 h-16 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                이메일 인증 완료!
              </h1>
              <p className="text-gray-600 mb-8 leading-relaxed">
                계정이 성공적으로 활성화되었습니다.<br />
                이제 Defrag의 모든 기능을 사용하실 수 있습니다.
              </p>

              <Button
                onClick={handleLoginRedirect}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-200/50 border-0 py-3 text-base"
              >
                로그인하러 가기
              </Button>
            </div>
          )}

          {/* Error State */}
          {state === 'error' && (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-red-400 rounded-full blur-2xl opacity-30"></div>
                  <div className="relative bg-gradient-to-br from-red-400 to-pink-600 p-6 rounded-3xl shadow-lg">
                    <svg
                      className="w-16 h-16 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                인증 실패
              </h1>
              <p className="text-red-600 mb-8 leading-relaxed">
                {errorMessage}
              </p>

              {/* Resend Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
                <p className="text-sm text-gray-700 mb-4 text-center">
                  새로운 인증 이메일을 받으시겠습니까?
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

                {errorMessage.includes('재발송되었습니다') && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 text-center">
                    {errorMessage}
                  </div>
                )}
              </div>

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
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4">
      <div className="w-full max-w-lg">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl shadow-blue-100/50 p-10 border border-blue-100">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-400 rounded-full blur-2xl opacity-30 animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-3xl">
                  <svg
                    className="w-16 h-16 text-white animate-spin"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </div>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              로딩 중...
            </h1>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
