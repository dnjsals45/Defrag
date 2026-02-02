import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  async create(@Request() req: any, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(req.user.id, dto);
  }

  @Get()
  async findAll(@Request() req: any) {
    const workspaces = await this.workspacesService.findAllByUser(req.user.id);
    return { workspaces };
  }

  @Get(':id')
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.workspacesService.findById(id, req.user.id);
  }

  @Patch(':id')
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    await this.workspacesService.delete(id, req.user.id);
    return { success: true };
  }
}
