import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
  Sse,
  MessageEvent,
} from "@nestjs/common";
import { Request as ExpressRequest } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { Observable, interval, map, merge } from "rxjs";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { JwtService } from "@nestjs/jwt";
import { NotificationsService } from "./notifications.service";

interface AuthenticatedRequest extends ExpressRequest {
  user: { id: string; email: string };
}

@ApiTags("Notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly jwtService: JwtService,
  ) {}

  @Get("stream")
  @ApiOperation({
    summary: "SSE 알림 스트림",
    description: "실시간 알림을 받기 위한 Server-Sent Events 스트림. Query parameter로 JWT 토큰 전달 필요",
  })
  @ApiQuery({ name: "token", description: "JWT 액세스 토큰" })
  @ApiResponse({ status: 200, description: "SSE 스트림 연결 성공" })
  @Sse()
  async stream(@Query("token") token: string): Promise<Observable<MessageEvent>> {
    // Verify JWT token from query parameter (SSE doesn't support Authorization header)
    let userId: string;
    try {
      const payload = this.jwtService.verify(token);
      userId = payload.sub;
    } catch {
      // Return empty observable on invalid token
      return new Observable((subscriber) => {
        subscriber.error(new Error("Invalid token"));
      });
    }

    // Heartbeat every 30 seconds to keep connection alive
    const heartbeat$ = interval(30000).pipe(
      map(() => ({ data: { type: "heartbeat" } }) as MessageEvent),
    );

    // Notification stream for this user
    const notifications$ = this.notificationsService
      .getNotificationStream(userId)
      .pipe(
        map(
          (notification) =>
            ({
              data: { type: "notification", notification },
            }) as MessageEvent,
        ),
      );

    return merge(heartbeat$, notifications$);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "알림 목록", description: "사용자의 알림 목록 조회" })
  @ApiQuery({ name: "limit", required: false, description: "조회 개수 (기본: 50)" })
  @ApiQuery({ name: "offset", required: false, description: "시작 위치 (기본: 0)" })
  @ApiResponse({ status: 200, description: "알림 목록 반환" })
  async list(
    @Request() req: AuthenticatedRequest,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const result = await this.notificationsService.findByUser(
      req.user.id,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
    return result;
  }

  @Get("unread-count")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "읽지 않은 알림 수", description: "읽지 않은 알림 개수 조회" })
  @ApiResponse({ status: 200, description: "읽지 않은 알림 수 반환" })
  async unreadCount(@Request() req: AuthenticatedRequest) {
    const count = await this.notificationsService.countUnread(req.user.id);
    return { count };
  }

  @Post(":id/read")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "알림 읽음 처리", description: "특정 알림을 읽음으로 표시" })
  @ApiParam({ name: "id", description: "알림 ID" })
  @ApiResponse({ status: 200, description: "읽음 처리 성공" })
  @ApiResponse({ status: 404, description: "알림 없음" })
  async markAsRead(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const notification = await this.notificationsService.markAsRead(
      id,
      req.user.id,
    );
    return { success: true, notification };
  }

  @Post("read-all")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "모든 알림 읽음 처리", description: "사용자의 모든 알림을 읽음으로 표시" })
  @ApiResponse({ status: 200, description: "모든 알림 읽음 처리 성공" })
  async markAllAsRead(@Request() req: AuthenticatedRequest) {
    await this.notificationsService.markAllAsRead(req.user.id);
    return { success: true };
  }
}
