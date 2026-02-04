import { z } from 'zod';

export const createWorkspaceSchema = z.object({
    name: z.string().min(1, '워크스페이스 이름을 입력해주세요').max(20, '이름은 20자 이내여야 합니다'),
    type: z.enum(['personal', 'team']),
});

export type CreateWorkspaceForm = z.infer<typeof createWorkspaceSchema>;
