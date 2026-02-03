# Contributing to Defrag

Defrag 프로젝트에 기여해주셔서 감사합니다!

## 목차

- [브랜치 전략](#브랜치-전략)
- [개발 워크플로우](#개발-워크플로우)
- [커밋 컨벤션](#커밋-컨벤션)
- [Pull Request 가이드](#pull-request-가이드)
- [코드 스타일](#코드-스타일)

---

## 브랜치 전략

Git Flow 기반의 브랜치 전략을 사용합니다.

### 메인 브랜치

| 브랜치 | 용도 | 보호 |
|--------|------|------|
| `main` | 프로덕션 배포 브랜치 | Protected |
| `dev` | 개발 통합 브랜치 (기본 브랜치) | Protected |

### 작업 브랜치

| 브랜치 패턴 | 용도 | 예시 |
|------------|------|------|
| `feature/*` | 새로운 기능 개발 | `feature/add-slack-integration` |
| `fix/*` | 버그 수정 | `fix/login-redirect-error` |
| `hotfix/*` | 프로덕션 긴급 수정 | `hotfix/critical-auth-bug` |
| `release/*` | 릴리즈 준비 | `release/v1.0.0` |
| `chore/*` | 설정, 문서, 리팩토링 | `chore/update-dependencies` |

### 브랜치 플로우

```
main (production)
  ↑
  └── release/* ← dev (development)
                    ↑
                    ├── feature/*
                    ├── fix/*
                    └── chore/*
```

**Hotfix 플로우:**
```
main ← hotfix/* → main & dev (양쪽 머지)
```

---

## 개발 워크플로우

### 1. 새 기능 개발

```bash
# dev 브랜치에서 시작
git checkout dev
git pull origin dev

# feature 브랜치 생성
git checkout -b feature/기능명

# 작업 후 커밋
git add .
git commit -m "feat: 기능 설명"

# 원격에 푸시
git push origin feature/기능명

# GitHub에서 PR 생성 (dev ← feature/기능명)
```

### 2. 버그 수정

```bash
git checkout dev
git pull origin dev
git checkout -b fix/버그명

# 수정 후
git commit -m "fix: 버그 수정 설명"
git push origin fix/버그명

# PR 생성 (dev ← fix/버그명)
```

### 3. 릴리즈

```bash
# dev에서 release 브랜치 생성
git checkout dev
git checkout -b release/v1.0.0

# 버전 업데이트, 최종 테스트
git commit -m "chore: bump version to 1.0.0"

# PR 생성 (main ← release/v1.0.0)
# 머지 후 태그 생성
git tag v1.0.0
git push origin v1.0.0

# dev에도 머지
git checkout dev
git merge release/v1.0.0
```

---

## 커밋 컨벤션

[Conventional Commits](https://www.conventionalcommits.org/) 규칙을 따릅니다.

### 형식

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Type

| Type | 설명 |
|------|------|
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `docs` | 문서 수정 |
| `style` | 코드 포맷팅 (기능 변경 없음) |
| `refactor` | 리팩토링 (기능 변경 없음) |
| `test` | 테스트 추가/수정 |
| `chore` | 빌드, 설정 파일 수정 |
| `perf` | 성능 개선 |

### Scope (선택)

- `frontend`, `backend`, `auth`, `sync`, `search` 등

### 예시

```
feat(backend): GitHub 연동 기능 추가
fix(frontend): 로그인 리다이렉트 오류 수정
docs: README 업데이트
chore(backend): 의존성 업데이트
```

---

## Pull Request 가이드

### PR 생성 전 체크리스트

- [ ] 코드가 로컬에서 빌드되는지 확인
- [ ] 테스트가 모두 통과하는지 확인
- [ ] 린트 오류가 없는지 확인
- [ ] 커밋 메시지가 컨벤션을 따르는지 확인

### PR 규칙

1. **제목**: 커밋 컨벤션과 동일한 형식 사용
2. **설명**: 변경 사항과 테스트 방법 명시
3. **리뷰어**: 최소 1명 이상의 리뷰 필요 (권장)
4. **CI**: 모든 CI 체크 통과 필수

### 머지 전략

- `dev` ← feature/fix: **Squash and merge** (권장)
- `main` ← release: **Merge commit**
- `main` ← hotfix: **Merge commit**

---

## 코드 스타일

### Backend (NestJS)

- ESLint + Prettier 설정 준수
- 파일명: `kebab-case` (예: `auth.service.ts`)
- 클래스명: `PascalCase`
- 함수/변수명: `camelCase`

```bash
cd backend
npm run lint
```

### Frontend (Next.js)

- ESLint 설정 준수
- 컴포넌트: `PascalCase` (예: `LoginForm.tsx`)
- 유틸/훅: `camelCase` (예: `useAuth.ts`)

```bash
cd frontend
npm run lint
```

---

## 로컬 개발 환경

### 필수 요구사항

- Node.js 20+
- Docker & Docker Compose
- Git

### 설정

```bash
# 저장소 클론
git clone https://github.com/dnjsals45/Defrag.git
cd Defrag

# 환경 변수 설정
cp .env.example .env
# .env 파일 수정

# 인프라 실행
cd docker && docker-compose up -d

# Backend
cd ../backend
npm install
npm run start:dev

# Frontend (새 터미널)
cd ../frontend
npm install
npm run dev
```

---

## 질문이 있으신가요?

이슈를 생성하거나 PR에 코멘트를 남겨주세요!
