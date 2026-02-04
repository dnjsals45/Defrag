'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Send, Trash2, MessageSquare, ExternalLink, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, Button } from '@/components/ui';
import { useWorkspaceStore } from '@/stores/workspace';
import { conversationApi } from '@/lib/api';
import { getSourceIcon } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: {
    id: string;
    title: string;
    sourceType: string;
    sourceUrl?: string;
    snippet?: string;
  }[];
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: ConversationMessage[];
}

function ConversationsPageContent() {
  const { currentWorkspace } = useWorkspaceStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [question, setQuestion] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const processedQuestionRef = useRef<string | null>(null);

  const conversationIdFromUrl = searchParams.get('id');
  const questionFromUrl = searchParams.get('q');

  useEffect(() => {
    if (currentWorkspace) {
      loadConversations();
    }
  }, [currentWorkspace]);

  // URL에서 질문이 있으면 새 대화 시작 (중복 실행 방지)
  useEffect(() => {
    if (questionFromUrl && currentWorkspace && !isCreating) {
      // 이미 처리한 질문인지 확인
      if (processedQuestionRef.current === questionFromUrl) return;
      processedQuestionRef.current = questionFromUrl;
      startConversationWithQuestion(questionFromUrl);
    }
  }, [questionFromUrl, currentWorkspace]); // eslint-disable-line react-hooks/exhaustive-deps

  // URL에서 대화 ID가 있으면 해당 대화 로드
  useEffect(() => {
    if (conversationIdFromUrl && currentWorkspace && conversations.length > 0) {
      // 이미 선택된 대화와 같으면 스킵
      if (selectedConversation?.id === conversationIdFromUrl) return;
      // 대화 목록에 존재하는지 확인
      const exists = conversations.some((c) => c.id === conversationIdFromUrl);
      if (exists) {
        loadConversation(conversationIdFromUrl);
      } else {
        // 존재하지 않으면 URL 정리
        router.replace('/conversations', { scroll: false });
      }
    }
  }, [conversationIdFromUrl, currentWorkspace, conversations]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollToBottom();
  }, [selectedConversation?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    try {
      const { data } = await conversationApi.list(currentWorkspace.id, { limit: 50 });
      setConversations(data.conversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversation = async (conversationId: string) => {
    if (!currentWorkspace) return;
    try {
      const { data } = await conversationApi.get(currentWorkspace.id, conversationId);
      setSelectedConversation(data);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const createConversation = async () => {
    if (!currentWorkspace) return;
    setIsCreating(true);
    try {
      const { data } = await conversationApi.create(currentWorkspace.id);
      setConversations((prev) => [data, ...prev]);
      setSelectedConversation({ ...data, messages: [] });
      setQuestion(''); // 입력창 초기화
      // URL에 새 대화 ID 반영
      router.push(`/conversations?id=${data.id}`, { scroll: false });
      // 입력창에 포커스
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const startConversationWithQuestion = async (initialQuestion: string) => {
    if (!currentWorkspace || isCreating) return;
    setIsCreating(true);
    try {
      // 새 대화 생성
      const { data: newConversation } = await conversationApi.create(currentWorkspace.id);
      setConversations((prev) => [newConversation, ...prev]);

      // 질문 메시지 추가 (optimistic update)
      const tempUserMessage: ConversationMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: initialQuestion,
        createdAt: new Date().toISOString(),
      };
      setSelectedConversation({ ...newConversation, messages: [tempUserMessage] });

      // URL 정리 (q 파라미터 제거)
      router.replace(`/conversations?id=${newConversation.id}`, { scroll: false });

      // 메시지 전송
      setIsSending(true);
      const { data: response } = await conversationApi.sendMessage(
        currentWorkspace.id,
        newConversation.id,
        initialQuestion,
      );

      // 응답으로 업데이트
      setSelectedConversation((prev) => {
        if (!prev) return prev;
        const filteredMessages = (prev.messages || []).filter((m) => !m.id.startsWith('temp-'));
        return {
          ...prev,
          title: response.conversation?.title || prev.title,
          messages: [...filteredMessages, response.userMessage, response.assistantMessage],
        };
      });

      // 대화 목록의 제목도 업데이트
      if (response.conversation?.title) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === newConversation.id ? { ...c, title: response.conversation.title } : c,
          ),
        );
      }
    } catch (error) {
      console.error('Failed to start conversation with question:', error);
    } finally {
      setIsCreating(false);
      setIsSending(false);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    if (!currentWorkspace) return;
    if (!confirm('이 대화를 삭제하시겠습니까?')) return;
    try {
      await conversationApi.delete(currentWorkspace.id, conversationId);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
        // URL에서 대화 ID 제거
        router.push('/conversations', { scroll: false });
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !selectedConversation || !question.trim() || isSending) return;

    const userQuestion = question;
    setQuestion('');
    setIsSending(true);

    // Optimistically add user message
    const tempUserMessage: ConversationMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userQuestion,
      createdAt: new Date().toISOString(),
    };

    setSelectedConversation((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...(prev.messages || []), tempUserMessage],
      };
    });

    try {
      const { data } = await conversationApi.sendMessage(
        currentWorkspace.id,
        selectedConversation.id,
        userQuestion
      );

      // Update with real messages
      setSelectedConversation((prev) => {
        if (!prev) return prev;
        const messages = prev.messages?.filter((m) => m.id !== tempUserMessage.id) || [];
        return {
          ...prev,
          title: data.conversation?.title || prev.title,
          messages: [...messages, data.userMessage, data.assistantMessage],
        };
      });

      // Update conversation title in list if returned from server
      if (data.conversation?.title) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id
              ? { ...c, title: data.conversation.title, updatedAt: new Date().toISOString() }
              : c
          )
        );
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove optimistic message on error
      setSelectedConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages?.filter((m) => m.id !== tempUserMessage.id) || [],
        };
      });
      setQuestion(userQuestion); // Restore the question
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString('ko-KR');
  };

  if (!currentWorkspace) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900">
              워크스페이스를 선택하세요
            </h2>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-8rem)] gap-4">
        {/* Conversation List Sidebar */}
        <div className="w-80 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <Button
              onClick={createConversation}
              isLoading={isCreating}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              새 대화
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">대화가 없습니다</p>
                <p className="text-xs mt-1">새 대화를 시작해보세요</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={cn(
                      'group flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors',
                      selectedConversation?.id === conversation.id && 'bg-blue-50'
                    )}
                    onClick={() => router.push(`/conversations?id=${conversation.id}`, { scroll: false })}
                  >
                    <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {conversation.title || '새 대화'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatTime(conversation.updatedAt)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conversation.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-all"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">
                  {selectedConversation.title || '새 대화'}
                </h2>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {(!selectedConversation.messages || selectedConversation.messages.length === 0) && (
                  <div className="text-center py-12 text-gray-500">
                    <Sparkles className="w-12 h-12 mx-auto mb-3 text-purple-300" />
                    <p className="text-lg font-medium">워크스페이스의 컨텍스트를 활용한 AI 대화</p>
                    <p className="text-sm mt-1">질문을 입력하면 관련 문서를 참고하여 답변합니다</p>
                  </div>
                )}

                {selectedConversation.messages?.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-4 py-3',
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      )}
                    >
                      {message.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        <div className="prose prose-sm max-w-none prose-gray prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto [&_pre_code]:text-gray-100 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&>code]:text-purple-600 [&>code]:bg-purple-50 [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&_p_code]:text-purple-600 [&_p_code]:bg-purple-50 [&_p_code]:px-1 [&_p_code]:py-0.5 [&_p_code]:rounded [&_li_code]:text-purple-600 [&_li_code]:bg-purple-50 [&_li_code]:px-1 [&_li_code]:py-0.5 [&_li_code]:rounded prose-code:before:content-none prose-code:after:content-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      )}

                      {/* Sources for assistant messages */}
                      {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-300">
                          <p className="text-xs font-medium text-gray-500 mb-2">
                            참고 문서:
                          </p>
                          <div className="space-y-1">
                            {message.sources
                              .filter((source, index, self) =>
                                self.findIndex(s => s.id === source.id) === index
                              )
                              .slice(0, 3)
                              .map((source, index) => (
                                <a
                                  key={`${source.id}-${index}`}
                                  href={source.sourceUrl || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs text-gray-600 hover:text-blue-600"
                                >
                                  <span>{getSourceIcon(source.sourceType)}</span>
                                  <span className="truncate flex-1">{source.title}</span>
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                </a>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isSending && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600" />
                        <span className="text-sm text-gray-500">답변 생성 중...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <form onSubmit={sendMessage} className="p-4 border-t border-gray-200">
                <div className="flex gap-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="질문을 입력하세요..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isSending}
                  />
                  <Button type="submit" isLoading={isSending} disabled={!question.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">대화를 선택하세요</p>
                <p className="text-sm mt-1">왼쪽에서 대화를 선택하거나 새 대화를 시작하세요</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </AppLayout>
    }>
      <ConversationsPageContent />
    </Suspense>
  );
}
