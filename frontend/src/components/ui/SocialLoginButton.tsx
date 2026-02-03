'use client';

import { ButtonHTMLAttributes } from 'react';

type Provider = 'google' | 'kakao';

interface SocialLoginButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  provider: Provider;
}

const providerConfig = {
  google: {
    label: 'Google로 계속하기',
    bgColor: 'bg-white hover:bg-gray-50',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-300',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    ),
  },
  kakao: {
    label: '카카오로 계속하기',
    bgColor: 'bg-[#FEE500] hover:bg-[#FDD835]',
    textColor: 'text-[#191919]',
    borderColor: 'border-transparent',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
          fill="#191919"
          d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3zm5.907 8.06l1.47-1.424a.472.472 0 0 0-.656-.678l-1.928 1.866V9.282a.472.472 0 0 0-.944 0v2.557a.471.471 0 0 0 0 .222v2.218a.472.472 0 0 0 .944 0v-1.58l.478-.464 1.596 2.232a.472.472 0 0 0 .766-.55l-1.726-2.357zM8.4 9.282a.472.472 0 0 0-.944 0v4.997a.472.472 0 0 0 .944 0V9.282zm3.853 4.526l-1.39-2.2 1.39-2.166a.472.472 0 0 0-.79-.516l-1.205 1.888-1.205-1.888a.472.472 0 0 0-.79.516l1.39 2.165-1.39 2.2a.472.472 0 1 0 .79.516l1.205-1.888 1.205 1.888a.472.472 0 1 0 .79-.516z"
        />
      </svg>
    ),
  },
};

export function SocialLoginButton({ provider, className = '', ...props }: SocialLoginButtonProps) {
  const config = providerConfig[provider];
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  const handleClick = () => {
    window.location.href = `${apiUrl}/auth/${provider}`;
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        w-full flex items-center justify-center gap-3 px-4 py-3
        rounded-lg border font-medium transition-colors
        ${config.bgColor} ${config.textColor} ${config.borderColor}
        ${className}
      `}
      {...props}
    >
      {config.icon}
      <span>{config.label}</span>
    </button>
  );
}
