import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Workspace,
  WorkspaceType,
} from "../database/entities/workspace.entity";
import {
  WorkspaceMember,
  MemberRole,
} from "../database/entities/workspace-member.entity";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { UpdateWorkspaceDto } from "./dto/update-workspace.dto";

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspacesRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly membersRepository: Repository<WorkspaceMember>,
  ) {}

  async create(userId: string, dto: CreateWorkspaceDto): Promise<Workspace> {
    // 같은 사용자의 워크스페이스 중 동일 이름 체크
    const existingWorkspaces = await this.findAllByUser(userId);
    const isDuplicate = existingWorkspaces.some(
      (ws) => ws.name.toLowerCase() === dto.name.trim().toLowerCase(),
    );

    if (isDuplicate) {
      throw new ConflictException("이미 같은 이름의 워크스페이스가 존재합니다");
    }

    const workspace = this.workspacesRepository.create({
      ownerId: userId,
      name: dto.name.trim(),
      type: dto.type || WorkspaceType.PERSONAL,
    });

    const savedWorkspace = await this.workspacesRepository.save(workspace);

    // Add owner as admin member
    const member = this.membersRepository.create({
      userId,
      workspaceId: savedWorkspace.id,
      role: MemberRole.ADMIN,
    });
    await this.membersRepository.save(member);

    return savedWorkspace;
  }

  async findAllByUser(userId: string): Promise<any[]> {
    const members = await this.membersRepository.find({
      where: { userId },
      relations: ["workspace"],
    });

    // Filter out members where workspace is null (soft-deleted)
    const validMembers = members.filter((member) => member.workspace !== null);

    return Promise.all(
      validMembers.map(async (member) => {
        const memberCount = await this.membersRepository.count({
          where: { workspaceId: member.workspaceId },
        });
        return {
          id: member.workspace.id,
          name: member.workspace.name,
          type: member.workspace.type,
          role: member.role,
          memberCount,
        };
      }),
    );
  }

  async findById(id: string, userId: string): Promise<Workspace> {
    const workspace = await this.workspacesRepository.findOne({
      where: { id },
      relations: ["members", "members.user"],
    });

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    const isMember = workspace.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException("Access denied");
    }

    return workspace;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<Workspace> {
    const workspace = await this.findById(id, userId);

    const member = await this.membersRepository.findOne({
      where: { workspaceId: id, userId },
    });

    if (member?.role !== MemberRole.ADMIN) {
      throw new ForbiddenException("Only admins can update workspace");
    }

    Object.assign(workspace, dto);
    return this.workspacesRepository.save(workspace);
  }

  async delete(id: string, userId: string): Promise<void> {
    const workspace = await this.findById(id, userId);

    if (workspace.ownerId !== userId) {
      throw new ForbiddenException("Only owner can delete workspace");
    }

    await this.workspacesRepository.softDelete(id);
  }

  async checkAccess(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    return this.membersRepository.findOne({
      where: { workspaceId, userId },
    });
  }
}
