# RAG 파이프라인 품질 개선 노트

> 추후 응답 품질 개선 시 참고용 문서

## 현재 구조 요약

### 1. 임베딩 파이프라인
- **모델**: `text-embedding-3-small` (OpenAI)
- **차원**: 1536
- **청킹**: 500자 단위, 50자 오버랩, 문장 경계 고려

### 2. 검색 파이프라인
- **유사도 계산**: 벡터 거리 기반 (score = 1 - distance)
- **임계값**: 0.25 (한국어 텍스트 고려)
- **검색 결과 수**: 10개

### 3. 응답 생성
- **모델**: `gpt-4o-mini`
- **Temperature**: 0.7
- **Max Tokens**: 1000

---

## 개선 포인트

### 1. 프롬프트 엔지니어링

#### 현재 시스템 프롬프트
```
You are a helpful AI assistant that answers questions based on the provided context from the user's workspace.
Your answers should be:
- Accurate and based only on the provided context
- Concise but comprehensive
- In the same language as the question (Korean or English)

If the context doesn't contain enough information to answer the question, say so honestly.
```

#### 개선 방향
- [ ] 소스 타입별 컨텍스트 해석 가이드 추가 (마크다운 문서 vs Slack 메시지 vs GitHub PR)
- [ ] 구조화된 출력 포맷 지시 (코드 블록, 목록 등 활용)
- [ ] 인용/참조 방식 명시 (어떤 문서에서 왔는지 명확히)
- [ ] Few-shot 예제 추가

### 2. 컨텍스트 구성

#### 현재 방식
```
[sourceType] 제목 (관련도: 75%):
snippet 내용
```

#### 개선 방향
- [ ] 청크가 아닌 **전체 문서 내용** 전달 옵션
- [ ] 같은 문서의 여러 청크 → **병합**하여 전달
- [ ] 소스 타입별 포맷팅 차별화
  - 마크다운: 그대로 유지
  - Slack: 대화 형식으로 재구성
  - GitHub: PR/Issue 메타데이터 강조
- [ ] 관련도 순 정렬 + 중요도(importanceScore) 가중치 적용

### 3. 청킹 전략

#### 현재 설정
- `CHUNK_SIZE`: 500자
- `CHUNK_OVERLAP`: 50자

#### 실험 필요 사항
- [ ] 청크 크기 조정 테스트 (300자, 500자, 800자, 1000자)
- [ ] 소스 타입별 청킹 전략 차별화
  - 코드: 함수/클래스 단위
  - 마크다운: 섹션(헤딩) 단위
  - Slack: 스레드 단위
- [ ] 시맨틱 청킹 도입 (의미 단위 분리)

### 4. 검색 품질

#### 개선 방향
- [ ] **Hybrid Search**: 벡터 검색 + 키워드 검색(BM25) 결합
- [ ] **Re-ranking**: 초기 검색 후 LLM으로 재순위화
- [ ] 유사도 임계값 동적 조정
- [ ] 검색 쿼리 확장 (동의어, 관련 용어)

### 5. 모델 업그레이드

#### 고려 사항
- [ ] `gpt-4o` 또는 `gpt-4-turbo`로 업그레이드 (비용 vs 품질 트레이드오프)
- [ ] 임베딩 모델 변경 (`text-embedding-3-large`)
- [ ] 한국어 특화 모델 검토

### 6. 평가 체계 구축

#### 필요 사항
- [ ] 테스트 질문-답변 세트 구축
- [ ] 자동 평가 메트릭 도입 (BLEU, ROUGE, BERTScore)
- [ ] A/B 테스트 인프라
- [ ] 사용자 피드백 수집 (좋아요/싫어요)

---

## 우선순위 제안

| 순위 | 개선 항목 | 예상 효과 | 난이도 |
|------|----------|----------|--------|
| 1 | 프롬프트 개선 | 높음 | 낮음 |
| 2 | 같은 문서 청크 병합 | 높음 | 중간 |
| 3 | 전체 문서 내용 전달 | 높음 | 낮음 |
| 4 | Hybrid Search 도입 | 중간 | 높음 |
| 5 | 소스 타입별 청킹 | 중간 | 중간 |
| 6 | Re-ranking | 높음 | 높음 |

---

## 참고 파일 위치

| 파일 | 역할 |
|------|------|
| `backend/src/llm/llm.service.ts` | LLM 호출, 프롬프트 |
| `backend/src/conversations/conversations.service.ts` | RAG 파이프라인, 컨텍스트 구성 |
| `backend/src/embedding/embedding.processor.ts` | 청킹, 임베딩 생성 |
| `backend/src/embedding/embedding.service.ts` | OpenAI 임베딩 API 호출 |
| `backend/src/search/search.service.ts` | 벡터 검색 |

---

## 관련 리소스

- [OpenAI Embedding Guide](https://platform.openai.com/docs/guides/embeddings)
- [RAG Best Practices](https://www.pinecone.io/learn/retrieval-augmented-generation/)
- [Chunking Strategies](https://www.pinecone.io/learn/chunking-strategies/)
