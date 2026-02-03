# 이메일 인증 기능 구현 완료

## 구현 내용

### 1. 회원가입 수정 (signUp)
**파일**: `src/auth/auth.service.ts`

- 랜덤 토큰 생성 (crypto.randomBytes 32바이트)
- User 엔티티에 다음 필드 저장:
  - `emailVerificationToken`: 생성된 토큰
  - `emailVerificationExpiry`: 24시간 후 만료 시간
  - `isEmailVerified`: false로 설정
- `EmailService.sendVerificationEmail()` 호출하여 인증 이메일 발송
- 응답에 `message: "인증 이메일을 발송했습니다"` 포함
- 응답에 `isEmailVerified` 필드 포함

### 2. 이메일 인증 엔드포인트
**엔드포인트**: `GET /auth/verify-email?token=xxx`
**파일**: `src/auth/auth.controller.ts`, `src/auth/auth.service.ts`

**기능**:
- 토큰으로 사용자 조회
- 토큰 유효성 검증 (존재 여부)
- 만료 시간 확인
- 인증 완료 처리:
  - `isEmailVerified = true`
  - `emailVerificationToken = null`
  - `emailVerificationExpiry = null`
- 성공/실패 메시지 반환

**응답**:
```json
{
  "message": "이메일 인증이 완료되었습니다"
}
```

**에러 처리**:
- 유효하지 않은 토큰: `BadRequestException('유효하지 않은 인증 토큰입니다')`
- 만료된 토큰: `BadRequestException('인증 토큰이 만료되었습니다')`

### 3. 인증 이메일 재발송
**엔드포인트**: `POST /auth/resend-verification`
**파일**: `src/auth/auth.controller.ts`, `src/auth/auth.service.ts`

**요청 본문**:
```json
{
  "email": "user@example.com"
}
```

**기능**:
- 이메일로 사용자 조회
- 이미 인증된 경우 에러 반환
- 새 토큰 생성 (crypto.randomBytes 32바이트)
- 새 만료 시간 설정 (24시간 후)
- DB 업데이트
- 인증 이메일 재발송

**응답**:
```json
{
  "message": "인증 이메일을 재발송했습니다"
}
```

**에러 처리**:
- 사용자 없음: `NotFoundException('사용자를 찾을 수 없습니다')`
- 이미 인증됨: `BadRequestException('이미 인증된 이메일입니다')`

### 4. 로그인 수정
**파일**: `src/auth/auth.service.ts`

- 응답에 `isEmailVerified` 필드 추가
- 이메일 미인증 사용자에게 경고 메시지 추가 (로그인은 허용)

**응답 예시** (미인증 사용자):
```json
{
  "user": {
    "id": "1",
    "email": "user@example.com",
    "nickname": "사용자",
    "isEmailVerified": false
  },
  "accessToken": "...",
  "refreshToken": "...",
  "warning": "이메일 인증이 완료되지 않았습니다"
}
```

## 수정된 파일

### 1. `src/auth/auth.service.ts`
- crypto 모듈 import 추가
- EmailService 의존성 주입
- BadRequestException, NotFoundException import 추가
- `signUp()` 메서드 수정: 토큰 생성 및 이메일 발송
- `login()` 메서드 수정: isEmailVerified 포함 및 경고 메시지
- `verifyEmail()` 메서드 추가
- `resendVerificationEmail()` 메서드 추가

### 2. `src/auth/auth.controller.ts`
- Query 데코레이터 import 추가
- ResendVerificationDto import 추가
- `GET /auth/verify-email` 엔드포인트 추가
- `POST /auth/resend-verification` 엔드포인트 추가

### 3. `src/users/users.service.ts`
- `create()` 메서드에 이메일 인증 필드 파라미터 추가
- `findByVerificationToken()` 메서드 추가
- `verifyEmail()` 메서드 추가
- `updateVerificationToken()` 메서드 추가

### 4. `src/auth/dto/resend-verification.dto.ts` (신규)
- 이메일 재발송 요청 DTO
- email 필드 (IsEmail 검증)

## API 엔드포인트 정리

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | /auth/signup | 회원가입 (인증 이메일 자동 발송) |
| GET | /auth/verify-email?token=xxx | 이메일 인증 |
| POST | /auth/resend-verification | 인증 이메일 재발송 |
| POST | /auth/login | 로그인 (미인증 시 경고 포함) |

## 테스트 결과

- TypeScript 컴파일: ✅ 성공
- 전체 테스트 스위트: ✅ 104/104 통과
- 빌드: ✅ 성공

## 사용 예시

### 1. 회원가입
```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "nickname": "사용자"
  }'
```

### 2. 이메일 인증
```bash
curl -X GET "http://localhost:3000/auth/verify-email?token=abc123..."
```

### 3. 인증 이메일 재발송
```bash
curl -X POST http://localhost:3000/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

## 보안 고려사항

1. **토큰 보안**: 32바이트 랜덤 토큰 사용 (256비트 엔트로피)
2. **만료 시간**: 24시간 후 자동 만료
3. **재발송 제한**: 이미 인증된 사용자는 재발송 불가
4. **로그인 정책**: 미인증 사용자도 로그인 가능 (경고 메시지만 표시)

## 다음 단계

프론트엔드에서 다음 UI 구현 필요:
1. 회원가입 후 "인증 이메일 발송됨" 알림
2. 이메일 인증 페이지 (/verify-email?token=xxx)
3. 인증 이메일 재발송 버튼
4. 로그인 후 미인증 경고 표시
