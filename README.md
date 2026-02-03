# Defrag

**컨텍스트 통합 플랫폼** - 여러 데이터 소스를 통합하고 AI 기반 시맨틱 검색으로 정보를 찾아주는 워크스페이스 협업 도구

## 주요 기능

### 데이터 통합
- **GitHub**: PR, Issue, Commit 동기화
- **Slack**: 채널 메시지 동기화
- **Notion**: 페이지 콘텐츠 동기화
- **Web Article**: URL 기반 웹 문서 저장

### AI 기반 검색
- **시맨틱 검색**: OpenAI 임베딩 기반 벡터 유사도 검색
- **AI 질의응답**: 컨텍스트를 활용한 LLM 기반 답변 생성
- **대화 히스토리**: 이전 대화를 기억하며 이어서 질문 가능

### 협업
- **워크스페이스**: 개인/팀 워크스페이스 지원
- **멤버 관리**: 팀원 초대 및 역할 관리 (Admin/Member)
- **통합 관리**: 워크스페이스별 연동 설정

## 기술 스택

### Backend
| 기술 | 용도 |
|------|------|
| NestJS 11 | 백엔드 프레임워크 |
| TypeORM | ORM |
| PostgreSQL 16 | 데이터베이스 |
| pgvector | 벡터 임베딩 저장/검색 |
| Redis 7 | 캐시 및 작업 큐 |
| Bull MQ | 비동기 작업 처리 |
| Passport | 인증 (JWT, OAuth) |
| OpenAI API | 임베딩 및 LLM |

### Frontend
| 기술 | 용도 |
|------|------|
| Next.js 16 | 프론트엔드 프레임워크 |
| React 19 | UI 라이브러리 |
| TailwindCSS 4 | 스타일링 |
| Zustand 5 | 상태 관리 |
| Axios | HTTP 클라이언트 |
| React Markdown | 마크다운 렌더링 |

### Infrastructure
| 서비스 | 용도 |
|--------|------|
| Docker Compose | 로컬 개발 환경 |
| PostgreSQL + pgvector | 벡터 DB |
| Redis | 캐시/큐 |
| MailHog | 개발용 이메일 테스트 |

## 프로젝트 구조

```
Defrag/
├── backend/                 # NestJS 백엔드
│   ├── src/
│   │   ├── auth/           # 인증 (JWT, OAuth)
│   │   ├── common/         # 공통 모듈 (가드, 유틸)
│   │   ├── connections/    # 개인 OAuth 연결
│   │   ├── conversations/  # AI 대화 기능
│   │   ├── database/       # 엔티티 정의
│   │   ├── embedding/      # 임베딩 생성
│   │   ├── email/          # 이메일 발송
│   │   ├── integrations/   # 워크스페이스 통합
│   │   ├── items/          # 컨텍스트 아이템 CRUD
│   │   ├── llm/            # LLM 서비스
│   │   ├── oauth/          # OAuth 프로바이더
│   │   ├── scheduler/      # 스케줄링
│   │   ├── search/         # 검색 기능
│   │   ├── sync/           # 데이터 동기화
│   │   ├── users/          # 사용자 관리
│   │   ├── webhooks/       # 웹훅 처리
│   │   └── workspaces/     # 워크스페이스 관리
│   └── sql/                # DB 마이그레이션 SQL
├── frontend/               # Next.js 프론트엔드
│   └── src/
│       ├── app/            # 페이지 (App Router)
│       ├── components/     # UI 컴포넌트
│       ├── lib/            # API 클라이언트, 유틸
│       ├── stores/         # Zustand 스토어
│       └── types/          # TypeScript 타입
├── docker/                 # Docker 설정
│   ├── docker-compose.yml
│   └── init.sql
└── .env                    # 환경 변수
```

## 시작하기

### 사전 요구사항

- Node.js 20+
- Docker & Docker Compose
- OpenAI API Key

### 설치 및 실행

1. **저장소 클론**
```bash
git clone https://github.com/dnjsals45/Defrag.git
cd Defrag
```

2. **환경 변수 설정**
```bash
cp .env.example .env
# .env 파일에서 필요한 값 설정
```

3. **인프라 실행**
```bash
cd docker
docker-compose up -d
```

4. **백엔드 실행**
```bash
cd backend
npm install
npm run start:dev
```

5. **프론트엔드 실행**
```bash
cd frontend
npm install
npm run dev
```

### 접속 URL

| 서비스 | URL |
|--------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001/api |
| MailHog (이메일) | http://localhost:8025 |

## API 엔드포인트

### 인증
- `POST /api/auth/signup` - 회원가입
- `POST /api/auth/login` - 로그인
- `GET /api/auth/me` - 현재 사용자 정보
- `GET /api/auth/google` - Google OAuth
- `GET /api/auth/kakao` - Kakao OAuth

### 워크스페이스
- `GET /api/workspaces` - 워크스페이스 목록
- `POST /api/workspaces` - 워크스페이스 생성
- `GET /api/workspaces/:id/members` - 멤버 목록
- `POST /api/workspaces/:id/members/invite` - 멤버 초대

### 통합
- `GET /api/workspaces/:id/integrations` - 연동 목록
- `GET /api/workspaces/:id/integrations/:provider/auth` - OAuth 연동 시작
- `PATCH /api/workspaces/:id/integrations/:provider` - 연동 설정 수정

### 아이템
- `GET /api/workspaces/:id/items` - 아이템 목록
- `POST /api/workspaces/:id/items/sync` - 동기화 시작

### 검색
- `POST /api/workspaces/:id/search` - 시맨틱 검색
- `POST /api/workspaces/:id/ask` - AI 질의응답

### 대화
- `GET /api/workspaces/:id/conversations` - 대화 목록
- `POST /api/workspaces/:id/conversations` - 새 대화 생성
- `POST /api/workspaces/:id/conversations/:id/messages` - 메시지 전송

## 데이터베이스 스키마

### 주요 엔티티

| 엔티티 | 설명 |
|--------|------|
| `users` | 사용자 정보 |
| `workspace` | 워크스페이스 |
| `workspace_member` | 워크스페이스 멤버 |
| `workspace_integration` | 워크스페이스 통합 설정 |
| `user_connection` | 개인 OAuth 연결 |
| `context_item` | 동기화된 컨텐츠 |
| `vector_data` | 임베딩 벡터 |
| `conversation` | AI 대화 |
| `conversation_message` | 대화 메시지 |

## 환경 변수

```env
# App
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001

# Database
DATABASE_URL=postgresql://defrag:password@localhost:5432/defrag
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=32-character-encryption-key

# Email
SMTP_HOST=localhost
SMTP_PORT=1025

# AI
OPENAI_API_KEY=sk-...

# OAuth (선택)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
```

## 주요 워크플로우

### 1. 데이터 동기화 파이프라인
```
OAuth 연동 → 리소스 선택 (repos/channels/pages) → 동기화 트리거
    → Bull MQ 작업 큐 → 프로바이더별 데이터 수집 → DB 저장
    → 임베딩 생성 → 벡터 DB 저장
```

### 2. AI 검색 및 질의응답
```
사용자 질문 → 질문 임베딩 생성 → pgvector 유사도 검색
    → 상위 K개 컨텍스트 추출 → LLM에 컨텍스트와 함께 질문
    → AI 응답 생성 → 참조 소스와 함께 반환
```

### 3. AI 대화
```
새 대화 생성 → 질문 입력 → 관련 컨텍스트 검색
    → 대화 히스토리 + 컨텍스트로 LLM 호출
    → 응답 저장 (소스 포함) → 마크다운 렌더링
```

## 최근 업데이트

- **AI 대화 히스토리**: 대화 저장 및 이어서 대화 기능
- **Markdown 응답**: AI 응답을 마크다운으로 렌더링
- **Notion 통합**: 페이지 선택 기능
- **Slack 통합**: 채널 선택 기능
- **GitHub 통합**: 레포지토리 선택 기능
- **검색 정확도 개선**: 시맨틱 검색 알고리즘 최적화

## 라이선스

MIT License
