import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { SearchService } from "./search.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { SearchDto } from "./dto/search.dto";
import { AskDto } from "./dto/ask.dto";

@Controller("workspaces/:workspaceId")
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post("search")
  async search(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Body() dto: SearchDto,
  ) {
    return this.searchService.search(workspaceId, req.user.id, dto);
  }

  @Post("ask")
  async ask(
    @Request() req: any,
    @Param("workspaceId") workspaceId: string,
    @Body() dto: AskDto,
  ) {
    return this.searchService.ask(workspaceId, req.user.id, dto);
  }
}
