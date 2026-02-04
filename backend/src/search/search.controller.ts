import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from "@nestjs/swagger";
import { SearchService } from "./search.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { SearchDto } from "./dto/search.dto";
import { AskDto } from "./dto/ask.dto";

@ApiTags("Search")
@ApiBearerAuth("access-token")
@Controller("workspaces/:workspaceId")
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post("search")
  @ApiOperation({ summary: "시맨틱 검색", description: "워크스페이스 내 컨텍스트 시맨틱 검색" })
  @ApiParam({ name: "workspaceId", description: "워크스페이스 ID" })
  @ApiResponse({ status: 200, description: "검색 결과 반환" })
  async search(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Body() dto: SearchDto,
  ) {
    return this.searchService.search(workspaceId, req.user.id, dto);
  }

  @Post("ask")
  @ApiOperation({ summary: "AI 질문", description: "컨텍스트 기반 AI 질문 응답" })
  @ApiParam({ name: "workspaceId", description: "워크스페이스 ID" })
  @ApiResponse({ status: 200, description: "AI 응답 반환" })
  async ask(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Body() dto: AskDto,
  ) {
    return this.searchService.ask(workspaceId, req.user.id, dto);
  }
}
