import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Subject, Observable } from "rxjs";
import { filter, map } from "rxjs/operators";
import {
  Notification,
  NotificationType,
} from "../database/entities/notification.entity";
import {
  Workspace,
  WorkspaceType,
} from "../database/entities/workspace.entity";
import {
  WorkspaceMember,
  MemberRole,
} from "../database/entities/workspace-member.entity";

interface NotificationEvent {
  userId: string;
  notification: Notification;
}

@Injectable()
export class NotificationsService {
  private notifications$ = new Subject<NotificationEvent>();

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepository: Repository<WorkspaceMember>,
  ) {}

  async create(
    userId: string,
    type: NotificationType,
    title: string,
    message?: string,
    workspaceId?: string,
    metadata?: Record<string, any>,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      userId,
      type,
      title,
      message: message || null,
      workspaceId: workspaceId || null,
      metadata: metadata || null,
      isRead: false,
    });

    const saved = await this.notificationRepository.save(notification);

    // Emit for SSE
    this.notifications$.next({ userId, notification: saved });

    return saved;
  }

  async createForWorkspace(
    workspaceId: string,
    type: NotificationType,
    title: string,
    message?: string,
    metadata?: Record<string, any>,
  ): Promise<Notification[]> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    const notifications: Notification[] = [];

    if (workspace.type === WorkspaceType.PERSONAL) {
      // Personal workspace: notify owner only
      const notification = await this.create(
        workspace.ownerId,
        type,
        title,
        message,
        workspaceId,
        metadata,
      );
      notifications.push(notification);
    } else {
      // Team workspace: notify all ADMINs
      const admins = await this.memberRepository.find({
        where: { workspaceId, role: MemberRole.ADMIN },
      });

      for (const admin of admins) {
        const notification = await this.create(
          admin.userId,
          type,
          title,
          message,
          workspaceId,
          metadata,
        );
        notifications.push(notification);
      }
    }

    return notifications;
  }

  async findByUser(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ notifications: Notification[]; total: number }> {
    const [notifications, total] = await this.notificationRepository.findAndCount({
      where: { userId },
      relations: ["workspace"],
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
    });

    return { notifications, total };
  }

  async countUnread(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    notification.isRead = true;
    return this.notificationRepository.save(notification);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  getNotificationStream(userId: string): Observable<Notification> {
    return this.notifications$.pipe(
      filter((event) => event.userId === userId),
      map((event) => event.notification),
    );
  }
}
